// Never return provider messages: they may include API keys, URLs or account details.
export class WheelPreparationError extends Error {}
export function imageServiceFailure(cause: unknown) {
  if (cause instanceof WheelPreparationError)
    return {
      status: 422,
      code: "IMAGE_PREPARATION_FAILED",
      error: cause.message,
    };
  const e = cause as {
    status?: number;
    code?: number;
    name?: string;
    message?: string;
  } | null;
  const status = Number(e?.status || e?.code);
  const detail = String(e?.message || "");
  if (status === 429)
    return {
      status: 429,
      code: "AI_QUOTA_EXCEEDED",
      error:
        "A cota do Gemini foi atingida. Confira os limites e o faturamento no Google AI Studio; o plano Blaze do Firebase não garante cota para o Gemini.",
    };
  if (status === 401 || /API_KEY_INVALID|API key not valid/i.test(detail))
    return {
      status: 503,
      code: "AI_KEY_INVALID",
      error:
        "A chave Gemini foi recusada. Confira GEMINI_API_KEY na Vercel e publique novamente.",
    };
  if (status === 403)
    return {
      status: 503,
      code: "AI_ACCESS_DENIED",
      error:
        "O Gemini negou acesso. Confira as permissões, as restrições da chave e o faturamento no Google AI Studio.",
    };
  if (
    status === 404 ||
    (status === 400 && /model|image|response.modalit/i.test(detail))
  )
    return {
      status: 503,
      code: "AI_IMAGE_MODEL_UNAVAILABLE",
      error:
        "O modelo configurado não está disponível para editar imagens. Confira GEMINI_IMAGE_MODEL na Vercel e o acesso a esse modelo no Google AI Studio.",
    };
  if (e?.name === "AbortError" || e?.name === "TimeoutError" || status === 504)
    return {
      status: 504,
      code: "AI_TIMEOUT",
      error:
        "O tratamento demorou além do limite. Tente novamente em instantes.",
    };
  return {
    status: 502,
    code: "AI_PROVIDER_FAILURE",
    error:
      "O serviço de imagens não concluiu o pedido. Tente novamente; se persistir, informe o código AI_PROVIDER_FAILURE.",
  };
}
