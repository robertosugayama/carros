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

test("preparo corrige perspectiva com foto inteira e normaliza contorno transparente", async () => {
  const input = await sharp({
    create: { width: 320, height: 180, channels: 3, background: "#888" },
  })
    .png()
    .toBuffer();
  const wheel = await sharp({
    create: { width: 100, height: 100, channels: 4, background: "#808080" },
  })
    .extend({
      top: 40,
      bottom: 40,
      left: 40,
      right: 40,
      background: "#00000000",
    })
    .png()
    .toBuffer();
  const output = await editWheelImage(
    "data:image/png;base64," + input.toString("base64"),
    { action: "prepare", kind: "rim" },
    async (request) => {
      const prompt = JSON.stringify(request.contents);
      assert.match(prompt, /correct camera perspective/);
      assert.match(prompt, /Extract ONLY the metal rim/);
      assert.match(prompt, /exact product identity/);
      return {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: wheel.toString("base64"),
                  },
                },
              ],
            },
          },
        ],
      };
    },
  );
  const metadata = await sharp(
    Buffer.from(output.split(",")[1], "base64"),
  ).metadata();
  assert.equal(metadata.width, 800);
  assert.equal(metadata.height, 800);
  const stats = await sharp(
    Buffer.from(output.split(",")[1], "base64"),
  ).stats();
  assert.ok(
    stats.channels[0].mean > 110,
    "empty alpha margins should be removed before resizing",
  );
  await assert.rejects(
    () =>
      editWheelImage(
        "data:image/png;base64," + input.toString("base64"),
        { action: "prepare", kind: "rim" },
        async () => ({
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
        }),
      ),
    /localizou uma roda inteira/,
  );
});

test("preparo remove fundo magenta de resposta opaca e preserva cinza da roda", async () => {
  const png = await sharp(
    Buffer.from(
      '<svg width="200" height="200"><rect width="200" height="200" fill="#ff00ff"/><circle cx="100" cy="100" r="80" fill="#808080"/><circle cx="100" cy="100" r="10" fill="#ff00ff"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  const output = await editWheelImage(
    "data:image/png;base64," + png.toString("base64"),
    { action: "prepare", kind: "rim" },
    async () => ({
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
    }),
  );
  const { data, info } = await sharp(
    Buffer.from(output.split(",")[1], "base64"),
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 800);
  assert.equal(data[3], 0);
  const middle = (400 * info.width + 400) * 4;
  assert.equal(data[middle + 3], 0, "remove o fundo também no furo central");
  const spoke = (400 * info.width + 600) * 4;
  assert.equal(data[spoke + 3], 255);
  assert.ok(Math.abs(data[spoke] - data[spoke + 1]) < 8);
});

test("preparo aceita fundo branco ou cinza uniforme sem apagar detalhes claros isolados", async () => {
  for (const background of ["#ffffff", "#dddddd", "#227799"]) {
    const png = await sharp(
      Buffer.from(
        `<svg width="200" height="200"><rect width="200" height="200" fill="${background}"/><circle cx="100" cy="100" r="80" fill="#444444"/><circle cx="100" cy="100" r="20" fill="#ffffff"/></svg>`,
      ),
    )
      .png()
      .toBuffer();
    const output = await editWheelImage(
      "data:image/png;base64," + png.toString("base64"),
      { action: "prepare", kind: "rim" },
      async () => ({
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
      }),
    );
    const { data, info } = await sharp(
      Buffer.from(output.split(",")[1], "base64"),
    )
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(data[3], 0);
    const center = (400 * info.width + 400) * 4;
    assert.equal(
      data[center + 3],
      255,
      "preserva detalhes claros desconectados do fundo",
    );
    assert.ok(data[center] > 240);
  }
});
