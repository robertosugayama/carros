import { test } from "node:test";
import assert from "node:assert/strict";
import { imageServiceFailure, WheelPreparationError } from "../aiErrors.ts";
test("falhas de IA identificam configuração, cota e preparo sem expor conteúdo do provedor", () => {
  for (const [cause, code] of [
    [{ status: 429, message: "secret-test" }, "AI_QUOTA_EXCEEDED"],
    [{ status: 400, message: "API_KEY_INVALID secret-test" }, "AI_KEY_INVALID"],
    [{ status: 403, message: "secret-test" }, "AI_ACCESS_DENIED"],
    [{ status: 404, message: "secret-test" }, "AI_IMAGE_MODEL_UNAVAILABLE"],
    [
      { status: 400, message: "model does not support image secret-test" },
      "AI_IMAGE_MODEL_UNAVAILABLE",
    ],
    [{ name: "TimeoutError", message: "secret-test" }, "AI_TIMEOUT"],
    [Error("secret-test"), "AI_PROVIDER_FAILURE"],
  ] as const) {
    const result = imageServiceFailure(cause);
    assert.equal(result.code, code);
    assert.ok(!JSON.stringify(result).includes("secret-test"));
  }
  assert.equal(
    imageServiceFailure(new WheelPreparationError("Foto inadequada")).error,
    "Foto inadequada",
  );
});
