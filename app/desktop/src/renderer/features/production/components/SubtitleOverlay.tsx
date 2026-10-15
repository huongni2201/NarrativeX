import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { SubtitleStyle } from "../../../../shared/api-types";
import { subtitleGeometry } from "../../../../shared/subtitle-style";

/** Scales the same pixel geometry as ASS into the actual video frame. */
export function SubtitleOverlay({ text, style, referenceHeight = 1080 }: Readonly<{
  text: string; style: SubtitleStyle; referenceHeight?: number;
}>) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({
      width: entry.contentRect.width, height: entry.contentRect.height,
    }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const scale = size.height / referenceHeight;
  const geometry = subtitleGeometry(style, scale ? size.width / scale : 1920, referenceHeight);
  const vertical = style.position.split("_")[0];
  const horizontal = style.position.split("_")[1];
  const box = geometry.borderStyle === 3;
  const backgroundColor = `${style.backgroundColor}${(255 - Math.round((1 - style.backgroundOpacity) * 255)).toString(16).padStart(2, "0")}`;
  const textStyle: CSSProperties = {
    fontFamily: style.fontFamily, fontWeight: style.fontWeight,
    fontSize: geometry.fontSize * scale, lineHeight: 1.15,
    color: style.primaryColor,
    backgroundColor: box ? backgroundColor : "transparent",
    padding: box ? geometry.outline * scale : 0,
    WebkitTextStroke: !box && geometry.outline ? `${2 * geometry.outline * scale}px ${style.outlineColor}` : undefined,
    paintOrder: "stroke fill",
    textShadow: geometry.shadow ? `${geometry.shadow * scale}px ${geometry.shadow * scale}px 0 ${box ? backgroundColor : style.outlineColor}` : undefined,
    textAlign: horizontal === "LEFT" ? "left" : horizontal === "RIGHT" ? "right" : "center",
    maxWidth: "100%", overflowWrap: "anywhere", whiteSpace: "pre-wrap", textWrap: "balance",
  };
  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 z-20" aria-label="Subtitle preview">
      <div className="absolute flex" style={{
        left: geometry.marginH * scale, right: geometry.marginH * scale,
        top: vertical === "TOP" ? geometry.marginV * scale : vertical === "MIDDLE" ? "50%" : undefined,
        bottom: vertical === "BOTTOM" ? geometry.marginV * scale : undefined,
        transform: vertical === "MIDDLE" ? "translateY(-50%)" : undefined,
        justifyContent: horizontal === "LEFT" ? "flex-start" : horizontal === "RIGHT" ? "flex-end" : "center",
      }}><span style={textStyle}>{text}</span></div>
    </div>
  );
}
