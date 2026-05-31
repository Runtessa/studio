export type AssistantAgentType = 'orchestrator' | 'codex' | 'hermes';

export const normalizeAssistantAgentType = (
  value: unknown,
  fallback: AssistantAgentType = 'orchestrator'
): AssistantAgentType => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'codex' || normalized === 'hermes' || normalized === 'orchestrator') {
    return normalized;
  }
  return fallback;
};

export const resolveAssistantAgentTypeFromEnv = (
  fallback: AssistantAgentType = 'orchestrator'
): AssistantAgentType => {
  return normalizeAssistantAgentType(process.env.AGENT_TYPE, fallback);
};

export const isCodexFamilyAgentType = (value: unknown) => {
  const normalized = normalizeAssistantAgentType(value as string, 'orchestrator');
  return normalized === 'codex' || normalized === 'hermes';
};
