// Restrict reads to this app's bucket and paths; never proxy arbitrary URLs.
export async function readStorageImage(
  source: unknown,
  bucket: string,
  token: string | undefined,
  verify: (token: string) => Promise<{ uid: string }>,
  request: typeof fetch = fetch,
) {
  let path: string;
  try {
    if (typeof source !== "string" || source.length > 2500) throw Error();
    const url = new URL(source);
    const prefix = `/v0/b/${bucket}/o/`;
    if (
      url.protocol !== "https:" ||
      url.hostname !== "firebasestorage.googleapis.com" ||
      url.port ||
      url.username ||
      url.password ||
      !url.pathname.startsWith(prefix)
    )
      throw Error();
    path = decodeURIComponent(url.pathname.slice(prefix.length));
    if (
      path.split("/").some((p) => !p || p === "." || p === "..") ||
      !path.match(/^(catalog|users)\/[A-Za-z0-9_-]+\//)
    )
      throw Error();
  } catch {
    return { status: 400, error: "Endereço de imagem inválido." };
  }
  const shared = path.startsWith("catalog/");
  if (!shared) {
    if (!token)
      return { status: 401, error: "Entre na sua conta para ver esta roda." };
    try {
      const user = await verify(token);
      if (path.split("/")[1] !== user.uid)
        return { status: 403, error: "Esta imagem pertence a outra conta." };
    } catch {
      return { status: 401, error: "Entre novamente para carregar sua roda." };
    }
  }
  const response = await request(
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media`,
    {
      headers: !shared ? { Authorization: "Firebase " + token } : {},
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    return {
      status: response.status === 404 ? 404 : 403,
      error:
        response.status === 404
          ? "A foto salva não foi encontrada no armazenamento."
          : "O Storage não permitiu ler esta foto. Confira as regras de acesso.",
    };
  const type = response.headers.get("Content-Type")?.split(";")[0] || "";
  if (!["image/png", "image/jpeg", "image/webp"].includes(type))
    return {
      status: 422,
      error: "O arquivo salvo não é uma imagem compatível.",
    };
  const reader = response.body?.getReader();
  if (!reader) return { status: 502, error: "A imagem salva está vazia." };
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 4 * 1024 * 1024) {
      await reader.cancel();
      return {
        status: 413,
        error: "A imagem salva excede o limite de tamanho.",
      };
    }
    chunks.push(part.value);
  }
  if (!size) return { status: 502, error: "A imagem salva está vazia." };
  return { status: 200, type, data: Buffer.concat(chunks) };
}
