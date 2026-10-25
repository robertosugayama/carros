import { test } from "node:test";
import assert from "node:assert/strict";
import { uploadStorageImage } from "../storageUpload.ts";
const image = "data:image/png;base64,aGVsbG8=";
const user = { id: "owner-123", role: "user" };
test("envio alternativo usa token do usuário, limita destino e informa bucket ausente", async () => {
  for (const path of [
    "users/other/wheelPhotos/a.png",
    "catalog/owner-123/a.png",
    "users/owner-123/../a.png",
  ]) {
    const result = await uploadStorageImage(
      { image, path },
      user,
      "token-test",
      "bucket",
      async () => {
        throw Error("não deve acessar rede");
      },
    );
    assert.equal(result.status, 400);
  }
  const failed = await uploadStorageImage(
    { image, path: "users/owner-123/wheelPhotos/a.png" },
    user,
    "token-test",
    "bucket",
    async (url, options) => {
      assert.match(String(url), /uploadType=media/);
      assert.equal(
        (options!.headers as Record<string, string>).Authorization,
        "Firebase token-test",
      );
      return new Response("", { status: 404 });
    },
  );
  assert.equal(failed.status, 503);
  assert.match(failed.body.error!, /bucket/);
  const result = await uploadStorageImage(
    { image, path: "catalog/owner-123/a.webp" },
    { ...user, role: "master" },
    "token-test",
    "bucket",
    async () =>
      new Response(
        JSON.stringify({
          name: "catalog/owner-123/a.webp",
          downloadTokens: "download-token-test",
        }),
        { status: 200 },
      ),
  );
  assert.equal(result.status, 200);
  assert.match(result.body.image!, /alt=media&token=download-token-test/);
});
