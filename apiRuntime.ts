import type { IncomingMessage, ServerResponse } from "node:http";
type App = (req: IncomingMessage, res: ServerResponse) => unknown;
export function createApiHandler(
  load: () => Promise<{ default: App }>,
  config: () => NodeJS.ProcessEnv = () => process.env,
  log: (...values: unknown[]) => void = console.error,
) {
  let application: Promise<{ default: App }> | undefined;
  function error(res: ServerResponse, code: string, message: string) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ code, error: message }));
  }
  return async (req: IncomingMessage, res: ServerResponse) => {
    const env = config();
    if (env.VERCEL && env.DATA_PROVIDER === "legacy") {
      if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN)
        return error(
          res,
          "DATABASE_NOT_CONFIGURED",
          "O banco de dados do app ainda não está configurado. Na Vercel, adicione TURSO_DATABASE_URL e TURSO_AUTH_TOKEN em Production e faça Redeploy. A chave Gemini não substitui o banco de dados.",
        );
      try {
        const url = new URL(env.TURSO_DATABASE_URL);
        if (
          !["libsql:", "https:"].includes(url.protocol) ||
          !url.hostname ||
          url.username ||
          url.password
        )
          throw Error("Invalid database URL");
      } catch {
        return error(
          res,
          "INVALID_DATABASE_URL",
          "A URL do banco de dados está inválida. Confira TURSO_DATABASE_URL na Vercel e faça Redeploy.",
        );
      }
    }
    let app: App;
    try {
      application ??= load();
      app = (await application).default;
    } catch (cause) {
      const e = cause as { name?: string; code?: string };
      const code =
        typeof e.code === "string" && /^[A-Z0-9_]{1,50}$/.test(e.code)
          ? e.code
          : "STARTUP_ERROR";
      log("API_STARTUP_FAILURE", {
        name: typeof e.name === "string" ? e.name : "Error",
        code,
      });
      return error(
        res,
        e.name === "LibsqlError"
          ? "DATABASE_CONNECTION_FAILED"
          : "SERVICE_STARTUP_FAILED",
        e.name === "LibsqlError"
          ? "Não foi possível conectar ao banco de dados. Confira a URL e o token do Turso na Vercel e consulte os logs da implantação."
          : "O serviço do aplicativo não conseguiu iniciar. Consulte os logs de Functions na Vercel para identificar a falha.",
      );
    }
    return app(req, res);
  };
}
