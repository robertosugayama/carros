import { test } from "node:test";
import assert from "node:assert/strict";
import type { GenerateContentParameters } from "@google/genai";
import { createResilientGenerator } from "../geminiGateway.ts";
import { imageServiceFailure } from "../aiErrors.ts";
const request: GenerateContentParameters = {
  model: "gemini-retired-image",
  contents: [{ text: "photo edit" }],
  config: { responseModalities: ["TEXT", "IMAGE"] },
};
const models = [
  {
    name: "models/gemini-current-flash-image",
    supportedActions: ["generateContent"],
  },
  {
    name: "models/gemini-current-flash",
    supportedActions: ["generateContent"],
  },
  { name: "models/imagen-fast", supportedActions: ["predict"] },
];
test("modelo retirado é substituído por modelo de imagem listado para a chave e reutilizado", async () => {
  const calls: string[] = [];
  let lists = 0;
  const client = {
    generate: async (r: GenerateContentParameters) => {
      calls.push(r.model);
      assert.deepEqual(r.contents, request.contents);
      assert.equal(r.config?.httpOptions?.retryOptions?.attempts, 1);
      if (r.model === request.model) throw { status: 404 };
      assert.equal(r.model, "gemini-current-flash-image");
      return { ok: true };
    },
    list: async () => {
      lists++;
      return models;
    },
  };
  const generate = createResilientGenerator(client, "test-model-switch");
  assert.deepEqual(await generate(request), { ok: true });
  assert.deepEqual(await generate(request), { ok: true });
  assert.equal(lists, 1);
  assert.equal(calls.filter((n) => n === request.model).length, 1);
});
test("recorte usa alternativa de visão e não modelo de geração de imagem", async () => {
  const generate = createResilientGenerator({
    generate: async (r) => {
      if (r.model === "gemini-retired-flash") throw { status: 404 };
      assert.equal(r.model, "gemini-current-flash");
      assert.equal(r.config?.responseMimeType, "application/json");
      return { text: "{}" };
    },
    list: async () => models,
  });
  await generate({
    model: "gemini-retired-flash",
    contents: [],
    config: { responseMimeType: "application/json" },
  });
});
test("chave inválida, cota e entrada inválida não disparam outras chamadas pagas", async () => {
  for (const cause of [
    { status: 400, message: "API_KEY_INVALID" },
    { status: 429 },
    { status: 403 },
    { status: 400, message: "Invalid image resolution" },
  ]) {
    let calls = 0;
    const generate = createResilientGenerator({
      generate: async () => {
        calls++;
        throw cause;
      },
      list: async () => {
        throw Error("não deve listar");
      },
    });
    await assert.rejects(() => generate(request));
    assert.equal(calls, 1);
  }
  assert.equal(
    imageServiceFailure({ status: 400, message: "Invalid image resolution" })
      .code,
    "AI_INVALID_REQUEST",
  );
});
test("indisponibilidade temporária tem só uma repetição; modelo inexistente não é inventado", async () => {
  let calls = 0;
  const generate = createResilientGenerator({
    generate: async () => {
      calls++;
      if (calls === 1) throw { status: 503 };
      return { ok: true };
    },
    list: async () => [],
  });
  await generate(request);
  assert.equal(calls, 2);
  const failed = createResilientGenerator({
    generate: async () => {
      throw { status: 404 };
    },
    list: async () => [],
  });
  await assert.rejects(
    () =>
      failed({
        model: "gemini-retired",
        contents: [],
        config: { responseMimeType: "application/json" },
      }),
    (cause) =>
      imageServiceFailure(cause).code === "AI_VISION_MODEL_UNAVAILABLE",
  );
});

test("integração com SDK interpreta catálogo REST real e troca modelo sem adivinhar nomes", async () => {
  const { GoogleGenAI } = await import("@google/genai");
  const { geminiGenerator } = await import("../geminiGateway.ts");
  const paths: string[] = [];
  const ai = new GoogleGenAI({
    apiKey: "test-only-key",
    httpOptions: {
      fetch: async (url, init) => {
        const path = new URL(String(url)).pathname;
        paths.push(path);
        if (path.endsWith("/models"))
          return new Response(
            JSON.stringify({
              models: [
                {
                  name: "models/gemini-current-flash-image",
                  supportedGenerationMethods: ["generateContent"],
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        if (path.includes("gemini-retired-image"))
          return new Response(
            JSON.stringify({
              error: {
                code: 404,
                status: "NOT_FOUND",
                message: "Model not found",
              },
            }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        assert.ok(path.includes("gemini-current-flash-image"));
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "edited" }] } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  });
  const result = await geminiGenerator(ai)(request);
  assert.equal(result.text, "edited");
  assert.equal(paths.length, 3);
});
