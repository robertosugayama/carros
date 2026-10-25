import { WheelPreparationError } from "./aiErrors.ts";

// The model may ignore the chroma-key instruction. For a uniform alternative
// background, remove only matching pixels connected to the image perimeter.
export function removeWheelBackground(
  pixels: Buffer,
  width: number,
  height: number,
) {
  const count = width * height;
  const border: number[] = [];
  for (let x = 0; x < width; x++) {
    border.push(x, (height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    border.push(y * width, y * width + width - 1);
  }
  const hasTransparentBorder =
    border.filter((p) => pixels[p * 4 + 3] < 10).length > border.length * 0.8;
  const keyedBorder =
    border.filter((p) => {
      const i = p * 4;
      return (
        pixels[i] > 140 &&
        pixels[i + 2] > 140 &&
        Math.min(pixels[i], pixels[i + 2]) - pixels[i + 1] > 65
      );
    }).length >
    border.length * 0.7;
  if (keyedBorder) {
    for (let i = 0; i < pixels.length; i += 4) {
      const chroma = Math.min(pixels[i], pixels[i + 2]) - pixels[i + 1];
      if (pixels[i] > 140 && pixels[i + 2] > 140 && chroma > 65)
        pixels[i + 3] = Math.round(
          pixels[i + 3] * (1 - Math.min(1, (chroma - 65) / 55)),
        );
    }
  } else if (!hasTransparentBorder) {
    const channel = (c: number) =>
      border.map((p) => pixels[p * 4 + c]).sort((a, b) => a - b)[
        Math.floor(border.length / 2)
      ];
    const background = [channel(0), channel(1), channel(2)];
    const matches = (p: number) =>
      pixels[p * 4 + 3] < 10 ||
      background.every((v, c) => Math.abs(pixels[p * 4 + c] - v) <= 28);
    const consistent = border.filter(matches).length / border.length;
    if (consistent < 0.9)
      throw new WheelPreparationError(
        "A imagem voltou com um fundo complexo que não pôde ser removido com segurança. Tente outra foto de uma única roda.",
      );
    const visited = new Uint8Array(count),
      queue = new Uint32Array(count);
    let head = 0,
      tail = 0;
    const add = (p: number) => {
      if (!visited[p]) {
        visited[p] = 1;
        if (matches(p)) queue[tail++] = p;
      }
    };
    border.forEach(add);
    while (head < tail) {
      const p = queue[head++];
      pixels[p * 4 + 3] = 0;
      const x = p % width;
      if (x > 0) add(p - 1);
      if (x + 1 < width) add(p + 1);
      if (p >= width) add(p - width);
      if (p + width < count) add(p + width);
    }
  }
  let transparent = 0,
    foreground = 0;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] < 10) transparent++;
    if (pixels[i] > 128) foreground++;
  }
  if (transparent < count * 0.005 || foreground < count * 0.05)
    throw new WheelPreparationError(
      "A IA não separou a roda do fundo corretamente. Tente outra foto mais nítida de uma única roda.",
    );
}
