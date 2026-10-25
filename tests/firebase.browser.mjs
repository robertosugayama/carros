import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomInt } from "node:crypto";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, updateDoc } from "firebase/firestore";
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
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
  assert.equal(
    await page.getByRole("button", { name: "Admin", exact: true }).count(),
    0,
  );
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
  await upload.locator("input[type=file]").setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: fixture,
  });
  const request = page.waitForResponse((r) =>
    r.url().endsWith("/api/gemini/edit-wheel"),
  );
  await upload.getByRole("button", { name: "Tratar foto com IA" }).click();
  assert.equal((await request).status(), 503);
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
  const deniedRules = await fetch("http://127.0.0.1:8089/emulator/v1/projects/demo-autotuner:securityRules", { method: "PUT", body: JSON.stringify({ rules: { files: [{ content: "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if false; } } }" }] } }) });
  assert.equal(deniedRules.ok, true);
  const deniedContext = await browser.newContext();
  const deniedPage = await deniedContext.newPage();
  await deniedPage.goto(base);
  await deniedPage.getByRole("button", { name: "Entrar", exact: true }).click();
  const deniedLogin = deniedPage.getByRole("dialog");
  await deniedLogin.getByLabel("E-mail").fill("firebase-ui@example.test");
  await deniedLogin.getByLabel("Senha").fill("firebase-ui-test-123");
  await deniedLogin.getByRole("button", { name: "Entrar", exact: true }).click();
  await deniedPage.getByText(/Sua conta foi autenticada, mas o Firestore negou/).waitFor();
  await deniedContext.close();
  assert.deepEqual(errors, []);
  console.log(
    "Firebase browser: cadastro e login reais nos emuladores Auth/Firestore, manutenção persistente, master protegido e token Firebase verificado no backend IA. Storage não foi exercitado neste teste.",
  );
} finally {
  await browser.close();
  await rules.clearFirestore();
  await rules.cleanup();
  child.kill();
  await new Promise((resolve) => child.once("exit", resolve));
}
