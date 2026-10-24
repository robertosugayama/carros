import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const temp = mkdtempSync(join(tmpdir(), "autotuner-browser-"));
const port = 38000 + Math.floor(Math.random() * 1000);
const child = spawn(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "server.ts"],
  {
    env: {
      ...process.env,
      DATA_DIR: temp,
      PORT: String(port),
      NODE_ENV: "production",
      GEMINI_API_KEY: "",
      TURSO_DATABASE_URL: "",
      TURSO_AUTH_TOKEN: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
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
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}`);
  await page.getByRole("heading", { name: "Seu carro." }).waitFor();
  assert.equal(await page.locator(".model").count(), 18);
  let box = await page.locator(".wheel-overlay").first().boundingBox();
  assert.ok(Math.abs(box.width - box.height) < 1);
  const img = await page.locator(".scene>img").boundingBox();
  await page.getByRole("button", { name: "Aumentar zoom" }).click();
  const next = await page.locator(".wheel-overlay").first().boundingBox();
  const nextImg = await page.locator(".scene>img").boundingBox();
  assert.ok(
    Math.abs(next.width / box.width - nextImg.width / img.width) < 0.01,
  );
  await page.getByRole("button", { name: "Ver original" }).click();
  assert.equal(await page.locator(".wheel-overlay").count(), 0);
  await page.getByRole("button", { name: "Ver depois" }).click();
  await page
    .getByRole("button", { name: "Ajustar rodas", exact: true })
    .click();
  await page.getByRole("button", { name: "Roda direita", exact: true }).click();
  await page.getByRole("slider", { name: "Diâmetro do conjunto" }).fill("25");
  box = await page.locator(".wheel-overlay").last().boundingBox();
  assert.ok(Math.abs(box.width - box.height) < 1);
  await page
    .getByRole("button", { name: "Restaurar posição das rodas" })
    .click();
  await page
    .getByRole("button", { name: "Ajustar rodas", exact: true })
    .click();
  await page.screenshot({
    path: fileURLToPath(new URL("../desktop.png",import.meta.url)),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole("heading", { name: "Seu carro." }).waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: fileURLToPath(new URL("../mobile.png",import.meta.url)),
    fullPage: true,
  });
  const fixture = await page.locator(".scene").screenshot();
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "carro.png",
      mimeType: "image/png",
      buffer: fixture,
    });
  await page.getByRole("button", { name: "Salvar na minha garagem" }).click();
  await page
    .getByRole("button", { name: "Ainda não tenho conta. Quero me cadastrar" })
    .click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Seu nome").fill("Teste navegador");
  await modal.getByLabel("E-mail").fill("browser@example.com");
  await modal.getByLabel("Senha").fill("senha-browser-123");
  await modal.getByRole("button", { name: "Criar minha conta" }).click();
  await modal.waitFor({ state: "hidden" });
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
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar imagem" }).click();
  const download = await downloadEvent;
  assert.ok(statSync(await download.path()).size > 1000);
  assert.deepEqual(errors, []);
  console.log(
    "Browser: 18 modelos, círculos perfeitos, zoom 1:1, antes/depois, ajuste manual, celular sem overflow e nenhum erro JS; cadastro, upload, projeto salvo/reaberto e PNG exportado.",
  );
} finally {
  await browser.close();
  child.kill();
  await new Promise((resolve) => child.once("exit", resolve));
  rmSync(temp, { recursive: true, force: true });
}
