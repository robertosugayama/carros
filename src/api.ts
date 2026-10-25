export async function parseApiResponse(response: Response) {
  let data: any;
  try {
    data = JSON.parse(await response.text());
  } catch {
    if (response.status >= 500)
      throw Error(
        `O servidor está indisponível (HTTP ${response.status}). Verifique a implantação e a configuração do banco de dados na Vercel.`,
      );
    if (response.status === 404)
      throw Error(
        "O serviço de cadastro não foi encontrado. Confira se a Vercel publicou a versão atual da API.",
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
  let response: Response;
  try {
    response = await fetch("/api/" + path, {
      method: method || (body ? "POST" : "GET"),
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Error(
      "Não foi possível acessar o servidor. Verifique a conexão e tente novamente.",
    );
  }
  return parseApiResponse(response);
}
