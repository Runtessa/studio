export type EditorBuffer = {
  id: string;
  name: string;
  meta?: unknown;
  content?: string;
};
export type EditorSelection = {
  fileId: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};
type SourceFile = { id?: string; path: string; kind: string; content: string };

export const resolveEditorFile = <T extends SourceFile>(
  files: T[],
  buffer: EditorBuffer | null | undefined,
): T | undefined => {
  if (!buffer || typeof buffer !== "object" || typeof buffer.id !== "string")
    return;
  const meta =
    buffer.meta && typeof buffer.meta === "object"
      ? (buffer.meta as Record<string, unknown>)
      : {};
  if (
    meta.kind === "acl" &&
    ["permissions", "roles", "endpoints"].includes(String(meta.file))
  ) {
    return files.find((file) => file.path === `modules/acl/${meta.file}.json`);
  }
  const id = String(
    meta.backendId ||
      meta.fileId ||
      buffer.id.replace(/^(?:ui|module|model|shared)-/, ""),
  );
  const kind = String(
    meta.kind || buffer.id.match(/^(ui|module|model|shared)-/)?.[1] || "",
  );
  return files.find(
    (file) =>
      file.id === id &&
      (!kind ||
        file.kind === kind ||
        (kind === "shared" && file.kind.startsWith("shared-"))),
  );
};

export const applyEditorContext = <T extends SourceFile>(
  files: T[],
  active: EditorBuffer | null | undefined,
  openFiles: EditorBuffer[] = [],
  selection?: EditorSelection | null,
) => {
  const buffers = [...openFiles, ...(active ? [active] : [])];
  const open = new Map<string, { path: string; isDirty: boolean }>();
  for (const buffer of buffers) {
    const file = resolveEditorFile(files, buffer);
    if (!file) continue;
    const isDirty =
      typeof buffer.content === "string" && file.content !== buffer.content;
    open.set(file.path, {
      path: file.path,
      isDirty: isDirty || Boolean(open.get(file.path)?.isDirty),
    });
    if (typeof buffer.content === "string") file.content = buffer.content;
  }
  const selectedFile = resolveEditorFile(files, active);
  let selectedCode = null;
  const buffer =
    selection && buffers.find((item) => item?.id === selection.fileId);
  const file = resolveEditorFile(files, buffer);
  if (selection && file) {
    const values = [
      selection.startLineNumber,
      selection.endLineNumber,
      selection.startColumn,
      selection.endColumn,
    ];
    const lines = file.content.split("\n");
    if (
      values.every((value) => Number.isInteger(value) && value > 0) &&
      selection.startLineNumber <= selection.endLineNumber &&
      selection.endLineNumber <= lines.length &&
      (selection.startLineNumber < selection.endLineNumber ||
        selection.startColumn <= selection.endColumn) &&
      selection.startColumn <=
        lines[selection.startLineNumber - 1].length + 1 &&
      selection.endColumn <= lines[selection.endLineNumber - 1].length + 1
    ) {
      const text = lines.slice(
        selection.startLineNumber - 1,
        selection.endLineNumber,
      );
      text[text.length - 1] = text[text.length - 1].slice(
        0,
        selection.endColumn - 1,
      );
      text[0] = text[0].slice(selection.startColumn - 1);
      selectedCode = { ...selection, path: file.path, text: text.join("\n") };
    }
  }
  return {
    selectedFile,
    openFiles: Array.from(open.values()),
    selection: selectedCode,
  };
};
