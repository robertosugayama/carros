import { canvasImageSource } from "./imageSource";
import type { WheelPhoto } from "./PhotoCatalog";
import { calipers } from "./catalog";
import { recolorPixel, wheelImage, type DiscStyle } from "./brakeImages";
import { tyreRimRatio, brakeRimRatio, type TyreProfile } from "./tyres";
const images = new Map<string, Promise<HTMLImageElement>>();
function load(source: string) {
  let result = images.get(source);
  if (!result) {
    result = (async () => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = await canvasImageSource(source);
      await image.decode();
      return image;
    })();
    images.set(source, result);
    if (images.size > 30) images.delete(images.keys().next().value!);
    result.catch(() => images.delete(source));
  }
  return result;
}
const composites = new Map<string, Promise<string>>();
function canvas() {
  const c = document.createElement("canvas");
  c.width = c.height = 800;
  return c;
}
const tyres = new Map<string, Promise<HTMLCanvasElement>>();
function tyreTexture(ratio: number) {
  const key = ratio.toFixed(4);
  if (!tyres.has(key)) {
    const result = (async () => {
      const image = await load("/wheels/tyre-texture.png");
      const source = canvas(),
        s = source.getContext("2d")!;
      s.drawImage(image, 0, 0, 800, 800);
      const pixels = s.getImageData(0, 0, 800, 800).data;
      // Measure the actual aperture in the generated texture, rather than assume
      // that a generation prompt produced a precise inner diameter.
      let inner = 0,
        outer = 399;
      for (let r = 10; r < 400; r++) {
        let hits = 0;
        for (let a = 0; a < 16; a++) {
          const angle = (a * Math.PI) / 8;
          const x = Math.round(399.5 + Math.cos(angle) * r),
            y = Math.round(399.5 + Math.sin(angle) * r);
          if (pixels[(y * 800 + x) * 4 + 3] > 128) hits++;
        }
        if (hits >= 12) {
          inner = r;
          break;
        }
      }
      for (let r = 399; r > inner; r--) {
        let hits = 0;
        for (let a = 0; a < 16; a++) {
          const angle = (a * Math.PI) / 8;
          const x = Math.round(399.5 + Math.cos(angle) * r),
            y = Math.round(399.5 + Math.sin(angle) * r);
          if (pixels[(y * 800 + x) * 4 + 3] > 128) hits++;
        }
        if (hits >= 12) {
          outer = r;
          break;
        }
      }
      const out = canvas(),
        ctx = out.getContext("2d")!,
        data = ctx.createImageData(800, 800),
        rim = 400 * ratio;
      for (let y = 0; y < 800; y++)
        for (let x = 0; x < 800; x++) {
          const dx = x - 399.5,
            dy = y - 399.5,
            r = Math.hypot(dx, dy);
          if (r > 399.5 || r < rim - 2) continue;
          const sr =
            inner + Math.max(0, (r - rim) / (399.5 - rim)) * (outer - inner);
          const sx = Math.max(
              0,
              Math.min(799, Math.round(399.5 + (dx / r) * sr)),
            ),
            sy = Math.max(0, Math.min(799, Math.round(399.5 + (dy / r) * sr)));
          const i = (y * 800 + x) * 4,
            j = (sy * 800 + sx) * 4;
          data.data[i] = pixels[j];
          data.data[i + 1] = pixels[j + 1];
          data.data[i + 2] = pixels[j + 2];
          data.data[i + 3] = Math.round(pixels[j + 3] * Math.min(1, 399.5 - r));
        }
      ctx.putImageData(data, 0, 0);
      return out;
    })();
    tyres.set(key, result);
    result.catch(() => tyres.delete(key));
    if (tyres.size > 30) tyres.delete(tyres.keys().next().value!);
  }
  return tyres.get(key)!;
}
export function assembledWheelImage(
  photo: WheelPhoto,
  size: number,
  profile: TyreProfile,
  caliper = 4,
  style: DiscStyle = "drilled",
) {
  // Upgrade the app's original saved photographic assemblies to separated layers.
  if (
    typeof photo.id === "number" &&
    photo.id < 0 &&
    [18, 19, 20].includes(Number(photo.model))
  ) {
    const names = ["silver-split", "graphite-six", "bronze-mesh"];
    photo = {
      ...photo,
      kind: "rim",
      image: "/wheels/" + names[Number(photo.model) - 18] + "-rim.png",
    };
  }
  const key = JSON.stringify([
    photo.image,
    photo.kind,
    photo.solidImage,
    size,
    profile,
    caliper,
    style,
  ]);
  let result = composites.get(key);
  if (!result) {
    result = (async () => {
      const ratio = tyreRimRatio(size, profile),
        rimDiameter = 800 * ratio,
        edge = (800 - rimDiameter) / 2;
      const [rim, tyre] = await Promise.all([
        load(
          photo.kind === "rim"
            ? photo.image
            : await wheelImage(photo, caliper, style),
        ),
        tyreTexture(ratio),
      ]);
      const c = canvas(),
        ctx = c.getContext("2d")!;
      ctx.drawImage(tyre, 0, 0);
      ctx.save();
      ctx.beginPath();
      ctx.arc(400, 400, rimDiameter / 2, 0, 2 * Math.PI);
      ctx.clip();
      ctx.fillStyle = "#111315";
      ctx.fillRect(edge, edge, rimDiameter, rimDiameter);
      if (photo.kind === "rim") {
        const brake = await load("/wheels/brake-rotor.png"),
          layer = canvas(),
          b = layer.getContext("2d")!;
        b.drawImage(brake, 0, 0, 800, 800);
        const data = b.getImageData(0, 0, 800, 800);
        for (let i = 0; i < data.data.length; i += 4) {
          const d = data.data;
          if (d[i] > d[i + 1] * 1.6 && d[i] > d[i + 2] * 1.4 && d[i] > 70) {
            const color = recolorPixel(
              d[i],
              d[i + 1],
              d[i + 2],
              calipers[caliper]?.[1] || "#ed383a",
            );
            d[i] = color[0];
            d[i + 1] = color[1];
            d[i + 2] = color[2];
          }
        }
        b.putImageData(data, 0, 0);
        const rotor = rimDiameter * brakeRimRatio(size),
          plate = rotor / 0.93;
        ctx.drawImage(layer, 400 - plate / 2, 400 - plate / 2, plate, plate);
        if (style === "drilled") {
          ctx.fillStyle = "#1b1e20";
          for (let row = 0; row < 2; row++)
            for (let n = 0; n < 24; n++) {
              const angle = (n * Math.PI) / 12 + row * 0.09,
                radius = rotor * (0.32 + row * 0.1);
              // Keep drilling behind the photographed caliper on the right.
              if (Math.cos(angle) > 0.72) continue;
              ctx.beginPath();
              ctx.arc(
                400 + Math.cos(angle) * radius,
                400 + Math.sin(angle) * radius,
                Math.max(1, rotor * 0.008),
                0,
                Math.PI * 2,
              );
              ctx.fill();
            }
        }
        ctx.drawImage(rim, edge, edge, rimDiameter, rimDiameter);
      } else {
        // Older saved assembly photos already contain brakes and a tire.
        // Extract their metal face so the new sidewall replaces the old tire.
        const inset = rim.width * 0.085,
          face = rim.width - inset * 2;
        ctx.drawImage(
          rim,
          inset,
          inset,
          face,
          face,
          edge,
          edge,
          rimDiameter,
          rimDiameter,
        );
      }
      ctx.restore();
      return c.toDataURL("image/png");
    })();
    composites.set(key, result);
    result.catch(() => composites.delete(key));
    if (composites.size > 16)
      composites.delete(composites.keys().next().value!);
  }
  return result;
}
