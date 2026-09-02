package com.narrativex.backend.feature.generation.application.service;

import java.util.regex.Pattern;

/** Adapts sensitive story wording into non-graphic still-image direction without changing plot facts. */
public final class VisualPromptSafety {
  private static final Pattern VI_TIED =
      Pattern.compile("(?iu)\\b(?:bị\\s+)?trói(?:\\s+chặt)?\\b");
  private static final Pattern VI_GAGGED =
      Pattern.compile("(?iu)(?:miệng\\s+)?bị\\s+bịt(?:\\s+bằng\\s+[^,.!?;]+)?|bịt\\s+miệng");
  private static final Pattern VI_BLOOD =
      Pattern.compile("(?iu)\\bmáu(?:\\s+chảy)?(?:\\s+[^,.!?;]+)?");
  private static final Pattern VI_NUDE =
      Pattern.compile("(?iu)\\b(?:khỏa\\s+thân|trần\\s+truồng)\\b");
  private static final Pattern VI_TORTURE =
      Pattern.compile("(?iu)\\b(?:tra\\s+tấn|hành\\s+hạ)\\b");

  private static final Pattern EN_TIED =
      Pattern.compile("(?iu)\\b(?:tied\\s+up|bound|restrained)\\b");
  private static final Pattern EN_GAGGED =
      Pattern.compile("(?iu)\\b(?:gagged|gagging|gag)\\b");
  private static final Pattern EN_BLOOD =
      Pattern.compile("(?iu)\\b(?:bloody|blood|gore|gory)\\b");
  private static final Pattern EN_NUDE =
      Pattern.compile("(?iu)\\b(?:naked|nude)\\b");
  private static final Pattern EN_TORTURE =
      Pattern.compile("(?iu)\\b(?:torture|tortured)\\b");

  private VisualPromptSafety() {}

  public static String sanitizeSceneDirection(String input) {
    if (input == null || input.isBlank()) return input;
    String value = input.trim();
    value = VI_TIED.matcher(value).replaceAll("bị hạn chế cử động trong tình huống căng thẳng");
    value = VI_GAGGED.matcher(value).replaceAll("không thể lên tiếng");
    value = VI_BLOOD.matcher(value).replaceAll("dấu hiệu chấn thương nhẹ, không mô tả trực diện");
    value = VI_NUDE.matcher(value).replaceAll("mặc trang phục kín đáo phù hợp bối cảnh");
    value = VI_TORTURE.matcher(value).replaceAll("tình huống đe dọa được thể hiện gián tiếp");

    value = EN_TIED.matcher(value).replaceAll("movement restricted in a tense situation");
    value = EN_GAGGED.matcher(value).replaceAll("unable to speak");
    value = EN_BLOOD.matcher(value).replaceAll("non-graphic sign of minor injury");
    value = EN_NUDE.matcher(value).replaceAll("appropriately clothed");
    value = EN_TORTURE.matcher(value).replaceAll("a threatening situation shown indirectly");
    return value.replaceAll("\\s{2,}", " ").trim();
  }
}
