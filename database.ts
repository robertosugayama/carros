import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const dir =
  process.env.DATA_DIR || fileURLToPath(new URL("data", import.meta.url));
if (process.env.VERCEL && !process.env.TURSO_DATABASE_URL)
  throw Error("Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN na Vercel.");
if (!process.env.TURSO_DATABASE_URL) mkdirSync(dir, { recursive: true });
export const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:" + dir + "/app.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
export const db = {
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
