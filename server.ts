const provider = process.env.DATA_PROVIDER || "firebase";
const app = (
  provider === "legacy"
    ? await import("./legacyServer.ts")
    : await import("./firebaseServer.ts")
).default;
export default app;
if (!process.env.VERCEL)
  app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
    console.log(`AutoTuner (${provider}) na porta ${process.env.PORT || 3000}`),
  );
