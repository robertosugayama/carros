import { canvasImageSource } from "./imageSource";
import type { WheelPhoto } from "./PhotoCatalog";
export const generatedPhotos: WheelPhoto[] = [
  {
    id: -1,
    model: 18,
    finish: 1,
    size: 18,
    image: "/wheels/silver-split-rim.png",
    kind: "rim",
    origin: "generated",
    credit: "AutoTuner • imagem gerada por IA",
    source: "https://github.com/robertosugayama/carros#imagens-geradas-por-ia",
  },
  {
    id: -2,
    model: 19,
    finish: 3,
    size: 18,
    image: "/wheels/graphite-six-rim.png",
    kind: "rim",
    origin: "generated",
    credit: "AutoTuner • imagem gerada por IA",
    source: "https://github.com/robertosugayama/carros#imagens-geradas-por-ia",
  },
  {
    id: -3,
    model: 20,
    finish: 4,
    size: 18,
    image: "/wheels/bronze-mesh-rim.png",
    kind: "rim",
    origin: "generated",
    credit: "AutoTuner • imagem gerada por IA",
    source: "https://github.com/robertosugayama/carros#imagens-geradas-por-ia",
  },
];
export function mergePhotos(remote: WheelPhoto[]) {
  return [
    ...remote,
    ...generatedPhotos.filter(
      (g) =>
        !remote.some(
          (p) =>
            p.model === g.model && p.finish === g.finish && p.size === g.size,
        ),
    ),
  ];
}
export async function inlinePhoto(image: string): Promise<string> {
  if (image.startsWith("data:")) return image;
  if (image.startsWith("https://firebasestorage.googleapis.com/"))
    return canvasImageSource(image);
  if (
    import.meta.env.VITE_FIREBASE_EMULATORS === "true" &&
    image.startsWith("http://127.0.0.1:9199/")
  ) {
    const response = await fetch(image);
    if (!response.ok)
      throw Error("Não foi possível carregar a imagem do Firebase Storage.");
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  if (!image.startsWith("/wheels/"))
    throw Error("Imagem de catálogo inválida.");
  const img = new Image();
  img.src = image;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = 800;
  c.height = 800;
  c.getContext("2d")!.drawImage(img, 0, 0, 800, 800);
  const result = c.toDataURL("image/webp", 0.88);
  if (result.length > 900000)
    throw Error("A imagem excedeu o limite do projeto.");
  return result;
}
