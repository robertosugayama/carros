import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { editWheelImage } from "../imageEditing.ts";
import { extractWheelFace } from "../wheelExtraction.ts";

test("pipeline extrai roda em fundo complexo com localização visual, centraliza e remove vãos", async () => {
  const input = await sharp(
    Buffer.from(
      '<svg width="300" height="200"><rect width="300" height="200" fill="#2a8b9a"/><rect width="300" height="100" fill="#dfba44"/><ellipse cx="150" cy="100" rx="90" ry="80" fill="#777"/><rect x="140" y="40" width="20" height="20" fill="#dfba44"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  let calls = 0;
  const result = await editWheelImage(
    "data:image/png;base64," + input.toString("base64"),
    { action: "prepare", kind: "rim" },
    async (request) => {
      calls++;
      if (calls === 1)
        return {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: input.toString("base64"),
                    },
                  },
                ],
              },
            },
          ],
        };
      assert.equal(request.model, "gemini-flash-latest");
      assert.equal(request.config?.responseMimeType, "application/json");
      return {
        text: JSON.stringify({
          found: true,
          confidence: 0.96,
          bounds: [0.2, 0.1, 0.8, 0.9],
          holes: [
            [
              [0.47, 0.2],
              [0.53, 0.2],
              [0.53, 0.3],
              [0.47, 0.3],
            ],
          ],
        }),
      };
    },
  );
  assert.equal(calls, 2);
  const { data, info } = await sharp(
    Buffer.from(result.split(",")[1], "base64"),
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 800);
  assert.equal(info.height, 800);
  assert.equal(data[3], 0, "remove fundo complexo nos cantos");
  assert.equal(data[(400 * 800 + 400) * 4 + 3], 255, "preserva cubo e metal");
  assert.equal(data[(140 * 800 + 400) * 4 + 3], 0, "recorta fundo entre raios");
});

test("extração rejeita localização incerta e polígonos inválidos", async () => {
  const image = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "#888" },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    () =>
      extractWheelFace(image, {
        found: true,
        confidence: 0.3,
        bounds: [0, 0, 1, 1],
        holes: [],
      }),
    /segurança/,
  );
  await assert.rejects(
    () =>
      extractWheelFace(image, {
        found: true,
        confidence: 0.95,
        bounds: [0, 0, 1, 1],
        holes: [
          [
            [0, 0],
            [1, 0],
            [NaN, 1],
          ],
        ],
      }),
    /inválido/,
  );
});

test("limpeza remove sombra roxa escura exterior e mantém detalhe roxo interno", async () => {
  const { removeExteriorPurple } = await import("../wheelBackground.ts");
  const png = await sharp(
    Buffer.from(
      '<svg width="100" height="100"><circle cx="50" cy="45" r="35" fill="#555"/><circle cx="50" cy="45" r="8" fill="#950095"/><rect x="20" y="80" width="60" height="8" fill="#750078"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  removeExteriorPurple(data, info.width, info.height);
  assert.equal(data[(84 * 100 + 50) * 4 + 3], 0);
  assert.equal(data[(45 * 100 + 50) * 4 + 3], 255);
  assert.equal(data[(45 * 100 + 50) * 4], 149);
});

test("remove rosa e roxo escuro em vãos internos sem alterar metal cinza e bronze", async () => {
  const { removeChromaMatte } = await import("../wheelBackground.ts");
  const pixels = Buffer.from([
    196, 48, 130, 255, 117, 12, 105, 255, 90, 90, 90, 255, 160, 115, 65, 255,
  ]);
  removeChromaMatte(pixels);
  assert.equal(pixels[3], 0);
  assert.equal(pixels[7], 0);
  assert.equal(pixels[11], 255);
  assert.equal(pixels[15], 255);
  assert.deepEqual(
    [...pixels.subarray(8)],
    [90, 90, 90, 255, 160, 115, 65, 255],
  );
});
