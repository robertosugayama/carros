// Fetch Storage photos through our own origin so canvas can safely compose them
// even when the bucket does not expose browser CORS headers.
const sources = new Map<string, Promise<string>>();
export async function canvasImageSource(source: string): Promise<string> {
  if (!source.startsWith("https://firebasestorage.googleapis.com/"))
    return source;
  let pending = sources.get(source);
  if (!pending) {
    pending = (async () => {
      const { auth } = await import("./firebase");
      await auth.authStateReady();
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/storage/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: JSON.stringify({ image: source }),
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) {
        let error = "Não foi possível carregar a roda salva.";
        try {
          error = (await response.json()).error || error;
        } catch {}
        throw Error(error);
      }
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () =>
          reject(Error("Não foi possível ler a foto da roda."));
        reader.readAsDataURL(blob);
      });
    })();
    sources.set(source, pending);
    pending.catch(() => sources.delete(source));
    if (sources.size > 30) sources.delete(sources.keys().next().value!);
  }
  return pending;
}
