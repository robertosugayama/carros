import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { editWheelImage } from "../imageEditing.ts";
import { recolorPixel, hexHue } from "../src/brakeImages.ts";
test("tratamento valida entrada, envia imagem e gera WebP com transparência usando resposta simulada", async () => {
  const png = await sharp({
    create: {
      width: 20,
      height: 20,
      channels: 4,
      background: { r: 180, g: 30, b: 30, alpha: 0.6 },
    },
  })
    .png()
    .toBuffer();
  const data = "data:image/png;base64," + png.toString("base64");
  let called = 0;
  const output = await editWheelImage(
    data,
    { action: "brakes", kind: "assembly", caliper: 5, discStyle: "solid" },
    async (request) => {
      called++;
      assert.ok(
        JSON.stringify(request.contents).includes("WITHOUT ANY drilled holes"),
      );
      assert.ok(JSON.stringify(request.contents).includes("#2585e8"));
      return {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: png.toString("base64"),
                  },
                },
              ],
            },
          },
        ],
      };
    },
  );
  assert.equal(called, 1);
  assert.ok(output.startsWith("data:image/webp;base64,"));
  const m = await sharp(Buffer.from(output.split(",")[1], "base64")).metadata();
  assert.equal(m.width, 800);
  assert.ok(m.hasAlpha);
  await assert.rejects(() =>
    editWheelImage(
      "data:image/png;base64,invalid",
      { action: "prepare", kind: "rim" },
      async () => {
        throw Error("Não deve chamar serviço para arquivo inválido");
      },
    ),
  );
});
test("cor da pinça conserva relação de sombra e mapeia para o azul escolhido", () => {
  const light = recolorPixel(220, 30, 30, "#2585e8"),
    dark = recolorPixel(80, 10, 10, "#2585e8");
  assert.ok(light[2] > light[0]);
  assert.ok(light[2] > dark[2]);
  assert.equal(hexHue("#ff0000"), 0);
  assert.equal(hexHue("#0000ff"), 240);
});
