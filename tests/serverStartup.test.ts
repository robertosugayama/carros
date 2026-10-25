import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("API Firebase inicia sem require(ESM), sem chaves privadas e responde status e sessão inválida", async () => {
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      "--no-experimental-require-module",
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `import { createServer } from 'node:http';
     import handler from './api/index.ts';
     const server = createServer(handler);
     await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
     try {
       const base = 'http://127.0.0.1:' + server.address().port;
       const status = await fetch(base + '/api/status');
       const invalid = await fetch(base + '/api/gemini/edit-wheel', {
         method: 'POST', headers: { Authorization: 'Bearer invalid-test-token', 'Content-Type': 'application/json' }, body: '{}'
       });
       console.log(JSON.stringify({ status: status.status, body: await status.json(), invalid: invalid.status }));
     } finally { await new Promise(resolve => server.close(resolve)); }`,
    ],
    {
      cwd: new URL("..", import.meta.url),
      timeout: 20000,
      env: {
        ...process.env,
        VERCEL: "1",
        NODE_ENV: "production",
        DATA_PROVIDER: "firebase",
        NODE_OPTIONS: "",
        FIREBASE_PROJECT_ID: "carros-ed674",
        FIREBASE_AUTH_EMULATOR_HOST: "",
        FIRESTORE_EMULATOR_HOST: "",
        GOOGLE_APPLICATION_CREDENTIALS: "",
        GEMINI_API_KEY: "",
      },
    },
  );
  const result = JSON.parse(stdout.trim());
  assert.equal(result.status, 200);
  assert.equal(result.body.backend, "firebase");
  assert.equal(result.body.projectId, "carros-ed674");
  assert.equal(result.body.aiConfigured, false);
  assert.equal(result.invalid, 401);
});
