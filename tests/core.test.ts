import { test } from "node:test";
import { createClient } from "@libsql/client";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  models,
  finishes,
  calipers,
  rimRatio,
  validPlacement,
} from "../src/catalog.ts";
test("catálogo e geometria física", () => {
  assert.equal(models.length, 21);
  assert.equal(new Set(models.map((m) => m.id)).size, 21);
  assert.equal(finishes.length, 7);
  assert.equal(calipers.length, 11);
  assert.ok(rimRatio(14) < rimRatio(22));
  assert.ok(rimRatio(22) < 1);
  assert.ok(validPlacement({ x: 0.3, y: 0.6, diameter: 0.2 }));
  assert.ok(!validPlacement({ x: 2, y: 0.6, diameter: 0.2 }));
});
test("contas, projetos isolados, manutenção e permissões", async () => {
  const dir = mkdtempSync(join(tmpdir(), "autotuner-"));
  const legacy = createClient({ url: "file:" + join(dir, "app.db") });
  await legacy.executeMultiple(
    "CREATE TABLE wheel_photos(id INTEGER PRIMARY KEY,model INTEGER,finish INTEGER,size INTEGER,image TEXT,source TEXT,credit TEXT,UNIQUE(model,finish,size));INSERT INTO wheel_photos(model,finish,size,image,source,credit) VALUES(13,1,18,'data:image/png;base64,aGVsbG8=','https://example.com/legacy','Legacy fixture');",
  );
  legacy.close();
  const port = 36000 + Math.floor(Math.random() * 1000);
  const env = {
    ...process.env,
    DATA_DIR: dir,
    PORT: String(port),
    NODE_ENV: "production",
    GEMINI_API_KEY: "",
    MASTER_EMAIL: "",
    MASTER_PASSWORD: "",
    TURSO_DATABASE_URL: "",
    TURSO_AUTH_TOKEN: "",
  };
  const child = spawn(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "server.ts"],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Startup timeout")), 10000);
      child.stdout.once("data", () => {
        clearTimeout(timer);
        resolve();
      });
      child.once("exit", () => {
        clearTimeout(timer);
        reject(Error("Server exited"));
      });
    });
    const req = async (
      path: string,
      body?: any,
      cookie?: string,
      method?: string,
    ) => {
      const r = await fetch(`http://127.0.0.1:${port}/api/` + path, {
        method: method || (body ? "POST" : "GET"),
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return {
        status: r.status,
        data: await r.json(),
        cookie: r.headers.get("set-cookie")?.split(";")[0],
      };
    };
    const migrated = (await req("catalog/photos")).data.find(
      (p: any) => p.model === 13,
    );
    assert.equal(migrated.credit, "Legacy fixture");
    assert.equal(migrated.kind, "assembly");
    assert.equal(migrated.public, 1);
    const a = await req("auth/register", {
      name: "Ana",
      email: "ana@example.com",
      password: "senha-segura-123",
    });
    assert.equal(a.status, 200);
    assert.equal(a.data.role, "user");
    const b = await req("auth/register", {
      name: "Beto",
      email: "beto@example.com",
      password: "senha-segura-123",
    });
    assert.equal((await req("projects")).status, 401);
    assert.equal((await req("admin/users", undefined, b.cookie)).status, 403);
    const payload = {
      image: "data:image/png;base64,aGVsbG8=",
      model: 14,
      finish: 1,
      caliper: 4,
      angle: 20,
      size: 18,
      wheels: [
        { x: 0.2, y: 0.7, diameter: 0.2 },
        { x: 0.7, y: 0.7, diameter: 0.3 },
      ],
      notes: "Projeto teste",
    };
    assert.equal(
      (await req("projects", { name: "Golf", payload }, a.cookie)).status,
      201,
    );
    assert.equal((await req("projects", undefined, a.cookie)).data.length, 1);
    const normalized = (await req("projects", undefined, a.cookie)).data[0]
      .payload.wheels;
    assert.deepEqual(
      normalized.map((w: any) => w.diameter),
      [0.25, 0.25],
    );
    assert.deepEqual(
      normalized.map((w: any) => [w.x, w.y]),
      [
        [0.2, 0.7],
        [0.7, 0.7],
      ],
    );
    assert.equal((await req("projects", undefined, b.cookie)).data.length, 0);
    assert.equal(
      (
        await req(
          "projects",
          { name: "Inválido", payload: { ...payload, size: 99 } },
          a.cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await req(
          "maintenance",
          {
            vehicle: "Golf",
            kind: "Óleo",
            date: "2026-10-24",
            km: 50000,
            notes: "Filtro novo",
          },
          a.cookie,
        )
      ).status,
      201,
    );
    assert.equal(
      (await req("maintenance", undefined, b.cookie)).data.length,
      0,
    );
    assert.equal(
      (await req("gemini/detect-wheels", { image: payload.image }, a.cookie))
        .status,
      503,
    );
    execFileSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "promote.ts", "ana@example.com"],
      { env, stdio: "pipe" },
    );
    assert.equal(
      (await req("admin/users", undefined, a.cookie)).data.length,
      2,
    );
    const ownPhoto = {
      model: -1,
      name: "Roda própria",
      finish: 1,
      size: 18,
      kind: "rim",
      image: "data:image/png;base64,aGVsbG8=",
      source: "",
      credit: "",
    };
    const own = await req("my/photos", ownPhoto, b.cookie);
    assert.equal(own.status, 201);
    assert.ok(own.data.model >= 1000);
    assert.equal((await req("my/photos", undefined, b.cookie)).data.length, 1);
    assert.equal((await req("my/photos", undefined, a.cookie)).data.length, 0);
    assert.ok(
      !(await req("catalog/photos")).data.some(
        (p: any) => p.id === own.data.id,
      ),
    );
    assert.equal(
      (
        await req(
          "projects",
          {
            name: "Minha roda",
            payload: { ...payload, model: own.data.model, photo: own.data },
          },
          b.cookie,
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await req(
          "projects",
          {
            name: "Não autorizada",
            payload: { ...payload, model: own.data.model, photo: own.data },
          },
          a.cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await req(
          "admin/photo-submissions/" + own.data.id + "/publish",
          {},
          a.cookie,
        )
      ).status,
      200,
    );
    assert.ok(
      (await req("catalog/photos")).data.some((p: any) => p.id === own.data.id),
    );
    assert.equal(
      (
        await req(
          "gemini/edit-wheel",
          { action: "prepare", kind: "rim", image: ownPhoto.image },
          a.cookie,
        )
      ).status,
      503,
    );
    const photo = {
      model: 14,
      finish: 1,
      size: 18,
      image: "data:image/png;base64,aGVsbG8=",
      source: "https://example.com/test-fixture",
      credit: "Technical fixture",
    };
    assert.equal((await req("admin/photos", photo, b.cookie)).status, 403);
    assert.equal(
      (
        await req(
          "admin/photos",
          { ...photo, image: "data:image/svg+xml;base64,aGVsbG8=" },
          a.cookie,
        )
      ).status,
      400,
    );
    assert.equal((await req("admin/photos", photo, a.cookie)).status, 201);
    const realPhoto = (await req("catalog/photos")).data.find(
      (p: any) => p.model === 14,
    );
    assert.equal(realPhoto.image, photo.image);
    assert.equal(
      (
        await req(
          "projects",
          { name: "Photo project", payload: { ...payload, photo: realPhoto } },
          a.cookie,
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await req(
          "projects",
          {
            name: "Wrong finish",
            payload: { ...payload, photo: { ...realPhoto, finish: 0 } },
          },
          a.cookie,
        )
      ).status,
      400,
    );

    assert.equal(
      (await req("admin/catalog", { id: 1, enabled: false }, a.cookie)).status,
      200,
    );
    assert.equal(
      (await req("catalog")).data.find((r: any) => r.id === 1).enabled,
      0,
    );
    assert.equal(
      (
        await req(
          "admin/users",
          { id: b.data.id, role: "user", blocked: true },
          a.cookie,
        )
      ).status,
      200,
    );
    assert.equal((await req("me", undefined, b.cookie)).status, 401);
    await req("logout", {}, a.cookie);
    assert.equal((await req("me", undefined, a.cookie)).status, 401);
  } finally {
    child.kill();
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("tamanho único preserva centros, corrige legado e não altera entrada", async () => {
  const { equalizeWheels } = await import("../src/wheelSizing.ts");
  const original = [
    { x: 0.2, y: 0.6, diameter: 0.2 },
    { x: 0.8, y: 0.65, diameter: 0.3 },
  ];
  const shared = equalizeWheels(original);
  assert.deepEqual(
    shared.map((w) => w.diameter),
    [0.25, 0.25],
  );
  assert.deepEqual(
    shared.map((w) => [w.x, w.y]),
    original.map((w) => [w.x, w.y]),
  );
  assert.deepEqual(
    equalizeWheels(original, 0.4).map((w) => w.diameter),
    [0.4, 0.4],
  );
  assert.equal(original[1].diameter, 0.3);
});
