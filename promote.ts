if (process.env.DATA_PROVIDER !== "legacy")
  throw Error(
    "No Firebase, cadastre a conta e altere users/{UID}.role para master no console Firestore. Este comando só atende ao modo legado.",
  );
const { db, client } = await import("./database.ts");
const email = process.argv[2]?.trim().toLowerCase();
if (!email) throw Error("Uso: npm run admin -- email-da-conta");
const r = await db
  .prepare("UPDATE users SET role='master',blocked=0 WHERE email=?")
  .run(email);
client.close();
if (!r.changes) throw Error("Cadastre a conta primeiro.");
console.log("Conta promovida a master.");

export {};
