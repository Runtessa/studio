import { buildOperationsFromDirectives } from "./codex-directives";
import { pickInput, toToolId } from "./codex-normalization";
import type { CodexOperation, FileDirective } from "./codex-types";
import type { WorkspaceContext } from "./workspace-context";

const fileTools = new Set(["create_file", "update_file", "delete_file"]);

// Native workspace diffs are one batch. Mapping each file independently loses
// the mapper's planned-project state and recreates a shared package per file.
export const expandWorkspaceFileBatch = (
  operations: CodexOperation[],
  workspace: WorkspaceContext,
): CodexOperation[] | null => {
  if (!operations.length) return null;
  const directives: FileDirective[] = [];
  for (const operation of operations) {
    const tool = toToolId(
      String(
        operation.tool ||
          operation.name ||
          operation.action ||
          operation.toolId ||
          "",
      ),
    );
    if (!fileTools.has(tool)) return null;
    const input =
      operation.input &&
      typeof operation.input === "object" &&
      !Array.isArray(operation.input)
        ? operation.input
        : {};
    const path = pickInput(input, ["path", "filePath", "file", "virtualPath"]);
    if (typeof path !== "string" || !path.trim()) return null;
    const content = pickInput(input, ["content", "code", "source", "body"]);
    directives.push({
      path,
      action:
        tool === "create_file"
          ? "create"
          : tool === "delete_file"
            ? "delete"
            : "edit",
      content: typeof content === "string" ? content : "",
    });
  }
  // Preserve the existing per-operation error reporting for unsupported paths.
  if (
    directives.some(
      (directive) =>
        !buildOperationsFromDirectives([directive], workspace).length,
    )
  )
    return null;
  const expanded = buildOperationsFromDirectives(directives, workspace);
  return expanded.length ? expanded : null;
};
