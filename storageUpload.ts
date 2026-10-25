export async function uploadStorageImage(
  body: { image?: unknown; path?: unknown },
  user: { id: string; role: string },
  token: string,
  bucket: string,
  request: typeof fetch = fetch,
) {
  const path = typeof body.path === "string" ? body.path : "";
  const name = "[a-zA-Z0-9_-]+";
  const escapedUid = user.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const owned = new RegExp(
    `^users/${escapedUid}/(?:wheelPhotos|projects/${name})/${name}\\.(png|jpg|webp)$`,
  ).test(path);
  const shared =
    user.role === "master" &&
    new RegExp(`^catalog/${escapedUid}/${name}\\.(png|jpg|webp)$`).test(path);
  const match =
    typeof body.image === "string" &&
    body.image.length <= 3500000 &&
    body.image.match(
      /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/,
    );
  if ((!owned && !shared) || !match)
    return {
      status: 400,
      body: { error: "Arquivo ou destino de imagem inválido." },
    };
  const response = await request(
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(path)}`,
    {
      method: "POST",
      headers: { Authorization: "Firebase " + token, "Content-Type": match[1] },
      body: Buffer.from(match[2], "base64"),
      signal: AbortSignal.timeout(25000),
    },
  );
  if (!response.ok) {
    const status = response.status;
    console.error("STORAGE_UPLOAD_FAILURE", { status });
    const error =
      status === 404
        ? "O bucket de fotos não foi encontrado. No Firebase, abra Storage e confira se o bucket carros-ed674.firebasestorage.app está criado."
        : status === 401 || status === 403
          ? "O Firebase recusou o envio da foto. Publique as regras de Storage do app e autorize a consulta ao Firestore se o console solicitar."
          : status === 429
            ? "O armazenamento atingiu um limite de uso. Confira as cotas e o faturamento do Firebase."
            : "O armazenamento está indisponível. A foto tratada foi mantida; tente salvar novamente.";
    return {
      status:
        status === 404 ? 503 : status === 401 || status === 403 ? 403 : 503,
      body: { error },
    };
  }
  const metadata = (await response.json()) as {
    downloadTokens?: string;
    name?: string;
  };
  if (metadata.name !== path || !metadata.downloadTokens)
    return {
      status: 502,
      body: {
        error:
          "O Storage recebeu o arquivo, mas não retornou o acesso à imagem. Confira a configuração do bucket.",
      },
    };
  return {
    status: 200,
    body: {
      image: `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media&token=${encodeURIComponent(metadata.downloadTokens.split(",")[0])}`,
    },
  };
}
