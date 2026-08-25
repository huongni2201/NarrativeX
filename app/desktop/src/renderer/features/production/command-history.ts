export interface CommandHistory<T> {
  present: T;
  past: T[];
  future: T[];
}

export function createCommandHistory<T>(initial: T): CommandHistory<T> {
  return { present: initial, past: [], future: [] };
}

export function commitCommand<T>(history: CommandHistory<T>, next: T): CommandHistory<T> {
  return { present: next, past: [...history.past, history.present], future: [] };
}

export function undoCommand<T>(history: CommandHistory<T>): CommandHistory<T> {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return { present: previous, past: history.past.slice(0, -1), future: [history.present, ...history.future] };
}

export function redoCommand<T>(history: CommandHistory<T>): CommandHistory<T> {
  const next = history.future[0];
  if (next === undefined) return history;
  return { present: next, past: [...history.past, history.present], future: history.future.slice(1) };
}
