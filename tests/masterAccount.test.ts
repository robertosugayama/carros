import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomInt } from "node:crypto";
import { spawn } from "node:child_process";
import { ensureMaster, masterPasswordHash } from "../masterAccount.ts";
test("bootstrap master é repetível, não redefine contas e não promove senha incorreta", async () => {
  const dir = mkdtempSync(join(tmpdir(), "master-bootstrap-")),
    client = createClient({ url: "file:" + join(dir, "app.db") });
  const db = {
    exec: (sql: string) => client.executeMultiple(sql),
    prepare: (sql: string) => ({
      get: async (...args: any[]) =>
        (await client.execute({ sql, args })).rows[0] as any,
      all: async (...args: any[]) =>
        (await client.execute({ sql, args })).rows as any[],
      run: async (...args: any[]) => {
        const r = await client.execute({ sql, args });
        return { changes: r.rowsAffected, lastInsertRowid: r.lastInsertRowid };
      },
    }),
  };
  try {
    await db.exec(
      "CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,email TEXT UNIQUE,password TEXT,role TEXT DEFAULT 'user',blocked INTEGER DEFAULT 0);",
    );
    const password = String(randomInt(100000, 999999));
    assert.equal(await ensureMaster(db, {}), "disabled");
    assert.equal(
      await ensureMaster(db, { email: "owner@fixture" }),
      "incomplete",
    );
    assert.equal(
      await ensureMaster(db, { email: "owner@fixture", password }),
      "created",
    );
    const original = await db
      .prepare("SELECT * FROM users WHERE email=?")
      .get("owner@fixture");
    assert.equal(original.role, "master");
    assert.notEqual(original.password, password);
    assert.equal(
      await ensureMaster(db, {
        email: "owner@fixture",
        password: password + "changed",
      }),
      "existing",
    );
    assert.equal(
      (await db.prepare("SELECT * FROM users WHERE id=?").get(original.id))
        .password,
      original.password,
    );
    await db
      .prepare("INSERT INTO users(name,email,password) VALUES(?,?,?)")
      .run("Conta existente", "existing@fixture", masterPasswordHash(password));
    assert.equal(
      await ensureMaster(db, {
        email: "existing@fixture",
        password: password + "wrong",
      }),
      "conflict",
    );
    assert.equal(
      (
        await db
          .prepare("SELECT role FROM users WHERE email=?")
          .get("existing@fixture")
      ).role,
      "user",
    );
    assert.equal(
      await ensureMaster(db, { email: "existing@fixture", password }),
      "promoted",
    );
  } finally {
    client.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("servidor cria master no deploy e aceita login com domínio local e senha de seis caracteres", async () => {
  const dir = mkdtempSync(join(tmpdir(), "master-login-")),
    port = 41000 + randomInt(1000),
    password = String(randomInt(100000, 999999));
  const child = spawn(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "server.ts"],
    {
      env: {
        ...process.env,
        DATA_DIR: dir,
        PORT: String(port),
        NODE_ENV: "production",
        DATA_PROVIDER: "legacy",
        TURSO_DATABASE_URL: "",
        TURSO_AUTH_TOKEN: "",
        GEMINI_API_KEY: "",
        MASTER_EMAIL: "owner@fixture",
        MASTER_PASSWORD: password,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Startup timeout")), 10000);
      child.stdout.on("data", () => {
        clearTimeout(timer);
        resolve();
      });
      child.once("error", reject);
    });
    const base = `http://127.0.0.1:${port}`;
    const response = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "owner@fixture", password }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).role, "master");
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    const admin = await fetch(base + "/api/admin/users", {
      headers: { Cookie: cookie },
    });
    assert.equal(admin.status, 200);
    assert.equal((await admin.json()).length, 1);
    const register = await fetch(base + "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Pessoa",
        email: "public@fixture",
        password,
      }),
    });
    assert.equal(register.status, 400);
  } finally {
    child.kill();
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
});
