export interface VertexGeminiHealth {
  status: string;
  location: string;
  model: string;
  externalCallVerified: boolean;
}

export interface ProviderHealth {
  vertexGemini: VertexGeminiHealth;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isVertexGeminiHealth(value: unknown): value is VertexGeminiHealth {
  return (
    isRecord(value) &&
    isString(value.status) &&
    isString(value.location) &&
    isString(value.model) &&
    isBoolean(value.externalCallVerified)
  );
}

export function isProviderHealth(value: unknown): value is ProviderHealth {
  return isRecord(value) && isVertexGeminiHealth(value.vertexGemini);
}
