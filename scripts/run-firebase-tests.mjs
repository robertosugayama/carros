import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, openSync } from "node:fs";
const jar =
  process.env.FIRESTORE_EMULATOR_JAR || "/tmp/cloud-firestore-emulator.jar";
if (!existsSync(jar))
  execFileSync("python3", ["scripts/fetch-firestore-emulator.py"], {
    stdio: "inherit",
  });
const children = [],
  env = {
    ...process.env,
    CI: "1",
    FIREBASE_CLI_DISABLE_UPDATE_CHECK: "1",
    XDG_CONFIG_HOME: "/tmp/autotuner-firebase-config",
    GCLOUD_PROJECT: "demo-autotuner",
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8089",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  };
function launch(cmd, args, name) {
  const child = spawn(cmd, args, {
    env,
    stdio: [
      "ignore",
      openSync("/tmp/autotuner-" + name + ".log", "w"),
      openSync("/tmp/autotuner-" + name + "-error.log", "w"),
    ],
  });
  children.push(child);
  return child;
}
async function ready(url, child) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw Error("Emulator exited; inspect /tmp/autotuner-*-error.log");
    try {
      await fetch(url);
      return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw Error("Emulator startup timeout");
}
async function run(cmd, args, extra = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      env: { ...env, ...extra },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(Error("Command failed with " + code)),
    );
  });
}
async function ensureFree(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        Error(
          "A porta " +
            port +
            " já está em uso. Encerre seu emulador antes de executar o teste.",
        ),
      ),
    );
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}
try {
  await ensureFree(8089);
  await ensureFree(9099);
  const firestore = launch(
    "java",
    [
      "-Xmx512m",
      "-cp",
      jar,
      "com.google.cloud.datastore.emulator.firestore.CloudFirestore",
      "--host",
      "127.0.0.1",
      "--port",
      "8089",
      "--project_id",
      "demo-autotuner",
      "--rules",
      "firebase/firestore.rules",
    ],
    "firestore",
  );
  await ready("http://127.0.0.1:8089", firestore);
  const auth = launch(
    process.execPath,
    [
      "node_modules/firebase-tools/lib/bin/firebase.js",
      "emulators:start",
      "--only",
      "auth",
      "--project",
      "demo-autotuner",
      "--config",
      "firebase.json",
      "--non-interactive",
    ],
    "auth",
  );
  await ready("http://127.0.0.1:9099", auth);
  await run(process.execPath, ["--test", "tests/firebase.rules.mjs"]);
  await run(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "build",
      "--outDir",
      "/tmp/autotuner-firebase-dist",
      "--emptyOutDir",
    ],
    {
      VITE_FIREBASE_EMULATORS: "true",
      VITE_FIREBASE_PROJECT_ID: "demo-autotuner",
      VITE_DATA_PROVIDER: "firebase",
    },
  );
  await run(process.execPath, ["tests/firebase.browser.mjs"]);
} finally {
  for (const child of children) child.kill("SIGTERM");
}
