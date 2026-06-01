import {
  buildOperationsFromDirectives,
  formatCodexProgressLine,
  parseCodexFileDirectives,
  parseCodexPlan,
  type CodexOperation,
  type CodexPlan,
} from './codex-ops';
import type { AgentWorkspaceSession, WorkspaceContext } from './workspace-context';
import { executeCodex, getLatestUserPrompt, type WorkspaceFileEvent } from './codex-client';

type CodexResolvedPlan = {
  message: string;
  plan: CodexPlan | null;
  operations: CodexOperation[];
  directWorkspaceEdits?: WorkspaceFileEvent[];
};

const mapWorkspaceDiffToOperations = (
  diff: Array<{ path: string; action: 'create' | 'edit' | 'delete'; content?: string }>,
): CodexOperation[] =>
  diff.map((item) => ({
    tool:
      item.action === 'create'
        ? 'create_file'
        : item.action === 'delete'
          ? 'delete_file'
          : 'update_file',
    input:
      item.action === 'delete'
        ? { path: item.path }
        : { path: item.path, content: item.content || '' },
  }));

const codexAskedForUnavailableTools = (message: string) => {
  const text = String(message || '').toLowerCase();
  if (!text) return false;
  return (
    text.includes("tools aren't available") ||
    text.includes('tools are not available') ||
    text.includes('tool isn’t available') ||
    text.includes('tool is not available') ||
    text.includes('list_workspace') ||
    text.includes('get_acl_config') ||
    text.includes('provide their outputs') ||
    text.includes('cannot proceed yet')
  );
};

const buildCodexRecoveryPrompt = (
  latestPrompt: string,
  session: AgentWorkspaceSession,
) => `Your previous reply asked for unavailable direct tools.
In this environment, tools are executed by the host, and their outputs are already provided in the TENANT SESSION CONTRACT.
Do NOT ask for list_workspace/get_acl_config again.
Return a valid JSON object with "summary" and "operations" now.
If the latest user request requires workspace mutations, "operations" must be non-empty.
- Respect the task scope in the session contract. Required surfaces: ${[
   session.task.expectations.backend ? 'backend' : '',
   session.task.expectations.models ? 'models' : '',
   session.task.expectations.ui ? 'ui' : '',
   session.task.expectations.acl ? 'acl' : '',
   session.task.expectations.shared ? 'shared' : '',
 ]
   .filter(Boolean)
   .join(', ') || 'none explicitly required'}.
- Never generate mock/fake/sample/dummy placeholder data.
- Backend ORM usage must be await adapters.orm('<database>:<key>').
- UI networking must use @app/datacontext (no fetch/axios/XMLHttpRequest).
Required tool input fields:
- create_ui_package => name, version, code
- update_ui_package => id OR (name + version)
- update_acl_file => file + content
- write_shared_file/delete_shared_file/get_shared_file => (projectId OR projectName) + projectKind + path
- create_shared_ui_project/create_shared_module_project => name + version
- create_file/update_file/delete_file => path (+ content for create/update)
Latest user request:
${latestPrompt || '(empty)'}`;

type ResolvePlanInput = {
  runId: string;
  userId: string | number;
  userName?: string;
  chatId: string;
  messages: Array<{ role: string; content: string }>;
  contextText: string;
  systemPrompt: string;
  model?: string;
  workspace: WorkspaceContext;
  session: AgentWorkspaceSession;
};

export const resolveCodexPlan = async (
  input: ResolvePlanInput,
  onProgress?: (line: string) => void,
  onWorkspaceFile?: (event: WorkspaceFileEvent) => void,
): Promise<CodexResolvedPlan> => {
  const codex = await executeCodex({
    runId: input.runId,
    userId: input.userId,
    userName: input.userName,
    chatId: input.chatId,
    messages: input.messages,
    contextText: input.contextText,
    session: input.session,
    systemPrompt: input.systemPrompt,
    model: input.model,
    onLine: (line) => {
      const formatted = formatCodexProgressLine(line);
      if (!formatted?.text) return;
      onProgress?.(formatted.text);
    },
    onWorkspaceFile,
  });

  onProgress?.('[codex] response received, resolving operations...');

  const workspaceDiff = Array.isArray((codex as any).workspaceDiff)
    ? ((codex as any).workspaceDiff as Array<{
        path: string;
        action: 'create' | 'edit' | 'delete';
        content?: string;
      }>)
    : [];
  if (workspaceDiff.length) {
    const workspaceScope = (codex as any).workspaceScope === 'repo' ? 'repo' : 'tenant';
    onProgress?.(
      `[codex] gateway ${workspaceScope} workspace diff produced ${workspaceDiff.length} file change(s)`,
    );
    if (workspaceScope === 'repo') {
      return {
        message: codex.message,
        plan: null,
        operations: [],
        directWorkspaceEdits: workspaceDiff,
      };
    }
    return {
      message: codex.message,
      plan: null,
      operations: mapWorkspaceDiffToOperations(workspaceDiff),
    };
  }

  let codexMessage = codex.message;
  let plan = parseCodexPlan(codexMessage);
  let fallbackDirectives = parseCodexFileDirectives(codexMessage);
  let fallbackOperations = buildOperationsFromDirectives(fallbackDirectives, input.workspace);
  let operations = (plan?.operations?.length ? plan.operations : fallbackOperations) ?? [];

  if (operations.length === 0 && codexAskedForUnavailableTools(codexMessage)) {
    const latestPrompt = getLatestUserPrompt(input.messages);
    onProgress?.('[codex] direct tool request detected, retrying with host context...');
    const recovery = await executeCodex({
      runId: input.runId,
      userId: input.userId,
      userName: input.userName,
      chatId: input.chatId,
      messages: [
        ...input.messages,
        { role: 'user', content: buildCodexRecoveryPrompt(latestPrompt, input.session) },
      ],
      contextText: input.contextText,
      session: input.session,
      systemPrompt: input.systemPrompt,
      model: input.model,
      onLine: (line) => {
        const formatted = formatCodexProgressLine(line);
        if (!formatted?.text) return;
        onProgress?.(formatted.text);
      },
      onWorkspaceFile,
    });
    codexMessage = recovery.message;
    plan = parseCodexPlan(codexMessage);
    fallbackDirectives = parseCodexFileDirectives(codexMessage);
    fallbackOperations = buildOperationsFromDirectives(fallbackDirectives, input.workspace);
    operations = (plan?.operations?.length ? plan.operations : fallbackOperations) ?? [];
  }

  if (plan?.operations?.length) {
    onProgress?.(`[codex] parsed ${plan.operations.length} operation(s) from JSON plan`);
  } else if (fallbackDirectives.length) {
    onProgress?.(
      `[codex] parsed ${fallbackDirectives.length} file directive(s), mapped to ${fallbackOperations.length} operation(s)`,
    );
  } else {
    onProgress?.('[codex] no explicit operations in response');
  }

  return { message: codexMessage, plan, operations };
};

export type { CodexResolvedPlan, ResolvePlanInput };
