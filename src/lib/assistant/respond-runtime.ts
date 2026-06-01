import { resolveCodexModelFromEnv } from '@/lib/assistant/codex';
import { executeTool } from '@/lib/assistant/respond-runtime/codex-ops';
import { isCodexAgentMode } from '@/lib/assistant/respond-runtime/codex-client';
import {
  executeCodexPipeline,
  type CodexConflict,
  type ExecuteCodexPipelineInput,
  type ExecuteCodexPipelineResult,
} from '@/lib/assistant/respond-runtime/pipeline';
import {
  buildRunName,
  createRunId,
  normalizeMessages,
  normalizeSystemPrompt,
  pickAvailableModel,
  resolvePreviewExceptionsLimit,
  shouldWatchPreviewFromPrompt,
} from '@/lib/assistant/respond-runtime/run-normalization';
import {
  buildAgentWorkspaceSession,
  buildContextText,
  type AgentWorkspaceSession,
  type WorkspaceContext,
} from '@/lib/assistant/respond-runtime/workspace-context';
import { normalizeAssistantAgentType } from '@/lib/assistant/agent-type';

const resolveCodexModel = (
  config: { model?: string } | undefined,
  allowClientConfig: boolean,
  agentType?: string,
) => {
  const normalizedAgent = normalizeAssistantAgentType(agentType || process.env.AGENT_TYPE, 'orchestrator');
  if (allowClientConfig) {
    const requested = String(config?.model || '').trim();
    if (requested) return requested;
  }
  return resolveCodexModelFromEnv(normalizedAgent);
};

export {
  isCodexAgentMode,
  resolveCodexModel,
  normalizeMessages,
  shouldWatchPreviewFromPrompt,
  resolvePreviewExceptionsLimit,
  buildContextText,
  buildAgentWorkspaceSession,
  createRunId,
  buildRunName,
  normalizeSystemPrompt,
  executeTool,
  pickAvailableModel,
  executeCodexPipeline,
};

export type {
  WorkspaceContext,
  AgentWorkspaceSession,
  CodexConflict,
  ExecuteCodexPipelineInput,
  ExecuteCodexPipelineResult,
};
