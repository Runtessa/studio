import { fetchCodexGateway } from '@/lib/assistant/gateway-fetch';
import type { AttachmentContent } from '@/lib/assistant/attachment-types';
import { resolveCodexGatewayBase } from '@/lib/assistant/gateway';
import { loadCodexModelCatalog } from '@/lib/assistant/model-catalog';
import {
  resolveCodexGatewayBaseForUser,
  resolveCodexGatewayModeValue,
} from '@/lib/assistant/gateway-runtime';
import {
  CODEX_JSON_SYSTEM_INSTRUCTIONS,
  CODEX_WORKSPACE_SYSTEM_INSTRUCTIONS,
} from '@/lib/assistant/codex';
import type { AgentWorkspaceSession } from './workspace-context';

export type WorkspaceFileEvent = {
  path: string;
  action: 'create' | 'edit' | 'delete';
  content?: string;
};

export type DirectWorkspaceEdit = {
  path: string;
  action: 'create' | 'edit' | 'delete';
  content?: string;
};

export const resolveCodexCwd = () => {
  const fromEnv = (process.env.AGENT_CODEX_CWD || '').trim();
  if (fromEnv) return fromEnv;
  const cwd = process.cwd().replace(/\\/g, '/');
  if (cwd.endsWith('/src/ideNew')) return cwd.slice(0, -'/src/ideNew'.length);
  if (cwd.endsWith('/ideNew')) return cwd.slice(0, -'/ideNew'.length);
  return cwd;
};

const resolveCodexTimeoutMs = () => {
  const raw = Number(process.env.AGENT_CODEX_TIMEOUT_MS || '0');
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return 10 * 60 * 1000;
};

const resolveCodexGatewayUrl = () => resolveCodexGatewayBase();

const buildExpectedSurfaceContract = (session?: AgentWorkspaceSession) => {
  const expectations = session?.task.expectations;
  if (!expectations) {
    return '- If the request requires workspace changes, output at least one operation.';
  }
  const expected = [
    expectations.backend ? 'backend modules' : '',
    expectations.models ? 'ORM models' : '',
    expectations.ui ? 'UI files/packages' : '',
    expectations.acl ? 'ACL files' : '',
    expectations.shared ? 'shared project files' : '',
  ].filter(Boolean);
  if (!expected.length) {
    return '- If the request requires workspace changes, output at least one operation.';
  }
  return `- Required mutation coverage for this task: ${expected.join(', ')}.`;
};

const buildGatewayWorkspaceSystemPrompt = (
  systemPrompt: string,
  session?: AgentWorkspaceSession,
) => {
  const override = String(systemPrompt || '').trim();
  const customOverride =
    override &&
    override !== CODEX_WORKSPACE_SYSTEM_INSTRUCTIONS &&
    override !== CODEX_JSON_SYSTEM_INSTRUCTIONS
      ? `\n\nCUSTOM USER OVERRIDE:\n${override}`
      : '';
  return `${CODEX_WORKSPACE_SYSTEM_INSTRUCTIONS}${customOverride}

GATEWAY WORKSPACE MODE:
- Ignore any conflicting older instruction that says to return JSON operations.
- You are running inside a hydrated tenant workspace on disk.
- Read and edit files directly in the workspace instead of returning JSON tool operations.
- The workspace includes .idp/manifest.json, .idp/task-state.json, and .idp/AGENTS.md.
- If the task is implementation-oriented and the user does not name a specific surface, choose the correct root yourself from backend/modules, models, ui, shared assets, and acl.
- Follow the task scope described there and keep edits minimal.
- ${buildExpectedSurfaceContract(session).slice(2)}
- When you finish, reply with a concise human summary of what you changed.
- Do not return JSON unless the user explicitly asks for JSON.`;
};

const buildCliJsonSystemPrompt = (systemPrompt: string) => {
  const override = String(systemPrompt || '').trim();
  const customOverride =
    override &&
    override !== CODEX_WORKSPACE_SYSTEM_INSTRUCTIONS &&
    override !== CODEX_JSON_SYSTEM_INSTRUCTIONS
      ? `\n\nCUSTOM USER OVERRIDE:\n${override}`
      : '';
  return `${CODEX_JSON_SYSTEM_INSTRUCTIONS}${customOverride}`;
};

const buildCodexPrompt = (
  messages: Array<{ role: string; content: string }>,
  contextText: string,
  systemPrompt: string,
  session?: AgentWorkspaceSession,
) => {
  const codexRuntimeContract = `CODEX HOST EXECUTION CONTRACT (NON-NEGOTIABLE):
- You do NOT have callable tools in this Codex run.
- The host has ALREADY executed workspace/ACL discovery and provided a full TENANT SESSION CONTRACT.
- Never ask for list_workspace/get_acl_config/tool availability; never ask user to provide those outputs again.
- Your job is to RETURN JSON operations for the host to execute.
- Respect the task expectations inside the session contract. Do not invent broader scope than required.
- ${buildExpectedSurfaceContract(session).slice(2)}
- If the request is purely conversational, operations may be empty.
- No mock/fake/sample/dummy data is allowed anywhere.
- Backend ORM usage rule: only await adapters.orm('<database>:<key>') (bare keys like "pga1" are invalid).
- UI data-access rule: use @app/datacontext (never fetch/axios/XMLHttpRequest).
- Respect actor_access permissions from context. Never emit operations that the actor role cannot execute.
- Return ONLY a single valid JSON object (no markdown, no code fences).

JSON SCHEMA:
{
  "summary": "short human-readable summary",
  "operations": [
    { "tool": "<tool_id>", "input": { ... }, "reason": "optional" }
  ]
}

Valid tool ids:
list_workspace, get_acl_config,
list_models, list_ui_packages, list_shared_ui_projects, list_shared_module_projects,
create_shared_ui_project, create_shared_module_project,
create_module, update_module, delete_module,
create_model, update_model, delete_model,
create_ui_package, update_ui_package, delete_ui_package,
update_acl_file,
write_shared_file, delete_shared_file,
get_module, get_model, get_ui_package, get_shared_file,
create_file, update_file, delete_file
`;

  const history = messages.map((msg) => `[${msg.role}] ${msg.content}`).join('\n\n');
  const activeFileLine = session?.workspace.activeFile?.path
    ? `- Active file in IDE: ${session.workspace.activeFile.path}`
    : '- Active file in IDE: none';
  return `${systemPrompt}

${codexRuntimeContract}

RUNTIME MODE:
- You are running in codex-cli mode for chat output.
- Return ONLY valid JSON (no markdown, no code fences).
- Prefer concise, direct output.
- If file changes are requested, produce tool operations to apply them.
${activeFileLine}

OUTPUT CONTRACT (strict JSON object):
{
  "summary": "short human summary",
  "operations": [
    { "tool": "<tool_id>", "input": { ... }, "reason": "optional short note" }
  ]
}

ALLOWED TOOL IDS:
- list_workspace, get_acl_config
- list_models, list_ui_packages
- list_shared_ui_projects, list_shared_module_projects
- create_shared_ui_project, create_shared_module_project
- create_module, update_module, delete_module
- create_model, update_model, delete_model
- create_ui_package, update_ui_package, delete_ui_package
- update_acl_file
- write_shared_file, delete_shared_file
- get_module, get_model, get_ui_package, get_shared_file
- create_file, update_file, delete_file

TENANT SESSION CONTRACT:
${contextText}

CHAT HISTORY:
${history}

TASK:
Respond to the latest user request using the context above.`;
};

export type CodexExecInput = {
  runId: string;
  userId: string | number;
  userName?: string;
  chatId?: string;
  messages: Array<{ role: string; content: string }>;
  attachments?: AttachmentContent[];
  contextText: string;
  session?: AgentWorkspaceSession;
  systemPrompt: string;
  model?: string;
  onLine?: (line: string) => void;
  onWorkspaceFile?: (event: WorkspaceFileEvent) => void;
  onDelta?: (delta: string) => void;
  signal?: AbortSignal;
};

const executeCodexGateway = async (input: CodexExecInput) => {
  const runtime = await resolveCodexGatewayBaseForUser(input.userId, input.userName);
  const baseUrl = runtime.baseUrl;
  if (!baseUrl) {
    throw new Error('AGENT_CODEX_GATEWAY_URL is not configured');
  }
  const model = input.model || (await loadCodexModelCatalog(input.userId, input.userName)).defaultModel;

  const response = await fetchCodexGateway(`${baseUrl}/v1/exec`, { userId: input.userId, tenantId: input.session?.tenant?.id }, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: input.signal,
    body: JSON.stringify({
      userId: String(input.userId),
      chatId: input.chatId || 'default',
      prompt: getLatestUserPrompt(input.messages),
      systemPrompt: buildGatewayWorkspaceSystemPrompt(input.systemPrompt, input.session),
      agentSession: input.session,
      messages: input.messages,
      attachments: input.attachments,
      model,
      stream: true,
    }),
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).trim();
    throw new Error(detail || `codex-gateway request failed (${response.status})`);
  }
  if (!response.body) {
    throw new Error('codex-gateway returned no stream body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let done = false;
  let doneMessage = '';
  let doneError = '';
  let doneOk = false;
  let doneSignal = '';
  let workspaceScope: 'tenant' | 'repo' = 'tenant';
  let changedFiles: Array<{ path: string; action: 'create' | 'edit' | 'delete'; content?: string }> =
    [];

  const processBlock = (block: string) => {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return;

    let eventName = 'message';
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice('event:'.length).trim() || 'message';
        continue;
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim());
      }
    }
    if (!dataLines.length) return;

    const rawData = dataLines.join('\n');
    let payload: any;
    try {
      payload = JSON.parse(rawData);
    } catch {
      input.onLine?.(`[gateway] ${rawData}`);
      return;
    }

    if (eventName === 'status') {
      input.onLine?.(`[gateway] ${String(payload?.state || 'status')}`);
      return;
    }
    if (eventName === 'assistant-delta') {
      if (typeof payload?.delta === 'string') input.onDelta?.(payload.delta);
      return;
    }
    if (eventName === 'stdout') {
      const line = String(payload?.line || '').trim();
      if (line) input.onLine?.(line);
      return;
    }
    if (eventName === 'stderr') {
      const line = String(payload?.line || '').trim();
      if (line) input.onLine?.(`[stderr] ${line}`);
      return;
    }
    if (eventName === 'workspace-file') {
      const filePath = String(payload?.path || '').trim();
      const action =
        payload?.action === 'create' || payload?.action === 'delete' ? payload.action : 'edit';
      const content = typeof payload?.content === 'string' ? payload.content : undefined;
      if (filePath) {
        input.onLine?.(`[workspace] ${action} ${filePath}`);
        input.onWorkspaceFile?.({ path: filePath, action, content });
      }
      return;
    }
    if (eventName === 'done') {
      done = true;
      doneOk = Boolean(payload?.ok);
      doneMessage = String(payload?.message || '').trim();
      doneError = String(payload?.error || '').trim();
      doneSignal = String(payload?.signal || '').trim();
      workspaceScope = payload?.workspaceScope === 'repo' ? 'repo' : 'tenant';
      changedFiles = Array.isArray(payload?.changedFiles)
        ? payload.changedFiles
            .map((item: any) => ({
              path: String(item?.path || '').trim(),
              action:
                item?.action === 'create' || item?.action === 'delete' ? item.action : 'edit',
              content: typeof item?.content === 'string' ? item.content : undefined,
            }))
            .filter(
              (
                item: { path: string; action: 'create' | 'edit' | 'delete'; content?: string },
              ): item is { path: string; action: 'create' | 'edit' | 'delete'; content?: string } =>
                Boolean(item.path),
            )
        : [];
    }
  };

  const reader = response.body.getReader();
  while (true) {
    const { done: readerDone, value } = await reader.read();
    if (readerDone) break;
    if (!value) continue;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      processBlock(block);
      boundary = buffer.indexOf('\n\n');
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) processBlock(buffer.trim());

  if (!done) {
    throw new Error('codex-gateway stream ended without done event');
  }
  if (!doneOk) {
    if (doneSignal) {
      throw new Error(doneError || `codex-gateway terminated codex process (${doneSignal})`);
    }
    throw new Error(doneError || 'codex-gateway execution failed');
  }

  return {
    message: doneMessage || 'Codex completed with no response text.',
    workspaceScope,
    workspaceDiff: changedFiles,
  };
};

export const executeCodex = async (input: CodexExecInput) => {
  const mode = resolveCodexGatewayModeValue();
  const gatewayEnabled = mode !== 'off' && mode !== 'none' && mode !== 'disabled';
  const shouldUseGateway =
    gatewayEnabled && (mode === 'container' || Boolean(resolveCodexGatewayUrl()));
  if (shouldUseGateway) {
    return executeCodexGateway(input);
  }
  throw new Error('The assistant requires the isolated gateway. Start it and configure its connection.');
};

export const getLatestUserPrompt = (messages: Array<{ role: string; content: string }>) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const msg = messages[index];
    if (msg.role === 'user') return msg.content || '';
  }
  return '';
};
