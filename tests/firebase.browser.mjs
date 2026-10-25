import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomInt } from "node:crypto";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, updateDoc, setDoc } from "firebase/firestore";
const port = 33000 + randomInt(1000),
  base = `http://127.0.0.1:${port}`;
const child = spawn(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "server.ts"],
  {
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATA_PROVIDER: "firebase",
      ASSET_DIR: "/tmp/autotuner-firebase-dist",
      PORT: String(port),
      FIREBASE_PROJECT_ID: "demo-autotuner",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8089",
      VERCEL: "",
      GEMINI_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Error("Server timeout")), 10000);
  child.stdout.once("data", () => {
    clearTimeout(timer);
    resolve();
  });
  child.stderr.on("data", (d) => process.stderr.write(d));
});
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const rules = await initializeTestEnvironment({
  projectId: "demo-autotuner",
  firestore: { host: "127.0.0.1", port: 8089 },
});
try {
  const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const remoteUrl =
    "https://firebasestorage.googleapis.com/v0/b/carros-ed674.firebasestorage.app/o/catalog%2Fmaster%2Fremote.webp?alt=media&token=test-only-token";
  await rules.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), "wheelPhotos", "remote-wheel"), {
      name: "Roda remota salva",
      model: "remote-wheel",
      finish: 1,
      size: 18,
      kind: "rim",
      origin: "generated",
      image: remoteUrl,
      source: "",
      credit: "Teste remoto",
      owner_id: "master",
      public: true,
    });
  });
  const rim = await readFile(
    new URL("../public/wheels/silver-split-rim.png", import.meta.url),
  );
  let savedCarUrl = "";
  let reads = 0,
    direct = 0;
  await page.route("https://firebasestorage.googleapis.com/**", (route) => {
    direct++;
    return route.abort();
  });
  await page.route("**/api/storage/image", (route) => {
    reads++;
    assert.ok(
      [remoteUrl, savedCarUrl].includes(route.request().postDataJSON().image),
    );
    return route.fulfill({ status: 200, contentType: "image/png", body: rim });
  });
  await page.goto(base);
  const remoteCard = page
    .locator(".model")
    .filter({ hasText: "Roda remota salva" });
  await remoteCard.locator('svg[data-load-state="ready"]').waitFor();
  await remoteCard.click();
  await page.locator('.wheel-preview svg[data-load-state="ready"]').waitFor();
  assert.equal(direct, 0);
  assert.equal(reads, 1, "a miniatura e a prévia compartilham a mesma leitura");

  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Ainda não tenho conta. Quero me cadastrar" })
    .click();
  const auth = page.getByRole("dialog");
  await auth.getByLabel("Seu nome").fill("Firebase UI");
  await auth.getByLabel("E-mail").fill("firebase-ui@example.test");
  await auth.getByLabel("Senha").fill("firebase-ui-test-123");
  const signup = page.waitForResponse((r) =>
    r.url().includes("accounts:signUp"),
  );
  await auth.getByRole("button", { name: "Criar minha conta" }).click();
  const credentials = await (await signup).json();
  assert.ok(credentials.localId);
  await auth.waitFor({ state: "hidden", timeout: 20000 });
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles({ name: "car.png", mimeType: "image/png", buffer: rim });
  await page
    .locator('.wheel-overlay svg[data-load-state="ready"]')
    .first()
    .waitFor();
  assert.equal(
    await page.locator('.wheel-overlay svg[data-load-state="ready"]').count(),
    2,
  );
  assert.equal(direct, 0);

  assert.equal(
    await page.getByRole("button", { name: "Admin", exact: true }).count(),
    0,
  );
  savedCarUrl =
    "https://firebasestorage.googleapis.com/v0/b/carros-ed674.firebasestorage.app/o/" +
    encodeURIComponent(
      `users/${credentials.localId}/projects/saved-remote/car.webp`,
    ) +
    "?alt=media&token=test-car";
  await rules.withSecurityRulesDisabled(async (c) => {
    await setDoc(
      doc(
        c.firestore(),
        "users",
        credentials.localId,
        "projects",
        "saved-remote",
      ),
      {
        name: "Carro salvo remoto",
        createdAt: new Date(),
        files: [],
        payload: {
          image: savedCarUrl,
          model: "remote-wheel",
          finish: 1,
          size: 18,
          caliper: 4,
          discStyle: "solid",
          tyreProfile: "medium",
          wheels: [
            { x: 0.25, y: 0.6, diameter: 0.2 },
            { x: 0.75, y: 0.6, diameter: 0.2 },
          ],
          photo: {
            id: "remote-wheel",
            model: "remote-wheel",
            finish: 1,
            size: 18,
            kind: "rim",
            image: remoteUrl,
            source: "",
            credit: "Teste",
          },
        },
      },
    );
  });
  await page
    .getByRole("button", { name: "Minha garagem", exact: true })
    .click();
  const maintenance = page.locator(".maintenance-form");
  await maintenance.locator("[name=vehicle]").fill("Carro teste Firebase");
  await maintenance.locator("[name=date]").fill("2026-10-25");
  await maintenance.locator("[name=km]").fill("10000");
  await maintenance.getByRole("button", { name: "Registrar" }).click();
  await page
    .getByRole("heading", { name: "Óleo · Carro teste Firebase" })
    .waitFor();
  await page.reload();
  await page
    .getByRole("button", { name: "Minha garagem", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Óleo · Carro teste Firebase" })
    .waitFor();
  await page.locator(".project-thumb img").waitFor();
  await page
    .getByRole("button", { name: "Abrir projeto", exact: true })
    .click();
  await page.locator('.scene > img[src^="data:"]').waitFor();
  await page
    .locator('.wheel-overlay svg[data-load-state="ready"]')
    .first()
    .waitFor();
  const dimensions = await page.locator(".scene").evaluate((el) => ({
    width: el.clientWidth,
    height: el.clientHeight,
    image: el.querySelector("img").naturalHeight,
  }));
  assert.ok(
    dimensions.image > 0 && dimensions.height > 100,
    "foto completa antes de posicionar as rodas",
  );
  assert.equal(direct, 0);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const frozenBefore = await page.locator(".viewport").boundingBox();
  await page.locator(".config").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const frozenAfter = await page.locator(".viewport").boundingBox();
  assert.ok(
    Math.abs(frozenAfter.y - frozenBefore.y) < 1,
    "rolar ferramentas não move a foto",
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
  await page
    .getByRole("button", { name: "Mover roda para esquerda", exact: true })
    .tap();
  const arrow = page.getByRole("button", {
    name: "Mover roda para cima",
    exact: true,
  });
  const beforeHold = await page
    .locator(".wheel-overlay")
    .first()
    .evaluate((el) => el.style.top);
  const arrowBox = await arrow.boundingBox();
  await page.mouse.move(
    arrowBox.x + arrowBox.width / 2,
    arrowBox.y + arrowBox.height / 2,
  );
  await page.mouse.down();
  await new Promise((resolve) => setTimeout(resolve, 650));
  await page.mouse.up();
  const afterHold = await page
    .locator(".wheel-overlay")
    .first()
    .evaluate((el) => el.style.top);
  assert.ok(parseFloat(afterHold) < parseFloat(beforeHold));
  await new Promise((resolve) => setTimeout(resolve, 220));
  assert.equal(
    await page
      .locator(".wheel-overlay")
      .first()
      .evaluate((el) => el.style.top),
    afterHold,
    "soltar o controle interrompe o movimento",
  );
  const frozenTools = await page.locator(".config").evaluate((el) => ({
    scroll: el.scrollTop,
    client: el.clientHeight,
    total: el.scrollHeight,
  }));
  assert.ok(frozenTools.scroll > 0 && frozenTools.total > frozenTools.client);
  await page
    .locator(".editor")
    .screenshot({ path: "/tmp/carros-mobile-editor.png" });
  await page.setViewportSize({ width: 740, height: 400 });
  await page
    .locator(".workspace")
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  const landscape = await page.locator(".config").boundingBox();
  assert.ok(
    landscape.height > 150,
    "ferramentas continuam acessíveis com celular deitado",
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.setViewportSize({ width: 390, height: 844 });

  await rules.withSecurityRulesDisabled(async (c) => {
    await updateDoc(doc(c.firestore(), "users", credentials.localId), {
      role: "master",
    });
  });
  await page.reload();
  await page.getByRole("button", { name: "Admin", exact: true }).click();
  await page
    .getByText("firebase-ui@example.test", { exact: false })
    .first()
    .waitFor();
  await page.getByRole("button", { name: "Estúdio", exact: true }).click();
  await page
    .getByRole("button", { name: "Enviar foto de roda", exact: true })
    .click();
  const upload = page.getByRole("dialog", { name: "Enviar foto de roda" });
  const fixture = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6zJkAAAAASUVORK5CYII=",
    "base64",
  );
  const request = page.waitForResponse((r) =>
    r.url().endsWith("/api/gemini/edit-wheel"),
  );
  await upload.locator("input[type=file]").setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: fixture,
  });
  assert.equal((await request).status(), 503);
  await upload.getByRole("alert").waitFor();
  assert.equal(await upload.getByRole("slider").count(), 0);
  assert.equal(
    await upload
      .getByRole("button", { name: "Salvar roda no catálogo" })
      .isDisabled(),
    true,
  );
  assert.ok((await upload.boundingBox()).width <= 390);
  const invalid = await page.request.post(base + "/api/gemini/edit-wheel", {
    headers: { Authorization: "Bearer invalid-test-token" },
    data: {},
  });
  assert.equal(invalid.status(), 401);
  await rules.withSecurityRulesDisabled(async (c) => {
    await updateDoc(doc(c.firestore(), "users", credentials.localId), {
      blocked: true,
    });
  });
  const blocked = await page.request.post(base + "/api/gemini/edit-wheel", {
    headers: { Authorization: "Bearer " + credentials.idToken },
    data: {},
  });
  assert.equal(blocked.status(), 403);
  const deniedRules = await fetch(
    "http://127.0.0.1:8089/emulator/v1/projects/demo-autotuner:securityRules",
    {
      method: "PUT",
      body: JSON.stringify({
        rules: {
          files: [
            {
              content:
                "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if false; } } }",
            },
          ],
        },
      }),
    },
  );
  assert.equal(deniedRules.ok, true);
  const deniedContext = await browser.newContext();
  const deniedPage = await deniedContext.newPage();
  await deniedPage.goto(base);
  await deniedPage.getByRole("button", { name: "Entrar", exact: true }).click();
  const deniedLogin = deniedPage.getByRole("dialog");
  await deniedLogin.getByLabel("E-mail").fill("firebase-ui@example.test");
  await deniedLogin.getByLabel("Senha").fill("firebase-ui-test-123");
  await deniedLogin
    .getByRole("button", { name: "Entrar", exact: true })
    .click();
  await deniedPage
    .getByText(/Sua conta foi autenticada, mas o Firestore negou/)
    .waitFor();
  await deniedContext.close();
  assert.deepEqual(errors, []);
  console.log(
    "Firebase browser: cadastro e login reais nos emuladores Auth/Firestore, manutenção persistente, master protegido e token Firebase verificado no backend IA. Joystick testado com toque e pressão contínua; foto fixa ao rolar ferramentas. Storage real não foi exercitado neste teste.",
  );
} finally {
  await browser.close();
  await rules.clearFirestore();
  await rules.cleanup();
  child.kill();
  await new Promise((resolve) => child.once("exit", resolve));
}
