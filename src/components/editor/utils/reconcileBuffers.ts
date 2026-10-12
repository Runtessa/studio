import type { ActiveFile } from "../types";
import type { AssistantChange } from "@/lib/assistant/types";

export const assistantChangedBufferIds = (
  files: ActiveFile[],
  changes: AssistantChange[],
) =>
  files
    .filter((file) =>
      changes.some((change) => {
        const meta = file.meta;
        if (!meta) return false;
        if (change.kind === "acl")
          return meta.kind === "acl" && meta.file === change.file;
        const ids = [change.before?.id, change.after?.id].filter(Boolean);
        if (change.kind === "shared-project")
          return meta.kind === "shared" && ids.includes(meta.projectId);
        if (change.kind === "shared-file")
          return (
            meta.kind === "shared" &&
            meta.projectId === change.projectId &&
            ids.includes(meta.fileId)
          );
        return (
          meta.kind === change.kind &&
          "backendId" in meta &&
          ids.includes(meta.backendId)
        );
      }),
    )
    .map((file) => file.id);

// A server refresh updates clean buffers while retaining unrelated unsaved edits.
// An explicit assistant apply/rollback replaces only the files in that operation.
export const reconcileSavedBuffers = (
  current: Record<string, string>,
  previousSaved: Record<string, string>,
  nextSaved: Record<string, string>,
  replacedIds: string[] = [],
) => {
  const replaced = new Set(replacedIds);
  const next = { ...current };
  for (const id of Object.keys(current)) {
    if (!replaced.has(id) && current[id] !== previousSaved[id]) continue;
    if (nextSaved[id] === undefined) delete next[id];
    else next[id] = nextSaved[id];
  }
  return next;
};
