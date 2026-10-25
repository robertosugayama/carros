import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { createApiHandler } from "../apiRuntime.ts";
import { parseApiResponse } from "../src/api.ts";
async function withHandler(
  handler: ReturnType<typeof createApiHandler>,
  run: (base: string) => Promise<void>,
) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as { port: number };
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
test("cadastro sem banco na Vercel recebe JSON claro antes de importar aplicação", async () => {
  let loaded = false;
  await withHandler(
    createApiHandler(
      async () => {
        loaded = true;
        throw Error("Não deve carregar sem banco");
      },
      () => ({ VERCEL: "1" }),
    ),
    async (base) => {
      const r = await fetch(base + "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Teste" }),
      });
      assert.equal(r.status, 503);
      assert.equal(
        r.headers.get("content-type"),
        "application/json; charset=utf-8",
      );
      const body = await r.json();
      assert.equal(body.code, "DATABASE_NOT_CONFIGURED");
      assert.match(body.error, /TURSO_DATABASE_URL/);
      assert.equal(loaded, false);
    },
  );
});
test("URL inválida e falha de inicialização nunca retornam HTML nem expõem segredos", async () => {
  const env = {
    VERCEL: "1",
    TURSO_DATABASE_URL: "invalid",
    TURSO_AUTH_TOKEN: "test-only-token",
  };
  await withHandler(
    createApiHandler(
      async () => {
        throw Error("not loaded");
      },
      () => env,
    ),
    async (base) => {
      assert.equal(
        (await (await fetch(base)).json()).code,
        "INVALID_DATABASE_URL",
      );
    },
  );
  const logs: unknown[] = [];
  await withHandler(
    createApiHandler(
      async () => {
        throw Object.assign(Error("secret-value-not-to-log"), {
          name: "LibsqlError",
          code: "SERVER_ERROR",
        });
      },
      () => ({ ...env, TURSO_DATABASE_URL: "libsql://test.invalid" }),
      (...args) => logs.push(args),
    ),
    async (base) => {
      const r = await fetch(base);
      assert.equal(r.status, 503);
      const body = await r.text();
      assert.ok(body.includes("DATABASE_CONNECTION_FAILED"));
      assert.ok(!body.includes("secret-value-not-to-log"));
    },
  );
  assert.ok(!JSON.stringify(logs).includes("secret-value-not-to-log"));
  assert.ok(!JSON.stringify(logs).includes("test-only-token"));
});
test("guard encaminha o caminho original e carrega a aplicação uma única vez", async () => {
  let loads = 0;
  await withHandler(
    createApiHandler(
      async () => {
        loads++;
        return {
          default: (req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ path: req.url }));
          },
        };
      },
      () => ({
        VERCEL: "1",
        TURSO_DATABASE_URL: "libsql://test.invalid",
        TURSO_AUTH_TOKEN: "test-only-token",
      }),
    ),
    async (base) => {
      assert.equal(
        (await (await fetch(base + "/api/auth/register")).json()).path,
        "/api/auth/register",
      );
      await fetch(base + "/api/me");
      assert.equal(loads, 1);
    },
  );
});
test("frontend trata texto de erro da Vercel sem mostrar Unexpected token", async () => {
  await assert.rejects(
    () =>
      parseApiResponse(
        new Response("A server error has occurred", { status: 500 }),
      ),
    /servidor está indisponível/,
  );
  await assert.rejects(
    () =>
      parseApiResponse(new Response("<html>Not found</html>", { status: 404 })),
    /não foi encontrado/,
  );
  await assert.rejects(
    () =>
      parseApiResponse(
        new Response(JSON.stringify({ error: "Banco não configurado" }), {
          status: 503,
        }),
      ),
    /Banco não configurado/,
  );
  assert.deepEqual(
    await parseApiResponse(
      new Response(JSON.stringify({ role: "user" }), { status: 200 }),
    ),
    { role: "user" },
  );
});
