import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const temp = mkdtempSync(join(tmpdir(), "autotuner-photo-test-")),
  port = 38000 + Math.floor(Math.random() * 1000);
const env = {
  ...process.env,
  DATA_DIR: temp,
  PORT: String(port),
  NODE_ENV: "production",
  GEMINI_API_KEY: "",
  TURSO_DATABASE_URL: "",
  TURSO_AUTH_TOKEN: "",
};
const child = spawn(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "server.ts"],
  { env, stdio: ["ignore", "pipe", "pipe"] },
);
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(Error("Startup timeout")), 10000);
  child.stdout.once("data", () => {
    clearTimeout(t);
    resolve();
  });
});
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}`);
  await page
    .getByRole("heading", { name: "A sua foto é o ponto de partida." })
    .waitFor();
  assert.equal(await page.locator(".model").count(), 21);
  assert.equal(await page.locator(".wheel-overlay").count(), 0);
  assert.equal(await page.locator(".wheel-preview svg image").count(), 1);
  await page.screenshot({
    path: fileURLToPath(new URL("../desktop.png", import.meta.url)),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: fileURLToPath(new URL("../mobile.png", import.meta.url)),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Ainda não tenho conta. Quero me cadastrar" })
    .click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Seu nome").fill("Teste de fotos");
  await modal.getByLabel("E-mail").fill("photo-test@example.com");
  await modal.getByLabel("Senha").fill("senha-teste-123");
  await modal.getByRole("button", { name: "Criar minha conta" }).click();
  await modal.waitFor({ state: "hidden" });
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "promote.ts", "photo-test@example.com"],
    { env, stdio: "pipe" },
  );
  await page.reload();
  await page.getByRole("button", { name: "Admin", exact: true }).click();
  // A synthetic pixel fixture tests upload mechanics only; it is NEVER shipped as a product photo.
  const fixture = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 360;
    const x = c.getContext("2d");
    x.fillStyle = "#647155";
    x.fillRect(0, 0, 640, 360);
    x.fillStyle = "#fff";
    x.font = "24px sans-serif";
    x.fillText("TEST FIXTURE — NOT PRODUCT PHOTOGRAPHY", 15, 190);
    return c.toDataURL("image/png").split(",")[1];
  });
  const photoForm = page.locator(".photo-upload");
  await photoForm
    .getByRole("combobox", { name: "Modelo da fotografia", exact: true })
    .selectOption("14");
  await photoForm.locator("input[type=file]").setInputFiles({
    name: "technical-fixture.png",
    mimeType: "image/png",
    buffer: Buffer.from(fixture, "base64"),
  });
  await photoForm
    .getByLabel("Link da fonte")
    .fill("https://example.com/test-fixture");
  await photoForm
    .getByLabel("Crédito / origem")
    .fill("Technical test fixture only");
  await photoForm.locator("input[type=checkbox]").check();
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/admin/photos") &&
        r.request().method() === "POST",
    ),
    photoForm
      .getByRole("button", { name: "Salvar fotografia no catálogo" })
      .click(),
  ]);
  await page.getByRole("button", { name: "Estúdio", exact: true }).click();
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "car-fixture.png",
      mimeType: "image/png",
      buffer: Buffer.from(fixture, "base64"),
    });
  await page.locator(".model").filter({ hasText: "Volk TE37" }).click();
  await page.locator(".wheel-overlay").first().waitFor();
  assert.equal(await page.locator(".wheel-overlay svg image").count(), 2);
  assert.equal(
    await page
      .locator(".wheel-overlay svg path,.wheel-overlay svg radialGradient")
      .count(),
    0,
  );
  let box = await page.locator(".wheel-overlay").first().boundingBox(),
    img = await page.locator(".scene>img").boundingBox();
  assert.ok(Math.abs(box.width - box.height) < 1);
  await page.getByRole("button", { name: "Aumentar zoom" }).click();
  let next = await page.locator(".wheel-overlay").first().boundingBox(),
    nextImg = await page.locator(".scene>img").boundingBox();
  assert.ok(
    Math.abs(next.width / box.width - nextImg.width / img.width) < 0.01,
  );
  await page.getByRole("button", { name: "Ver original" }).click();
  assert.equal(await page.locator(".wheel-overlay").count(), 0);
  await page.getByRole("button", { name: "Ver depois" }).click();
  if (!(await page.locator(".manual").isVisible()))
    await page
      .getByRole("button", { name: "Ajustar rodas", exact: true })
      .click();
  await page.getByRole("button", { name: "Roda direita", exact: true }).click();
  await page.getByRole("slider", { name: "Diâmetro do conjunto" }).fill("25");
  box = await page.locator(".wheel-overlay").last().boundingBox();
  assert.ok(Math.abs(box.width - box.height) < 1);
  assert.equal(
    await page
      .getByRole("button", { name: "Cromada", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("slider", { name: "Tamanho do aro" }).fill("20");
  assert.ok(
    Number(
      await page
        .locator(".wheel-overlay svg image")
        .first()
        .getAttribute("width"),
    ) < 1000,
  );
  const href = await page
    .locator(".wheel-overlay svg image")
    .first()
    .getAttribute("href");
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/projects") && r.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Salvar na minha garagem" }).click(),
  ]);
  await page
    .getByRole("button", { name: "Minha garagem", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Meu projeto", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Abrir projeto" }).click();
  assert.equal(
    await page.locator(".wheel-overlay svg image").first().getAttribute("href"),
    href,
  );
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar imagem" }).click();
  const download = await downloadEvent;
  assert.ok(statSync(await download.path()).size > 1000);
  // Exercise the bundled generated asset through the real snapshot/export flow.
  await page.locator(".model").filter({ hasText: "AT Silver Split" }).click();
  await page.getByText("GERADA POR IA", { exact: true }).waitFor();
  // Assembly images must resize on the photo without requesting another rim asset.
  const leftWheel = page.locator(".wheel-overlay").first(),
    rightWheel = page.locator(".wheel-overlay").last();
  const rightBefore = await rightWheel.boundingBox();
  await page
    .getByRole("slider", {
      name: "Tamanho da roda esquerda na foto",
      exact: true,
    })
    .fill("22");
  assert.ok(
    Math.abs(
      Number(
        await page
          .getByRole("slider", {
            name: "Tamanho da roda esquerda na foto",
            exact: true,
          })
          .inputValue(),
      ) - 22,
    ) < 0.01,
  );
  assert.ok(
    Math.abs((await rightWheel.boundingBox()).width - rightBefore.width) < 1,
  );
  await page
    .getByRole("button", { name: "Aumentar zoom", exact: true })
    .click();
  const handle = page.getByRole("button", {
    name: "Redimensionar roda esquerda",
    exact: true,
  });
  await handle.scrollIntoViewIfNeeded();
  const beforeResize = await leftWheel.boundingBox(),
    h = await handle.boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + 14, h.y + h.height / 2 + 14, {
    steps: 5,
  });
  await page.mouse.up();
  const afterResize = await leftWheel.boundingBox();
  assert.ok(afterResize.width > beforeResize.width + 10);
  assert.ok(Math.abs(afterResize.width - afterResize.height) < 1);
  assert.ok(
    Math.abs(
      beforeResize.x +
        beforeResize.width / 2 -
        (afterResize.x + afterResize.width / 2),
    ) < 1,
  );
  assert.ok(
    Math.abs(
      beforeResize.y +
        beforeResize.height / 2 -
        (afterResize.y + afterResize.height / 2),
    ) < 1,
  );
  const beforeKey = Number(
    await page
      .getByRole("slider", {
        name: "Tamanho da roda esquerda na foto",
        exact: true,
      })
      .inputValue(),
  );
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  assert.ok(
    Number(
      await page
        .getByRole("slider", {
          name: "Tamanho da roda esquerda na foto",
          exact: true,
        })
        .inputValue(),
    ) > beforeKey,
  );
  assert.equal(
    await page
      .getByRole("slider", { name: "Tamanho do aro", exact: true })
      .count(),
    0,
  );

  const generatedSave = page.waitForResponse(
    (r) => r.url().endsWith("/api/projects") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Salvar na minha garagem" }).click();
  assert.equal((await generatedSave).status(), 201);
  const saved = await (
    await page.request.get(`http://127.0.0.1:${port}/api/projects`)
  ).json();
  const generated = saved.find((p) => p.payload.model === 18);
  assert.equal(generated.payload.photo.origin, "generated");
  assert.ok(
    generated.payload.photo.image.startsWith("data:image/webp;base64,"),
  );
  const generatedExport = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar imagem" }).click();
  assert.ok(statSync(await (await generatedExport).path()).size > 1000);
  assert.deepEqual(errors, []);
  console.log(
    "Browser: sem desenhos substitutos, cadastro master de foto, recorte circular, uso dos pixels originais, zoom sincronizado, snapshot salvo/reaberto, exportação PNG e celular sem overflow. Fotos técnicas não validam a qualidade das fotografias dos fabricantes.",
  );
} finally {
  await browser.close();
  child.kill();
  await new Promise((resolve) => child.once("exit", resolve));
  rmSync(temp, { recursive: true, force: true });
}
