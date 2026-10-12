import type { LiveWorkspaceFileUpdate } from '../ai-panel/shared';

export class LiveBufferGuard {
  private original: Record<string, string> = {};
  private emitted: Record<string, string> = {};
  private completed = false;
  private reverted = false;
  readonly conflicts = new Set<string>();
  begin(current: Record<string, string>) {
    this.original = { ...current };
    this.emitted = {};
    this.conflicts.clear();
    this.completed = false;
    this.reverted = false;
  }
  update(saved: Record<string, string>, ids: string[], update: LiveWorkspaceFileUpdate) {
    const expected: Record<string, string> = {};
    const content = update.action === 'delete' ? '' : (update.content ?? '');
    for (const id of ids) {
      expected[id] = this.emitted[id] ?? this.original[id] ?? saved[id] ?? '';
      this.original[id] ??= expected[id];
      this.emitted[id] = content;
    }
    return (current: Record<string, string>) => {
      const next = { ...current };
      for (const id of ids) {
        if ((current[id] ?? saved[id] ?? '') !== expected[id] || this.conflicts.has(id)) {
          this.conflicts.add(id);
          continue;
        }
        next[id] = content;
      }
      return next;
    };
  }
  finishUpdater(revert: boolean) {
    const original = this.original,
      emitted = this.emitted;
    this.completed = true;
    this.reverted = revert;
    return (current: Record<string, string>) => {
      const next = { ...current };
      for (const [id, value] of Object.entries(emitted)) {
        if (current[id] !== value) {
          this.conflicts.add(id);
          continue;
        }
        if (revert) next[id] = original[id];
      }
      return next;
    };
  }
  canRefresh(id: string, content: string | undefined) {
    const expected =
      this.completed && this.reverted ? this.original[id] : (this.emitted[id] ?? this.original[id]);
    if (expected === undefined || this.conflicts.has(id) || content !== expected) {
      this.conflicts.add(id);
      return false;
    }
    return true;
  }
}
