import { db, client } from "./database.ts";
const email = process.argv[2]?.trim().toLowerCase();
if (!email) throw Error("Uso: npm run admin -- email-da-conta");
const r = await db
  .prepare("UPDATE users SET role='master',blocked=0 WHERE email=?")
  .run(email);
client.close();
if (!r.changes) throw Error("Cadastre a conta primeiro.");
console.log("Conta promovida a master.");
