export interface EditorMutationSnapshot {
  requestId: number;
  beatId: string;
}

export function isEditorMutationCurrent(
  current: EditorMutationSnapshot,
  mutation: EditorMutationSnapshot,
): boolean {
  return current.requestId === mutation.requestId && current.beatId === mutation.beatId;
}
