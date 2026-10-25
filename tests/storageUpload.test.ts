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

test("leitura de imagem evita CORS, limita bucket e mantém autorização privada", async () => {
  const { readStorageImage } = await import("../storageRead.ts");
  let calls = 0;
  const fetcher: typeof fetch = async (url, options) => {
    calls++;
    assert.ok(
      String(url).startsWith(
        "https://firebasestorage.googleapis.com/v0/b/bucket/o/",
      ),
    );
    assert.ok(!String(url).includes("download-secret"));
    return new Response(Uint8Array.from([1, 2, 3]), {
      status: 200,
      headers: { "Content-Type": "image/webp" },
    });
  };
  const verify = async () => ({ uid: "owner" });
  const url =
    "https://firebasestorage.googleapis.com/v0/b/bucket/o/users%2Fowner%2FwheelPhotos%2Fa.webp?alt=media&token=download-secret";
  assert.equal(
    (await readStorageImage(url, "bucket", undefined, verify, fetcher)).status,
    401,
  );
  assert.equal(
    (
      await readStorageImage(
        url,
        "bucket",
        "token",
        async () => ({ uid: "other" }),
        fetcher,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await readStorageImage(
        "https://evil.invalid/image.png",
        "bucket",
        "token",
        verify,
        fetcher,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await readStorageImage(
        url.replace("/b/bucket/", "/b/other/"),
        "bucket",
        "token",
        verify,
        fetcher,
      )
    ).status,
    400,
  );
  assert.equal(calls, 0);
  const own = await readStorageImage(
    url,
    "bucket",
    "token",
    verify,
    async (u, o) => {
      assert.equal(
        (o!.headers as Record<string, string>).Authorization,
        "Firebase token",
      );
      return fetcher(u, o);
    },
  );
  assert.equal(own.status, 200);
  assert.equal(own.data?.length, 3);
  const shared = await readStorageImage(
    "https://firebasestorage.googleapis.com/v0/b/bucket/o/catalog%2Fmaster%2Fa.webp",
    "bucket",
    undefined,
    verify,
    fetcher,
  );
  assert.equal(shared.status, 200);
});
