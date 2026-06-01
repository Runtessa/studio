import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveCodexGatewayBase } from '@/lib/assistant/gateway';
import {
  resolveCodexGatewayBaseForUser,
  resolveCodexGatewayModeValue,
} from '@/lib/assistant/gateway-runtime';
import {
  isCodexFamilyAgentType,
  normalizeAssistantAgentType,
} from '@/lib/assistant/agent-type';
import type { AgentWorkspaceSession } from './workspace-context';

export type WorkspaceFileEvent = {
  path: string;
  action: 'create' | 'edit' | 'delete';
  content?: string;
};

const resolveAgentType = () => normalizeAssistantAgentType(process.env.AGENT_TYPE, 'orchestrator');

export const isCodexAgentMode = (agentType?: string) =>
  isCodexFamilyAgentType(agentType || resolveAgentType());

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
) => `${systemPrompt}

GATEWAY WORKSPACE MODE:
- You are running inside a hydrated tenant workspace on disk.
- Read and edit files directly in the workspace instead of returning JSON tool operations.
- The workspace includes .idp/manifest.json, .idp/task-state.json, and .idp/AGENTS.md.
- Follow the task scope described there and keep edits minimal.
- ${buildExpectedSurfaceContract(session).slice(2)}
- When you finish, reply with a concise human summary of what you changed.
- Do not return JSON unless the user explicitly asks for JSON.`;

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
  contextText: string;
  session?: AgentWorkspaceSession;
  systemPrompt: string;
  agentType?: string;
  model?: string;
  onLine?: (line: string) => void;
  onWorkspaceFile?: (event: WorkspaceFileEvent) => void;
};

const normalizeBaseUrl = (value?: string | null) => String(value || '').trim().replace(/\/+$/, '');

const resolveHermesBaseUrl = () =>
  normalizeBaseUrl(process.env.HERMES_BASE_URL || process.env.AI_BASE_URL || '');

const resolveHermesApiToken = () =>
  String(process.env.HERMES_API_TOKEN || process.env.HERMES_API_KEY || process.env.AI_API_KEY || '').trim();

const resolveHermesModel = (requested?: string) => {
  const explicit = String(requested || '').trim();
  if (explicit) return explicit;
  return String(process.env.HERMES_MODEL || process.env.AGENT_HERMES_MODEL || process.env.AI_MODEL || '').trim();
};

const parseHermesResponseText = (payload: any): string => {
  if (!payload || typeof payload !== 'object') return '';

  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const firstChoice = choices[0];
  const chatText =
    typeof firstChoice?.message?.content === 'string'
      ? firstChoice.message.content
      : typeof firstChoice?.text === 'string'
        ? firstChoice.text
        : '';
  if (chatText.trim()) return chatText.trim();

  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      if (typeof block?.text === 'string' && block.text.trim()) {
        return block.text.trim();
      }
    }
  }

  return '';
};

const executeHermesProxy = async (input: CodexExecInput) => {
  const baseUrl = resolveHermesBaseUrl();
  if (!baseUrl) {
    throw new Error('HERMES_BASE_URL is not configured');
  }
  const token = resolveHermesApiToken();
  if (!token) {
    throw new Error('HERMES_API_TOKEN is not configured');
  }

  const model = resolveHermesModel(input.model);
  if (!model) {
    throw new Error('HERMES_MODEL is not configured');
  }

  const prompt = buildCodexPrompt(
    input.messages,
    input.contextText,
    input.systemPrompt,
    input.session,
  );
  input.onLine?.(`[hermes] proxy request started (${model})`);

  const controller = new AbortController();
  const timeoutMs = resolveCodexTimeoutMs();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  };

  try {
    const chatResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    if (!chatResponse.ok) {
      const detail = (await chatResponse.text().catch(() => '')).trim();
      throw new Error(detail || `Hermes API request failed (${chatResponse.status})`);
    }

    const payload = await chatResponse.json().catch(() => ({}));
    const message = parseHermesResponseText(payload);
    if (!message) {
      throw new Error('Hermes API returned no usable text response');
    }
    input.onLine?.('[hermes] proxy request completed');
    return { message };
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const executeCodexCli = async (input: CodexExecInput) => {
  const outputFile = path.join(tmpdir(), `idp-codex-last-${input.runId}.txt`);
  const prompt = buildCodexPrompt(
    input.messages,
    input.contextText,
    input.systemPrompt,
    input.session,
  );
  const runOnce = async (model?: string) =>
    new Promise<{
      stdoutText: string;
      stderrText: string;
      exitCode: number;
    }>((resolve, reject) => {
      const args = [
        'exec',
        '--json',
        '--skip-git-repo-check',
        '-C',
        resolveCodexCwd(),
        '--output-last-message',
        outputFile,
      ];
      if (model) args.push('-m', model);
      args.push('-');
      const child = spawn('codex', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const timeoutMs = resolveCodexTimeoutMs();
      let stdoutText = '';
      let stderrText = '';
      let lineBuffer = '';
      let stderrLineBuffer = '';
      let timedOut = false;
      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        input.onLine?.(`[codex] timed out after ${Math.floor(timeoutMs / 1000)}s`);
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 3000).unref?.();
      }, timeoutMs);

      child.stdout.on('data', (chunk: Buffer | string) => {
        const text = String(chunk);
        stdoutText += text;
        lineBuffer += text;
        let idx = lineBuffer.indexOf('\n');
        while (idx !== -1) {
          const line = lineBuffer.slice(0, idx).trim();
          lineBuffer = lineBuffer.slice(idx + 1);
          if (line) input.onLine?.(line);
          idx = lineBuffer.indexOf('\n');
        }
      });

      child.stderr.on('data', (chunk: Buffer | string) => {
        const text = String(chunk);
        stderrText += text;
        stderrLineBuffer += text;
        let idx = stderrLineBuffer.indexOf('\n');
        while (idx !== -1) {
          const line = stderrLineBuffer.slice(0, idx).trim();
          stderrLineBuffer = stderrLineBuffer.slice(idx + 1);
          if (line) input.onLine?.(`[stderr] ${line}`);
          idx = stderrLineBuffer.indexOf('\n');
        }
      });

      child.on('error', (error) => reject(error));
      child.on('close', (code) => {
        clearTimeout(timeoutHandle);
        const pendingStdout = lineBuffer.trim();
        if (pendingStdout) input.onLine?.(pendingStdout);
        const pendingStderr = stderrLineBuffer.trim();
        if (pendingStderr) input.onLine?.(`[stderr] ${pendingStderr}`);
        resolve({
          stdoutText,
          stderrText,
          exitCode: timedOut ? 124 : typeof code === 'number' ? code : 1,
        });
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });

  const isUnsupportedModelError = (text: string) =>
    /model is not supported when using codex with a chatgpt account/i.test(text) ||
    /unsupported model/i.test(text);

  let result = await runOnce(input.model);
  if (input.model) {
    const detail = `${result.stderrText}\n${result.stdoutText}`;
    if (isUnsupportedModelError(detail)) {
      result = await runOnce(undefined);
    }
  }

  const { stdoutText, stderrText, exitCode } = result;
  if (exitCode !== 0) {
    const detail = (stderrText || stdoutText || '').trim();
    throw new Error(detail || `codex exec failed with exit code ${exitCode}`);
  }

  let message = '';
  try {
    message = (await fs.readFile(outputFile, 'utf8')).trim();
  } catch {
    message = '';
  } finally {
    await fs.unlink(outputFile).catch(() => undefined);
  }

  if (!message) message = stdoutText.trim();
  if (!message) message = 'Codex completed with no response text.';
  return { message };
};

const executeCodexGateway = async (input: CodexExecInput) => {
  const runtime = await resolveCodexGatewayBaseForUser(input.userId, input.userName);
  const baseUrl = runtime.baseUrl;
  if (!baseUrl) {
    throw new Error('AGENT_CODEX_GATEWAY_URL is not configured');
  }

  const response = await fetch(`${baseUrl}/v1/exec`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      userId: String(input.userId),
      chatId: input.chatId || 'default',
      prompt: getLatestUserPrompt(input.messages),
      systemPrompt: buildGatewayWorkspaceSystemPrompt(input.systemPrompt, input.session),
      agentSession: input.session,
      model: input.model,
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
    workspaceDiff: changedFiles,
  };
};

export const executeCodex = async (input: CodexExecInput) => {
  const agentType = normalizeAssistantAgentType(input.agentType || resolveAgentType(), 'orchestrator');
  if (agentType === 'hermes') {
    return executeHermesProxy(input);
  }

  const mode = resolveCodexGatewayModeValue();
  const gatewayEnabled = mode !== 'off' && mode !== 'none' && mode !== 'disabled';
  const shouldUseGateway =
    gatewayEnabled && (mode === 'container' || Boolean(resolveCodexGatewayUrl()));
  if (shouldUseGateway) {
    return executeCodexGateway(input);
  }
  return executeCodexCli(input);
};

export const getLatestUserPrompt = (messages: Array<{ role: string; content: string }>) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const msg = messages[index];
    if (msg.role === 'user') return msg.content || '';
  }
  return '';
};

export { resolveAgentType };
