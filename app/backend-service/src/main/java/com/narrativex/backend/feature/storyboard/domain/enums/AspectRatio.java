package com.narrativex.backend.feature.storyboard.domain.enums;

public enum AspectRatio {
    RATIO_16_9("16:9"),
    RATIO_9_16("9:16"),
    RATIO_1_1("1:1"),
    RATIO_4_3("4:3"),
    RATIO_3_4("3:4");

    private final String code;

    AspectRatio(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    public static AspectRatio fromCode(String code) {
        for (AspectRatio ratio : values()) {
            if (ratio.code.equals(code)) {
                return ratio;
            }
        }
        throw new IllegalArgumentException("Unsupported aspect ratio: " + code);
    }
}
