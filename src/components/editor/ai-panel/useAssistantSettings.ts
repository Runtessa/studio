import { useEffect, useState } from 'react';
import { createChatSessionId } from './shared';
import { readOwnedAssistantChat, type StoredAssistantChat } from './assistantChatStorage';
import type { Dispatch, SetStateAction } from 'react';
import type { AiMessage, AiSettings, ApiFetch, AssistantAgentProfile } from './shared';

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
    contextPolicy: Array.isArray(item.contextPolicy) ? item.contextPolicy.map((entry) => String(entry)) : [],
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
    readOnly: false,
  });
  const [profile, setProfile] = useState<AssistantAgentProfile>(emptyProfile);
  const [promptOverride, setPromptOverrideState] = useState('');
  const [hydratedScope, setHydratedScope] = useState<{ key: string; tenant: string } | null>(null);

  useEffect(() => {
    setHydratedScope(null);
    setMessages([]);
    setChatSessionId(createChatSessionId());
    if (!tenantHost) return;
    let cancelled = false;
    const restore = async () => {
      try {
        const config = await apiFetch('/api/assistant/config');
        if (cancelled) return;
        const serverProfile = normalizeProfile(config?.profile);
        const { key, chat } = readOwnedAssistantChat(localStorage, storagePrefix, tenantHost, {
          userId: String(config.userId || ''),
          isAdmin: config.isAdmin === true,
        });
        setMessages(Array.isArray(chat.messages) ? chat.messages : []);
        setChatSessionId(
          typeof chat.chatSessionId === 'string' && chat.chatSessionId.trim()
            ? chat.chatSessionId.trim()
            : createChatSessionId(),
        );
        setProfile(serverProfile);
        setSettings({
          model:
            config.allowClientConfig &&
            chat.settings?.model &&
            Array.isArray(config.models) &&
            config.models.includes(chat.settings.model)
              ? chat.settings.model
              : config.model || serverProfile.model || '',
          allowClientConfig: Boolean(config.allowClientConfig),
          watchPreviewExceptions:
            config.watchPreviewExceptions === true || chat.settings?.watchPreviewExceptions === true,
          readOnly: chat.settings?.readOnly === true,
        });
        setPromptOverrideState(typeof chat.promptOverride === 'string' ? chat.promptOverride : '');
        setHydratedScope({ key, tenant: tenantHost });
        if (config.connectionError) showError(String(config.connectionError));
      } catch (err) {
        if (!cancelled) showError((err as Error).message || 'Failed to load assistant settings');
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, showError, storagePrefix, tenantHost, setMessages, setChatSessionId]);

  const defaultSystemPrompt = profile.systemPrompt || '';
  const systemPrompt = promptOverride || defaultSystemPrompt;

  const setSystemPrompt = (value: string) => {
    const nextValue = String(value ?? '');
    setPromptOverrideState(nextValue.trim() && nextValue !== defaultSystemPrompt ? nextValue : '');
  };

  useEffect(() => {
    if (!hydratedScope || hydratedScope.tenant !== tenantHost) return;
    const toStore: StoredAssistantChat = {
      messages,
      chatSessionId,
      settings: {
        model: settings.model,
        allowClientConfig: settings.allowClientConfig,
        watchPreviewExceptions: settings.watchPreviewExceptions,
        readOnly: settings.readOnly,
      },
      promptOverride,
    };
    localStorage.setItem(hydratedScope.key, JSON.stringify(toStore));
  }, [chatSessionId, messages, promptOverride, settings, tenantHost, hydratedScope]);

  return {
    settings,
    setSettings,
    systemPrompt,
    setSystemPrompt,
    defaultSystemPrompt,
    profile,
    ready: hydratedScope?.tenant === tenantHost,
  };
};
