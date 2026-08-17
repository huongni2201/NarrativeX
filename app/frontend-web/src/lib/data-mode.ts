export type DataMode = "mock" | "api";

const configuredMode = process.env.NEXT_PUBLIC_NX_DATA_MODE;

function resolveDataMode(): DataMode {
  if (configuredMode === undefined || configuredMode === "") {
    return process.env.NODE_ENV === "development" ? "mock" : "api";
  }

  if (configuredMode !== "mock" && configuredMode !== "api") {
    throw new Error("NEXT_PUBLIC_NX_DATA_MODE must be either 'mock' or 'api'.");
  }

  if (configuredMode === "mock" && process.env.NODE_ENV !== "development") {
    throw new Error("Mock data mode is only available in local development.");
  }

  return configuredMode;
}

export const DATA_MODE = resolveDataMode();
export const isMockDataMode = DATA_MODE === "mock";
