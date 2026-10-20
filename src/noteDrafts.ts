import type {FileData} from './shared';

// Session-only recovery: never writes notes or silently replaces their base hash.
const drafts = new Map<string, {base: FileData; text: string}>();
const latestEdits = new Map<string, string>();
const key = (path: string) => path.replaceAll('\\', '/').toLowerCase();
export function rememberNote(base: FileData, text: string) {
  latestEdits.set(key(base.path), text);
  if (text === base.text) drafts.delete(key(base.path));
  else drafts.set(key(base.path), {base, text});
}
export function recoverNote(file: FileData) { return drafts.get(key(file.path)) ?? {base: file, text: file.text}; }
export function discardNote(path: string) { drafts.delete(key(path)); latestEdits.delete(key(path)); }
export function noteDrafts() { return [...drafts.values()]; }
export function acceptNoteSave(base: FileData, submitted: string, saved: FileData, currentText?: string) {
  const current = drafts.get(key(base.path));
  const latest = latestEdits.get(key(base.path)) ?? current?.text ?? currentText;
  if (latest !== undefined && latest !== submitted) rememberNote(saved, latest);
  else discardNote(base.path);
  return recoverNote(saved);
}

// Invalidates both success and failure paths when a newer request starts.
export function requestSequence() {
  let generation = 0;
  return {next: () => ++generation, current: (id: number) => generation === id, cancel: () => {generation++;}};
}

if (typeof window !== 'undefined') window.addEventListener('beforeunload', event => {
  if (!drafts.size) return;
  event.preventDefault();event.returnValue = '';
});
