import { createHash } from "node:crypto";
import type {
  GenerateContentParameters,
  GoogleGenAI,
  Model,
} from "@google/genai";
import { AiModelUnavailableError, isUnavailableModel } from "./aiErrors.ts";
type Stage = "image" | "vision";
type State = {
  expires: number;
  models?: Model[];
  preferred: Partial<Record<Stage, string>>;
};
const states = new Map<string, State>();
export function createResilientGenerator<T>(
  client: {
    generate: (request: GenerateContentParameters) => Promise<T>;
    list: () => Promise<Model[]>;
  },
  cacheKey = "",
) {
  const now = Date.now();
  const key = cacheKey
    ? createHash("sha256").update(cacheKey).digest("hex")
    : "";
  let state = key ? states.get(key) : undefined;
  if (!state || state.expires < now) {
    state = { expires: now + 300000, preferred: {} };
    if (key) states.set(key, state);
    if (states.size > 8) states.delete(states.keys().next().value!);
  }
  const active = state,
    deadline = now + 85000;
  return async (request: GenerateContentParameters): Promise<T> => {
    const stage: Stage = request.config?.responseModalities?.includes("IMAGE")
      ? "image"
      : "vision";
    let model =
      active.preferred[stage] || request.model.trim().replace(/^models\//, "");
    let switched = false,
      retried = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 1000)
        throw Object.assign(Error("AI request deadline"), {
          name: "TimeoutError",
        });
      const timeout = Math.min(stage === "image" ? 45000 : 20000, remaining);
      try {
        const result = await client.generate({
          ...request,
          model,
          config: {
            ...request.config,
            httpOptions: {
              ...request.config?.httpOptions,
              timeout,
              retryOptions: { attempts: 1 },
            },
            abortSignal: request.config?.abortSignal
              ? AbortSignal.any([
                  request.config.abortSignal,
                  AbortSignal.timeout(timeout),
                ])
              : AbortSignal.timeout(timeout),
          },
        });
        active.preferred[stage] = model;
        return result;
      } catch (cause) {
        if (isUnavailableModel(cause) && !switched) {
          switched = true;
          // Discovery uses the same key; never guess model names after a 404.
          if (active.preferred[stage] === model) {
            delete active.preferred[stage];
            active.models = undefined;
          }
          active.models ||= await client.list();
          const candidates = active.models
            .filter((m) => {
              const name = m.name?.replace(/^models\//, "") || "";
              if (
                !/^gemini-[a-z0-9.-]+$/i.test(name) ||
                name === model ||
                !m.supportedActions?.includes("generateContent")
              )
                return false;
              if (stage === "image")
                return /image/.test(name) && !/live|tts|audio/.test(name);
              return (
                /flash/.test(name) &&
                !/image|live|tts|audio|lite|embedding|robotics/.test(name)
              );
            })
            .sort((a, b) => {
              const rank = (m: Model) =>
                (/flash/.test(m.name || "") ? 4 : 0) +
                (!/preview|exp/.test(m.name || "") ? 2 : 0);
              return (
                rank(b) - rank(a) ||
                (b.name || "").localeCompare(a.name || "", undefined, {
                  numeric: true,
                })
              );
            });
          if (!candidates.length) throw new AiModelUnavailableError(stage);
          model = candidates[0].name!.replace(/^models\//, "");
          console.info("AI_MODEL_SWITCH", { stage });
          continue;
        }
        const status = Number((cause as { status?: number })?.status);
        if (
          [500, 502, 503].includes(status) &&
          !retried &&
          deadline - Date.now() > 5000
        ) {
          retried = true;
          console.info("AI_TRANSIENT_RETRY", { stage, status });
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        if (isUnavailableModel(cause)) throw new AiModelUnavailableError(stage);
        throw cause;
      }
    }
    throw new AiModelUnavailableError(stage);
  };
}
export function geminiGenerator(ai: GoogleGenAI) {
  return createResilientGenerator(
    {
      generate: (request) => ai.models.generateContent(request),
      list: async () => {
        const pager = await ai.models.list({
          config: {
            pageSize: 100,
            abortSignal: AbortSignal.timeout(8000),
            httpOptions: { timeout: 8000, retryOptions: { attempts: 1 } },
          },
        });
        const result: Model[] = [];
        for await (const model of pager) {
          result.push(model);
          if (result.length >= 200) break;
        }
        return result;
      },
    },
    process.env.GEMINI_API_KEY,
  );
}
