import { Link } from "react-router-dom";
import { Mic2 } from "lucide-react";
import { characterVoiceReady, currentCharacterVoice } from "../model/character-voice";
import { useCharacterVoiceProfiles } from "../queries/character-voice.queries";

export function CharacterVoiceSummary({ projectId, characterId }: Readonly<{ projectId: string; characterId: string }>) {
  const query = useCharacterVoiceProfiles(characterId);
  const voice = currentCharacterVoice(query.data);
  return <section className="mb-4 rounded-lg border border-border-subtle bg-surface-panel p-4">
    <h3 className="flex items-center gap-2 text-body font-semibold text-foreground"><Mic2 size={16} />Giọng nói</h3>
    <p className="mt-2 text-body text-text-secondary">{query.isLoading ? "Đang tải giọng…" : query.isError ? "Không tải được hồ sơ giọng." : characterVoiceReady(query.data) ? voice?.voiceDescription : "Chưa thiết lập giọng cho nhân vật."}</p>
    <Link to={`/projects/${projectId}/audio?tab=characters&characterId=${encodeURIComponent(characterId)}`} className="mt-3 inline-flex min-h-9 items-center rounded-md border border-border px-3 text-body font-medium text-primary hover:bg-primary-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Thiết lập giọng</Link>
  </section>;
}
