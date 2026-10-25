export async function parseApiResponse(response: Response) {
  let data: any;
  try {
    data = JSON.parse(await response.text());
  } catch {
    if (response.status >= 500)
      throw Error(
        `O servidor está indisponível (HTTP ${response.status}). Verifique a implantação e as configurações do aplicativo na Vercel.`,
      );
    if (response.status === 404)
      throw Error(
        "O serviço do aplicativo não foi encontrado. Confira se a Vercel publicou a versão atual da API.",
      );
    throw Error(
      "O servidor retornou uma resposta inesperada. Atualize a página e tente novamente.",
    );
  }
  if (!response.ok)
    throw Error(
      typeof data?.error === "string"
        ? data.error
        : `Não foi possível concluir a operação (HTTP ${response.status}).`,
    );
  if (!data || typeof data !== "object")
    throw Error("O servidor retornou dados inesperados. Tente novamente.");
  return data;
}
export async function api(path: string, body?: unknown, method?: string) {
  const firebase = import.meta.env.VITE_DATA_PROVIDER !== "legacy";
  if (firebase && path !== "status" && !path.startsWith("gemini/"))
    return (await import("./firebaseApi")).firebaseApi(path, body, method);
  const token =
    firebase && path.startsWith("gemini/")
      ? await (await import("./firebaseApi")).firebaseToken()
      : undefined;
  let response: Response;
  try {
    response = await fetch("/api/" + path, {
      method: method || (body ? "POST" : "GET"),
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Error(
      "Não foi possível acessar o servidor. Verifique a conexão e tente novamente.",
    );
  }
  return parseApiResponse(response);
}
