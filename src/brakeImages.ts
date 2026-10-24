import type { WheelPhoto } from "./PhotoCatalog";
import { calipers } from "./catalog";
export type DiscStyle = "drilled" | "solid";
export function hasDiscStyle(photo: WheelPhoto, style: DiscStyle) {
  return (
    style === (photo.discStyle || "drilled") ||
    (style === "solid" && !!photo.solidImage)
  );
}
const cache = new Map<string, Promise<string>>();
export function hexHue(hex: string) {
  const v = hex.replace("#", ""),
    r = parseInt(v.slice(0, 2), 16) / 255,
    g = parseInt(v.slice(2, 4), 16) / 255,
    b = parseInt(v.slice(4, 6), 16) / 255,
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  if (d === 0) return 0;
  return (
    ((max === r
      ? (g - b) / d + (g < b ? 6 : 0)
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4) *
      60) %
    360
  );
}
export function recolorPixel(r: number, g: number, b: number, target: string) {
  const t = [1, 3, 5].map((i) => parseInt(target.slice(i, i + 2), 16));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const base = 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2];
  const shade = Math.min(1.6, Math.max(0.25, lum / 140));
  const highlight = Math.max(0, lum - 185) * 0.6;
  return t.map((c) =>
    Math.round(
      Math.max(
        0,
        Math.min(
          255,
          (c * (0.35 + shade * 0.65) + highlight) * (base < 55 ? 0.8 : 1),
        ),
      ),
    ),
  );
}
export function wheelImage(
  photo: WheelPhoto,
  caliper?: number,
  style: DiscStyle = "drilled",
): Promise<string> {
  if (!hasDiscStyle(photo, style))
    return Promise.reject(
      Error("Essa fotografia precisa ser tratada por IA para mudar o disco."),
    );
  const image =
    style === "solid" && photo.solidImage ? photo.solidImage : photo.image;
  if (caliper === undefined || photo.caliperHue === undefined)
    return Promise.resolve(image);
  const target = calipers[caliper]?.[1];
  if (!target) return Promise.resolve(image);
  const key = image + "|" + photo.caliperHue + "|" + target;
  const found = cache.get(key);
  if (found) return found;
  const promise = (async () => {
    const img = new Image();
    img.src = image;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = 800;
    c.height = 800;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, 800, 800);
    const pixels = ctx.getImageData(0, 0, 800, 800),
      d = pixels.data;
    for (let y = 100; y < 700; y++)
      for (let x = 400; x < 735; x++) {
        const i = (y * 800 + x) * 4;
        if (d[i + 3] < 30) continue;
        const r = d[i] / 255,
          g = d[i + 1] / 255,
          b = d[i + 2] / 255,
          max = Math.max(r, g, b),
          min = Math.min(r, g, b),
          delta = max - min;
        if (delta < 0.08 || max === 0 || delta / max < 0.3) continue;
        const hue =
          ((max === r
            ? (g - b) / delta + (g < b ? 6 : 0)
            : max === g
              ? (b - r) / delta + 2
              : (r - g) / delta + 4) *
            60) %
          360;
        const difference = Math.abs(hue - photo.caliperHue!);
        if (Math.min(difference, 360 - difference) > 24) continue;
        const color = recolorPixel(d[i], d[i + 1], d[i + 2], target);
        d[i] = color[0];
        d[i + 1] = color[1];
        d[i + 2] = color[2];
      }
    ctx.putImageData(pixels, 0, 0);
    return c.toDataURL("image/webp", 0.9);
  })();
  cache.set(key, promise);
  if (cache.size > 30) cache.delete(cache.keys().next().value!);
  promise.catch(() => cache.delete(key));
  return promise;
}
