import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  AiMessage,
  AiSettings,
  ApiFetch,
  AssistantAgentProfile,
} from './shared';
import { normalizeAssistantAgentType } from '@/lib/assistant/agent-type';

type Params = {
  apiFetch: ApiFetch;
  tenantHost: string;
  messages: AiMessage[];
  setMessages: Dispatch<SetStateAction<AiMessage[]>>;
  chatSessionId: string;
  setChatSessionId: Dispatch<SetStateAction<string>>;
  showError: (message: string) => void;
  storagePrefix: string;
};

type StoredState = {
  messages?: AiMessage[];
  chatSessionId?: string;
  settings?: Partial<AiSettings>;
  promptOverrides?: Partial<Record<'orchestrator' | 'codex' | 'hermes', string>>;
  agentType?: string;
};

const normalizeProfiles = (raw: any) => {
  const profiles = raw && typeof raw === 'object' ? raw : {};
  const keys: Array<'orchestrator' | 'codex' | 'hermes'> = ['orchestrator', 'codex', 'hermes'];
  return keys.reduce((acc, key) => {
    const item = profiles[key] && typeof profiles[key] === 'object' ? profiles[key] : {};
    acc[key] = {
      key,
      label: String((item as any).label || key),
      description: String((item as any).description || ''),
      provider: String((item as any).provider || ''),
      model: String((item as any).model || ''),
      systemPrompt: String((item as any).systemPrompt || ''),
      contextPolicy: Array.isArray((item as any).contextPolicy)
        ? (item as any).contextPolicy.map((entry: unknown) => String(entry))
        : [],
      supportsGatewayRuntime: Boolean((item as any).supportsGatewayRuntime),
      supportsDirectProviderConfig: Boolean((item as any).supportsDirectProviderConfig),
    } as AssistantAgentProfile;
    return acc;
  }, {} as Record<'orchestrator' | 'codex' | 'hermes', AssistantAgentProfile>);
};

export const useAssistantSettings = ({
  apiFetch,
  tenantHost,
  messages,
  setMessages,
  chatSessionId,
  setChatSessionId,
  showError,
  storagePrefix,
}: Params) => {
  const [agentType, setAgentType] = useState<string>('orchestrator');
  const [settings, setSettings] = useState<AiSettings>({
    baseUrl: '',
    apiKey: '',
    model: '',
    provider: '',
    allowClientConfig: false,
    watchPreviewExceptions: false,
  });
  const [profiles, setProfiles] = useState<
    Record<'orchestrator' | 'codex' | 'hermes', AssistantAgentProfile>
  >({
    orchestrator: {
      key: 'orchestrator',
      label: 'Orchestrator',
      description: '',
      provider: '',
      model: '',
      systemPrompt: '',
      contextPolicy: [],
      supportsGatewayRuntime: false,
      supportsDirectProviderConfig: true,
    },
    codex: {
      key: 'codex',
      label: 'Codex',
      description: '',
      provider: '',
      model: '',
      systemPrompt: '',
      contextPolicy: [],
      supportsGatewayRuntime: true,
      supportsDirectProviderConfig: false,
    },
    hermes: {
      key: 'hermes',
      label: 'Hermes',
      description: '',
      provider: '',
      model: '',
      systemPrompt: '',
      contextPolicy: [],
      supportsGatewayRuntime: false,
      supportsDirectProviderConfig: true,
    },
  });
  const [promptOverrides, setPromptOverrides] = useState<
    Partial<Record<'orchestrator' | 'codex' | 'hermes', string>>
  >({});

  const storageKey = useMemo(
    () => `${storagePrefix}:${tenantHost || 'default'}`,
    [storagePrefix, tenantHost],
  );

  useEffect(() => {
    if (!tenantHost) return;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as StoredState;
      if (parsed.messages) setMessages(parsed.messages);
      if (parsed.chatSessionId && parsed.chatSessionId.trim()) {
        setChatSessionId(parsed.chatSessionId.trim());
      }
      if (parsed.settings) {
        setSettings((prev) => ({ ...prev, ...parsed.settings }));
      }
      if (parsed.promptOverrides && typeof parsed.promptOverrides === 'object') {
        setPromptOverrides(parsed.promptOverrides);
      }
      if (parsed.agentType) {
        setAgentType(normalizeAssistantAgentType(parsed.agentType, 'orchestrator'));
      }
    } catch {
      // ignore malformed state
    }
  }, [setChatSessionId, setMessages, storageKey, tenantHost]);

  useEffect(() => {
    if (!tenantHost) return;
    const restore = async () => {
      try {
        const config = await apiFetch('/api/assistant/config');
        const serverProfiles = normalizeProfiles(config?.profiles);
        const serverAgentType = normalizeAssistantAgentType(
          config?.defaultAgentType || config?.agentType,
          'orchestrator',
        );
        setProfiles(serverProfiles);
        setAgentType((prev) =>
          Boolean(config.allowClientConfig)
            ? normalizeAssistantAgentType(prev, serverAgentType)
            : serverAgentType,
        );
        setSettings((prev) => ({
          ...prev,
          baseUrl: config.baseUrl || '',
          model: config.model || serverProfiles[serverAgentType]?.model || '',
          provider: config.provider || serverProfiles[serverAgentType]?.provider || '',
          allowClientConfig: Boolean(config.allowClientConfig),
          watchPreviewExceptions:
            config.watchPreviewExceptions === true ? true : prev.watchPreviewExceptions,
        }));
      } catch (err) {
        showError((err as Error).message || 'Failed to load assistant settings');
      }
    };
    void restore();
  }, [apiFetch, showError, tenantHost]);

  const normalizedAgentType = normalizeAssistantAgentType(agentType, 'orchestrator');
  const activeProfile = profiles[normalizedAgentType] || profiles.orchestrator;
  const defaultSystemPrompt = activeProfile?.systemPrompt || '';
  const systemPrompt = promptOverrides[normalizedAgentType] ?? defaultSystemPrompt;

  const setSystemPrompt = (value: string) => {
    setPromptOverrides((prev) => {
      const nextValue = String(value ?? '');
      if (!nextValue.trim() || nextValue === defaultSystemPrompt) {
        const { [normalizedAgentType]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [normalizedAgentType]: nextValue };
    });
  };

  useEffect(() => {
    if (!tenantHost) return;
    const profile = profiles[normalizedAgentType];
    if (!profile) return;
    setSettings((prev) => ({
      ...prev,
      model:
        prev.model && prev.model !== profiles.orchestrator.model && prev.model !== profiles.codex.model && prev.model !== profiles.hermes.model
          ? prev.model
          : profile.model || prev.model,
      provider: profile.provider || prev.provider,
    }));
  }, [normalizedAgentType, profiles]);

  useEffect(() => {
    if (!tenantHost) return;
    const toStore: StoredState = {
      messages,
      chatSessionId,
      settings: {
        baseUrl: settings.baseUrl,
        model: settings.model,
        provider: settings.provider,
        apiKey: settings.allowClientConfig ? settings.apiKey : '',
        allowClientConfig: settings.allowClientConfig,
        watchPreviewExceptions: settings.watchPreviewExceptions,
      },
      promptOverrides,
      agentType: normalizedAgentType,
    };
    localStorage.setItem(storageKey, JSON.stringify(toStore));
  }, [chatSessionId, messages, normalizedAgentType, promptOverrides, settings, storageKey, tenantHost]);

  return {
    agentType: normalizedAgentType,
    setAgentType,
    settings,
    setSettings,
    systemPrompt,
    setSystemPrompt,
    defaultSystemPrompt,
    profiles,
    activeProfile,
  };
};
