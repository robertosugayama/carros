import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const temp = mkdtempSync(join(tmpdir(), "autotuner-ui-")),
  port = 38000 + Math.floor(Math.random() * 1000),
  base = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  DATA_DIR: temp,
  PORT: String(port),
  NODE_ENV: "production",
  DATA_PROVIDER: "legacy",
  ASSET_DIR: "/tmp/autotuner-legacy-dist",
  GEMINI_API_KEY: "",
  MASTER_EMAIL: "",
  MASTER_PASSWORD: "",
  TURSO_DATABASE_URL: "",
  TURSO_AUTH_TOKEN: "",
};
const server = spawn(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "server.ts"],
  { env, stdio: ["ignore", "pipe", "pipe"] },
);
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(Error("Startup timeout")), 10000);
  server.stdout.once("data", () => {
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
  await page.goto(base);
  await page
    .getByRole("heading", { name: "A sua foto é o ponto de partida." })
    .waitFor();
  assert.equal(await page.locator(".model").count(), 21);
  await page.screenshot({
    path: "/tmp/carros-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "/tmp/carros-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Ainda não tenho conta. Quero me cadastrar" })
    .click();
  const auth = page.getByRole("dialog");
  await auth.getByLabel("Seu nome").fill("Teste fotos");
  await auth.getByLabel("E-mail").fill("ui@example.com");
  await auth.getByLabel("Senha").fill("senha-teste-123");
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({
      status: 500,
      contentType: "text/plain",
      body: "A server error has occurred",
    }),
  );
  await auth.getByRole("button", { name: "Criar minha conta" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "O servidor está indisponível (HTTP 500)" })
    .waitFor();
  assert.ok(await auth.isVisible());
  await page.unroute("**/api/auth/register");
  await auth.getByRole("button", { name: "Criar minha conta" }).click();
  await auth.waitFor({ state: "hidden" });
  // Technical upload fixture, confined to this temporary database; not a product photograph.
  const fixture = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 360;
    const x = c.getContext("2d");
    x.fillStyle = "#637455";
    x.fillRect(0, 0, 640, 360);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page
    .getByRole("button", { name: "Enviar foto de roda", exact: true })
    .click();
  const upload = page.getByRole("dialog", { name: "Enviar foto de roda" });
  await upload
    .getByLabel("Nome da roda", { exact: true })
    .fill("Roda particular de teste");
  await upload.getByLabel("Nome do fabricante").fill("Fabricante teste");
  const automaticTreatment = page.waitForResponse((r) =>
    r.url().endsWith("/api/gemini/edit-wheel"),
  );
  await upload.locator("input[type=file]:not([capture])").setInputFiles({
    name: "test-only.png",
    mimeType: "image/png",
    buffer: Buffer.from(fixture, "base64"),
  });
  await automaticTreatment;
  await upload
    .getByRole("alert")
    .filter({ hasText: "Tratamento por IA não habilitado" })
    .waitFor();
  assert.equal(await upload.getByRole("slider").count(), 0);
  assert.equal(await upload.getByRole("checkbox").count(), 0);
  assert.equal(
    await upload
      .getByRole("button", { name: "Salvar roda no catálogo" })
      .isDisabled(),
    true,
  );
  assert.ok((await upload.boundingBox()).width <= 540);
  const preparedFixture = await page.evaluate(async () => {
    const image = new Image();
    image.src = "/wheels/silver-split-rim.png";
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 800;
    canvas.getContext("2d").drawImage(image, 0, 0, 800, 800);
    return canvas.toDataURL("image/webp", 0.88);
  });
  // Simulate a successful provider reply to verify preview/review UX only.
  await page.route("**/api/gemini/edit-wheel", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        image: preparedFixture,
        origin: "generated",
      }),
    }),
  );
  await upload.getByRole("button", { name: "Tentar novamente" }).click();
  await upload.getByAltText("Roda preparada por IA para o catálogo").waitFor();
  await page.screenshot({ path: "/tmp/carros-wheel-upload-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok((await upload.boundingBox()).width <= 390);
  await page.screenshot({ path: "/tmp/carros-wheel-upload-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.unroute("**/api/gemini/edit-wheel");
  const savePrivate = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/my/photos") && r.request().method() === "POST",
  );
  await upload.getByRole("button", { name: "Salvar roda no catálogo" }).click();
  const savedResponse = await savePrivate;
  assert.equal(savedResponse.status(), 201);
  const savedWheel = await savedResponse.json();
  assert.equal(savedWheel.credit, "Fabricante teste");
  assert.equal(savedWheel.kind, "rim");
  assert.equal(savedWheel.origin, "generated");
  await upload.waitFor({ state: "hidden" });
  await page
    .getByRole("heading", { name: "Roda particular de teste", exact: true })
    .waitFor();
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "car-fixture.png",
      mimeType: "image/png",
      buffer: Buffer.from(fixture, "base64"),
    });
  await page.locator(".wheel-overlay").first().waitFor();
  const capturedCar = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 180;
    c.getContext("2d").fillRect(0, 0, 320, 180);
    return c.toDataURL("image/jpeg").split(",")[1];
  });
  page.once("dialog", (dialog) => dialog.accept());
  const carChooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Fotografar carro", exact: true })
    .click();
  const carInput = await carChooser;
  assert.equal(await carInput.element().getAttribute("capture"), "environment");
  await carInput.setFiles({
    name: "camera-car.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(capturedCar, "base64"),
  });
  await page.waitForFunction(
    () => document.querySelector(".scene > img")?.naturalWidth === 320,
  );

  assert.equal(
    await page.locator(".wheel-resize-handle,.center-cross").count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("slider", {
        name: "Tamanho das duas rodas na foto",
        exact: true,
      })
      .count(),
    0,
  );
  assert.equal(await page.locator(".manual").count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: "Aumentar as duas rodas", exact: true })
      .count(),
    1,
  );
  const positions = await page.locator(".wheel-overlay").evaluateAll((els) =>
    els.map((e) => ({
      left: e.style.left,
      top: e.style.top,
      width: e.style.width,
    })),
  );
  await page
    .getByRole("button", { name: "Abrir controle de posição", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Posicionar roda direita", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mover roda para direita", exact: true })
    .click();
  const moved = await page.locator(".wheel-overlay").evaluateAll((els) =>
    els.map((e) => ({
      left: e.style.left,
      top: e.style.top,
      width: e.style.width,
    })),
  );
  assert.equal(moved[0].left, positions[0].left);
  assert.ok(parseFloat(moved[1].left) > parseFloat(positions[1].left));
  await page
    .getByRole("button", { name: "Aumentar as duas rodas", exact: true })
    .click();
  const sized = await page
    .locator(".wheel-overlay")
    .evaluateAll((els) => els.map((e) => e.style.width));
  assert.equal(sized[0], sized[1]);
  assert.ok(parseFloat(sized[0]) > parseFloat(positions[0].width));
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Remover rodas", exact: true })
    .click();
  assert.equal(await page.locator(".wheel-overlay").count(), 2);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Remover rodas", exact: true })
    .click();
  assert.equal(await page.locator(".wheel-overlay").count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: "Trocar rodas", exact: true })
      .count(),
    0,
  );
  await page
    .locator(".model")
    .filter({ hasText: "Roda particular de teste" })
    .click();
  await page
    .getByRole("button", { name: "Aumentar as duas rodas", exact: true })
    .click();
  let left = await page.locator(".wheel-overlay").first().boundingBox(),
    right = await page.locator(".wheel-overlay").last().boundingBox();
  assert.ok(Math.abs(left.width - right.width) < 1);
  assert.ok(Math.abs(left.width - left.height) < 1);
  assert.equal(
    await page
      .locator(".wheel-overlay")
      .first()
      .evaluate((el) => getComputedStyle(el).outlineStyle),
    "none",
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Aumentar zoom", exact: true })
      .count(),
    0,
  );
  left = await page.locator(".wheel-overlay").first().boundingBox();
  right = await page.locator(".wheel-overlay").last().boundingBox();
  assert.ok(Math.abs(left.width - right.width) < 1);
  await page.getByRole("radio", { name: "Alto" }).check();
  left = await page.locator(".wheel-overlay").first().boundingBox();
  right = await page.locator(".wheel-overlay").last().boundingBox();
  assert.ok(Math.abs(left.width - right.width) < 1);
  assert.equal(
    await page.locator('.wheel-overlay svg[data-tyre-profile="high"]').count(),
    2,
  );
  await page.getByRole("button", { name: "Ver original" }).click();
  assert.equal(await page.locator(".wheel-overlay").count(), 0);
  await page.getByRole("button", { name: "Ver depois" }).click();
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "promote.ts", "ui@example.com"],
    { env, stdio: "pipe" },
  );
  await page.reload();
  await page.getByRole("button", { name: "Admin", exact: true }).click();
  await page
    .getByRole("button", { name: "Publicar no catálogo", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Foto publicada" })
    .waitFor();
  const published = await (
    await page.request.get(base + "/api/catalog/photos")
  ).json();
  assert.ok(published.some((p) => p.name === "Roda particular de teste"));
  await page.getByRole("button", { name: "Estúdio", exact: true }).click();
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "car-fixture.png",
      mimeType: "image/png",
      buffer: Buffer.from(fixture, "base64"),
    });
  await page.locator(".model").filter({ hasText: "AT Silver Split" }).click();
  await page.waitForFunction(() =>
    document
      .querySelector(".wheel-overlay svg image")
      ?.getAttribute("href")
      ?.startsWith("data:"),
  );
  const original = await page
    .locator(".wheel-overlay svg image")
    .first()
    .getAttribute("href");
  await page.getByRole("button", { name: "Pinça Azul", exact: true }).click();
  await page.waitForFunction((old) => {
    const href = document
      .querySelector(".wheel-overlay svg image")
      ?.getAttribute("href");
    return href?.startsWith("data:") && href !== old;
  }, original);
  const blue = await page
    .locator(".wheel-overlay svg image")
    .first()
    .getAttribute("href");
  const bluePixels = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = data;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = c.height = 800;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0, 800, 800);
    const p = x.getImageData(400, 100, 335, 600).data;
    let n = 0;
    for (let i = 0; i < p.length; i += 4)
      if (p[i + 2] > p[i] * 1.5 && p[i + 2] > 100 && p[i + 3] > 128) n++;
    return n;
  }, blue);
  assert.ok(bluePixels > 500);
  await page
    .getByRole("radio", { name: "Liso, sem furos", exact: true })
    .check();
  await page.waitForFunction((old) => {
    const href = document
      .querySelector(".wheel-overlay svg image")
      ?.getAttribute("href");
    return href?.startsWith("data:") && href !== old;
  }, blue);
  const solid = await page
    .locator(".wheel-overlay svg image")
    .first()
    .getAttribute("href");
  assert.equal(
    await page.locator(".wheel-overlay svg image").last().getAttribute("href"),
    solid,
  );
  await page.getByRole("radio", { name: "Baixo" }).check();
  await page
    .getByRole("combobox", { name: "Tamanho do aro", exact: true })
    .selectOption("20");
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".wheel-overlay svg")].every(
      (el) =>
        el.getAttribute("data-rim-size") === "20" &&
        el.querySelector("image")?.getAttribute("href")?.startsWith("data:"),
    ),
  );
  await page.screenshot({
    path: "/tmp/carros-tyres-mobile.png",
    fullPage: true,
  });
  await page
    .locator(".wheel-preview")
    .first()
    .screenshot({ path: "/tmp/carros-tyre-preview.png" });
  const saving = page.waitForResponse(
    (r) => r.url().endsWith("/api/projects") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Salvar na minha garagem" }).click();
  const projectResponse = await saving;
  assert.equal(projectResponse.status(), 201);
  const savedProjects = await (
    await page.request.get(base + "/api/projects")
  ).json();
  assert.equal(savedProjects[0].payload.tyreProfile, "low");
  assert.equal(savedProjects[0].payload.size, 20);
  const visibleDiameter = await page
    .locator(".wheel-overlay")
    .first()
    .evaluate((node) => parseFloat(node.style.width) / 100);
  assert.ok(
    Math.abs(savedProjects[0].payload.wheels[0].diameter - visibleDiameter) <
      0.00001,
    "tamanho salvo corresponde à prévia",
  );
  await page
    .getByRole("button", { name: "Minha garagem", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Abrir projeto", exact: true })
    .click();
  assert.ok(
    await page.getByRole("radio", { name: "Liso, sem furos" }).isChecked(),
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Pinça Azul", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.ok(await page.getByRole("radio", { name: "Baixo" }).isChecked());
  assert.equal(
    await page
      .getByRole("combobox", { name: "Tamanho do aro", exact: true })
      .inputValue(),
    "20",
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar imagem", exact: true })
    .click();
  assert.ok(statSync(await (await download).path()).size > 1000);
  await page
    .locator(".model")
    .filter({ hasText: "Roda particular de teste" })
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  const deletion = page.waitForResponse(
    (r) =>
      r.url().includes("/api/my/photos/") && r.request().method() === "DELETE",
  );
  await page
    .getByRole("button", { name: "Excluir roda do catálogo", exact: true })
    .click();
  assert.equal((await deletion).status(), 200);
  assert.equal(
    await page
      .locator(".model")
      .filter({ hasText: "Roda particular de teste" })
      .count(),
    0,
  );
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Remover carro", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "A sua foto é o ponto de partida." })
    .waitFor();
  assert.equal(await page.locator(".wheel-overlay").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "Browser: sem alça/marcadores; joystick com seleção individual e tamanho comum nos botões +/−; upload de usuário sem fonte obrigatória; IA indisponível informada; publicação master; pinça azul com mudança de pixels; disco liso nas duas rodas; histórico e PNG preservam opções.",
  );
} finally {
  await browser.close();
  server.kill();
  await new Promise((resolve) => server.once("exit", resolve));
  rmSync(temp, { recursive: true, force: true });
}
