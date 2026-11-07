export class AiConfigurationError extends Error {}

const tlsCodes = new Set([
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "CERT_HAS_EXPIRED",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

// Only classify known fields. Never log SDK errors: they can contain auth
// headers, request payloads and raw provider response bodies.
export function classifyAiError(error: unknown) {
  if (error instanceof AiConfigurationError) return "AI_NOT_CONFIGURED";
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    const record = current as Record<string, unknown>;
    if (typeof record.code === "string" && tlsCodes.has(record.code)) return "AI_TLS_ERROR";
    if (record.code === "ETIMEDOUT" || record.code === "ECONNABORTED") return "AI_TIMEOUT";
    const response = record.response;
    const status =
      response && typeof response === "object" && "status" in response
        ? response.status
        : record.status;
    if (status === 401 || status === 403) return "AI_PROVIDER_UNAUTHORIZED";
    if (status === 429) return "AI_RATE_LIMITED";
    current = record.cause;
  }
  return "AI_UNAVAILABLE";
}
