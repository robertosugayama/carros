import sharp from "sharp";
import { WheelPreparationError } from "./aiErrors.ts";
export type WheelGeometry = {
  found: boolean;
  confidence: number;
  bounds: number[];
  holes: number[][][];
};
// Coordinates are normalized to the complete AI image; never trust model JSON as SVG.
export async function extractWheelFace(image: Buffer, geometry: WheelGeometry) {
  const b = geometry?.bounds;
  if (
    geometry?.found !== true ||
    !Number.isFinite(geometry.confidence) ||
    geometry.confidence < 0.8 ||
    !Array.isArray(b) ||
    b.length !== 4 ||
    !b.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)
  )
    throw new WheelPreparationError(
      "A IA não localizou uma roda inteira com segurança. Envie uma foto nítida de uma única roda.",
    );
  const [left, top, right, bottom] = b;
  if (
    right - left < 0.15 ||
    bottom - top < 0.15 ||
    (right - left) / (bottom - top) < 0.5 ||
    (right - left) / (bottom - top) > 2
  )
    throw new WheelPreparationError(
      "A IA não identificou o contorno completo da roda.",
    );
  const { width, height } = await sharp(image).metadata();
  const x = Math.floor(left * width!),
    y = Math.floor(top * height!);
  const w = Math.min(width! - x, Math.ceil((right - left) * width!));
  const h = Math.min(height! - y, Math.ceil((bottom - top) * height!));
  const holes = geometry.holes;
  if (
    !Array.isArray(holes) ||
    holes.length > 40 ||
    holes.some(
      (p) =>
        !Array.isArray(p) ||
        p.length < 3 ||
        p.length > 40 ||
        p.some(
          (q) =>
            !Array.isArray(q) ||
            q.length !== 2 ||
            !q.every((v) => Number.isFinite(v) && v >= 0 && v <= 1) ||
            q[0] < left ||
            q[0] > right ||
            q[1] < top ||
            q[1] > bottom,
        ),
    )
  )
    throw new WheelPreparationError(
      "A IA devolveu um recorte inválido. Tente outra foto da roda.",
    );
  const paths = holes
    .map(
      (p) =>
        `M ${p.map(([px, py]) => `${(((px - left) / (right - left)) * 800).toFixed(2)},${(((py - top) / (bottom - top)) * 800).toFixed(2)}`).join(" L ")} Z`,
    )
    .join(" ");
  const mask = Buffer.from(
    `<svg width="800" height="800"><path fill="white" fill-rule="evenodd" d="M 400,0 A 400,400 0 1 1 399.999,0 Z ${paths}"/></svg>`,
  );
  const extracted = await sharp(image)
    .extract({ left: x, top: y, width: w, height: h })
    .resize(800, 800, { fit: "fill" })
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
  const stats = await sharp(extracted).stats();
  if (stats.channels[3].mean < 35)
    throw new WheelPreparationError(
      "A IA não conseguiu preservar a roda no recorte.",
    );
  return extracted;
}
