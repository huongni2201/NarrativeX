import { runAuthenticatedAction } from "../auth/authenticated-action";

export interface CommandHistory<T> {
  present: T;
  past: T[];
  future: T[];
}

const EDITOR_MUTATION_REASON =
  "Đăng nhập để chỉnh sửa video. Project và vị trí hiện tại sẽ được giữ nguyên.";

export function createCommandHistory<T>(initial: T): CommandHistory<T> {
  return { present: initial, past: [], future: [] };
}

export function commitCommand<T>(history: CommandHistory<T>, next: T): CommandHistory<T> {
  let result = history;
  runAuthenticatedAction(() => {
    result = { present: next, past: [...history.past, history.present], future: [] };
  }, EDITOR_MUTATION_REASON);
  return result;
}

export function undoCommand<T>(history: CommandHistory<T>): CommandHistory<T> {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  let result = history;
  runAuthenticatedAction(() => {
    result = {
      present: previous,
      past: history.past.slice(0, -1),
      future: [history.present, ...history.future],
    };
  }, EDITOR_MUTATION_REASON);
  return result;
}

export function redoCommand<T>(history: CommandHistory<T>): CommandHistory<T> {
  const next = history.future[0];
  if (next === undefined) return history;
  let result = history;
  runAuthenticatedAction(() => {
    result = {
      present: next,
      past: [...history.past, history.present],
      future: history.future.slice(1),
    };
  }, EDITOR_MUTATION_REASON);
  return result;
}
