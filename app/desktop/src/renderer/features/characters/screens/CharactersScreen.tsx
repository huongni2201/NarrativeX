import { useState, type FormEvent } from "react";
import type { DesktopCharacter } from "@narrativex/client-contracts";
import { Plus, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, FeaturePage } from "../../workspace/components/FeaturePage";
import { useCreateCharacter } from "../queries/characters.queries";

export function CharactersScreen({
  projectId,
  characters,
}: Readonly<{
  projectId: string;
  characters: DesktopCharacter[];
}>) {
  const createCharacter = useCreateCharacter(projectId);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setNotice(null);
    try {
      await createCharacter.mutateAsync({ canonicalName: name.trim() });
      setName("");
      setNotice("Character đã được tạo và assign vào project.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể tạo character.");
    }
  }

  return (
    <FeaturePage
      title="Character Library"
      description="Character domain có API và query ownership riêng; editor chỉ sử dụng kết quả đã đồng bộ."
    >
      <form
        className="mb-4 flex items-end gap-2 rounded-lg border border-border bg-card p-3"
        onSubmit={(event) => void create(event)}
      >
        <label className="grid min-w-[260px] gap-1 text-[10px] text-muted-foreground">
          Canonical name
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tên nhân vật" />
        </label>
        <Button type="submit" disabled={!name.trim() || createCharacter.isPending}>
          <Plus size={14} /> {createCharacter.isPending ? "Creating…" : "Create character"}
        </Button>
      </form>
      {notice && <p className="mb-3 text-[10px] text-muted-foreground">{notice}</p>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
        {characters.map((character) => (
          <article key={character.id} className="grid grid-cols-[48px_1fr] gap-3 rounded-lg border border-border bg-card p-3">
            <div className="grid size-12 place-items-center rounded-lg bg-primary-muted text-primary-hover">
              <UserCircle size={28} />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">
                {character.status ?? "ACTIVE"}
              </span>
              <h2 className="truncate text-sm font-semibold">{character.canonicalName}</h2>
              <p className="mt-1 text-[10px] text-muted-foreground">{character.role ?? "Project character"}</p>
              <span className="text-[9px] text-muted-foreground">
                {character.sceneCount ?? 0} scenes · {character.pinnedCharacterVersionId ? "Version locked" : "No version locked"}
              </span>
            </div>
          </article>
        ))}
      </div>
      {!characters.length && (
        <EmptyState title="Chưa có character" description="Tạo nhân vật đầu tiên bằng form phía trên." />
      )}
    </FeaturePage>
  );
}
