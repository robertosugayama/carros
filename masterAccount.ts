import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { db as database } from "./database.ts";
export function masterPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
function matches(password: string, encoded: string) {
  const [salt, hash] = encoded.split(":");
  if (!salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) return false;
  return timingSafeEqual(
    Buffer.from(hash, "hex"),
    scryptSync(password, salt, 64),
  );
}
export async function ensureMaster(
  db: typeof database,
  settings: { email?: string; password?: string },
) {
  const email = settings.email?.trim().toLowerCase() || "",
    password = settings.password || "";
  if (!email && !password) return "disabled";
  if (
    !/^[^\s@]+@[^\s@]+$/.test(email) ||
    email.length > 254 ||
    password.length < 6 ||
    password.length > 128
  )
    return "incomplete";
  const existing = await db
    .prepare("SELECT * FROM users WHERE email=?")
    .get(email);
  if (existing?.role === "master") return "existing";
  if (existing) {
    if (!matches(password, existing.password)) return "conflict";
    await db
      .prepare("UPDATE users SET role='master' WHERE id=?")
      .run(existing.id);
    return "promoted";
  }
  const result = await db
    .prepare(
      "INSERT OR IGNORE INTO users(name,email,password,role) VALUES(?,?,?,'master')",
    )
    .run("Administrador master", email, masterPasswordHash(password));
  if (result.changes) return "created";
  // A concurrent signup must not acquire master privileges with a different password.
  const current = await db
    .prepare("SELECT * FROM users WHERE email=?")
    .get(email);
  if (current?.role === "master") return "existing";
  if (!current || !matches(password, current.password)) return "conflict";
  await db.prepare("UPDATE users SET role='master' WHERE id=?").run(current.id);
  return "promoted";
}
