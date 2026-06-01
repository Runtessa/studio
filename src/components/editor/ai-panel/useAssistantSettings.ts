import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  AiMessage,
  AiSettings,
  ApiFetch,
  AssistantAgentProfile,
} from './shared';

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
  promptOverride?: string;
};

const emptyProfile: AssistantAgentProfile = {
  key: 'codex',
  label: 'Codex',
  description: '',
  provider: '',
  model: '',
  systemPrompt: '',
  contextPolicy: [],
  supportsGatewayRuntime: true,
};

const normalizeProfile = (raw: unknown): AssistantAgentProfile => {
  const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    key: 'codex',
    label: String(item.label || 'Codex'),
    description: String(item.description || ''),
    provider: String(item.provider || ''),
    model: String(item.model || ''),
    systemPrompt: String(item.systemPrompt || ''),
    contextPolicy: Array.isArray(item.contextPolicy)
      ? item.contextPolicy.map((entry) => String(entry))
      : [],
    supportsGatewayRuntime: item.supportsGatewayRuntime !== false,
  };
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
  const [settings, setSettings] = useState<AiSettings>({
    model: '',
    allowClientConfig: false,
    watchPreviewExceptions: false,
  });
  const [profile, setProfile] = useState<AssistantAgentProfile>(emptyProfile);
  const [promptOverride, setPromptOverrideState] = useState('');

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
      if (typeof parsed.promptOverride === 'string') {
        setPromptOverrideState(parsed.promptOverride);
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
        const serverProfile = normalizeProfile(config?.profile);
        setProfile(serverProfile);
        setSettings((prev) => ({
          ...prev,
          model: config.model || serverProfile.model || '',
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

  const defaultSystemPrompt = profile.systemPrompt || '';
  const systemPrompt = promptOverride || defaultSystemPrompt;

  const setSystemPrompt = (value: string) => {
    const nextValue = String(value ?? '');
    setPromptOverrideState(nextValue.trim() && nextValue !== defaultSystemPrompt ? nextValue : '');
  };

  useEffect(() => {
    if (!tenantHost) return;
    const toStore: StoredState = {
      messages,
      chatSessionId,
      settings: {
        model: settings.model,
        allowClientConfig: settings.allowClientConfig,
        watchPreviewExceptions: settings.watchPreviewExceptions,
      },
      promptOverride,
    };
    localStorage.setItem(storageKey, JSON.stringify(toStore));
  }, [chatSessionId, messages, promptOverride, settings, storageKey, tenantHost]);

  return {
    settings,
    setSettings,
    systemPrompt,
    setSystemPrompt,
    defaultSystemPrompt,
    profile,
  };
};
