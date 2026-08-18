export type DataMode = "mock" | "api";

type DataModeRuntime = {
    configuredMode?: string;
    nodeEnv?: string;
    storybook?: string;
};

export function resolveDataMode({
    configuredMode = process.env.NEXT_PUBLIC_NX_DATA_MODE,
    nodeEnv = process.env.NODE_ENV,
    storybook = process.env.STORYBOOK,
}: DataModeRuntime = {}): DataMode {
    if (configuredMode === undefined || configuredMode === "") {
        return "api";
    }

    if (configuredMode !== "mock" && configuredMode !== "api") {
        throw new Error("NEXT_PUBLIC_NX_DATA_MODE must be either 'mock' or 'api'.");
    }

    const isTestRuntime = nodeEnv === "test";
    const isStorybookRuntime = storybook === "true" || storybook === "1";

    if (configuredMode === "mock" && !isTestRuntime && !isStorybookRuntime) {
        throw new Error(
            "Mock data mode is only available in test or Storybook runtimes. Application runtimes must use API mode.",
        );
    }

    return configuredMode;
}

export const DATA_MODE = resolveDataMode();
export const isMockDataMode = DATA_MODE === "mock";
