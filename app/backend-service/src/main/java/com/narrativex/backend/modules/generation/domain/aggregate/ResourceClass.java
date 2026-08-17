package com.narrativex.backend.modules.generation.domain.aggregate;

public enum ResourceClass {
    PROVIDER_INTERACTIVE,
    PROVIDER_BATCH,
    GPU_HEAVY,
    CPU_RENDER,
    CPU_LIGHT,
    BACKGROUND,
    NOTIFICATION
}
