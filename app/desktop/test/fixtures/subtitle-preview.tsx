import { useState } from "react";
import { createRoot } from "react-dom/client";
import { EditorPreviewViewport } from "../../src/renderer/features/editor/components/EditorPreviewViewport";
import { SubtitleSettingsPanel } from "../../src/renderer/features/production/components/SubtitleSettingsPanel";
import { DEFAULT_SUBTITLE_STYLE } from "../../src/shared/subtitle-style";
import type { RenderController } from "../../src/renderer/features/production/useRenderController";
import "../../src/renderer/styles.css";

function Fixture() {
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [resolution, setResolution] = useState("720p");
  const [style, setStyle] = useState({ ...DEFAULT_SUBTITLE_STYLE, fontSizeRatio: 0.02, edgeMarginRatio: 0.02 });
  const [enabled, setEnabled] = useState(true);
  const [narrow, setNarrow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const controller = {
    subtitleStyle: style, setSubtitleStyle: setStyle, subtitlesEnabled: enabled, setSubtitlesEnabled: setEnabled,
    resolution, busy: false, subtitleSettingsSaving: false, subtitleSettingsLoading: false,
    subtitleSettingsReady: true, subtitleSettingsDirty: true, subtitleSettingsError: null,
    resetSubtitleStyle: () => setStyle({ ...DEFAULT_SUBTITLE_STYLE }), saveSubtitleSettings: async () => {},
  } as unknown as RenderController;
  const noop = () => {};
  return <main style={{ overflow: "auto", height: "100%", padding: 12 }}>
    <label>Frame ratio<select aria-label="Frame ratio" value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)}>
      {["16:9", "9:16", "1:1", "4:3"].map((ratio) => <option key={ratio}>{ratio}</option>)}</select></label>
    <label>Resolution<select aria-label="Resolution" value={resolution} onChange={(event) => setResolution(event.target.value)}>
      {["720p", "1080p", "1440p", "2160p"].map((value) => <option key={value}>{value}</option>)}</select></label>
    <button onClick={() => setNarrow(!narrow)}>Resize preview</button>
    <button onClick={() => setLoading(!loading)}>Toggle loading</button>
    <button onClick={() => setFailed(!failed)}>Toggle error</button>
    <div data-testid="editor" style={{ width: narrow ? 260 : 880, height: narrow ? 700 : 400 }}>
      <EditorPreviewViewport selectedBeat={null} frameRate={24} subtitleCues={[]} subtitleStyle={style}
        subtitlesEnabled={enabled} aspectRatio={aspectRatio} subtitleReferenceHeight={1280} transitionBlackOpacity={0}
        mediaUrl={null} narrationUrl={null} narrationStartMs={null} narrationEndMs={null}
        previewLoading={loading} previewMessage={failed ? "Fixture media unavailable" : null}
        playheadMs={0} scopeWindowStartMs={0} scopeWindowEndMs={1000} playing={false}
        onTogglePlay={noop} onPrevBeat={noop} onNextBeat={noop} onStepMs={noop}
        onNarrationClock={noop} onNarrationEnded={noop} onPlaybackError={noop} />
    </div>
    <div data-testid="settings" style={{ width: 420 }}><SubtitleSettingsPanel controller={controller} aspectRatio={aspectRatio} /></div>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
