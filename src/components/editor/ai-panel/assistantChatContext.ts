import type { Dispatch, SetStateAction } from 'react';
import type { AssistantAttachment } from '@/lib/assistant/attachment-types';
import type { EditorBuffer, EditorSelection } from '@/lib/assistant/respond-runtime/editor-context';
import type { AiMessage, AiSettings, ApiStreamFetch, ApiFetch, LiveWorkspaceFileUpdate } from './shared';
import type { WorkspaceRefresh } from './performAssistantRequest';
export type ActiveFileContext = { id: string; name: string; meta?: unknown; content: string } | null;
export type AssistantChatParams = {
  ready?: boolean;
  apiFetch?: ApiFetch;
  apiStreamFetch: ApiStreamFetch;
  chatSessionId: string;
  input: string;
  attachments?: AssistantAttachment[];
  attachmentsBusy?: boolean;
  onAttachmentsSent?: () => void;
  setInput: Dispatch<SetStateAction<string>>;
  messages: AiMessage[];
  setMessages: Dispatch<SetStateAction<AiMessage[]>>;
  activeFileContext: ActiveFileContext;
  aclConfig: unknown;
  openFileContexts?: EditorBuffer[];
  getEditorSelection?: () => EditorSelection | null;
  settings: AiSettings;
  systemPrompt: string;
  onWorkspaceRefresh: WorkspaceRefresh;
  onLiveWorkspaceFileUpdate?: (file: LiveWorkspaceFileUpdate) => void;
  onLiveWorkspaceRunStateChange?: (state: 'started' | 'committed' | 'reverted') => void;
  loadRuns: () => Promise<void> | void;
  success: (message: string) => void;
  showError: (message: string) => void;
};

export function buildChatPayload(
  context: Pick<
    AssistantChatParams,
    | 'chatSessionId'
    | 'messages'
    | 'settings'
    | 'systemPrompt'
    | 'openFileContexts'
    | 'getEditorSelection'
    | 'activeFileContext'
    | 'aclConfig'
  >,
  userMessage: AiMessage,
  assistantId: string,
) {
  return {
    attachmentIds: (userMessage.attachments || []).map(file => file.id),
    messages: [...context.messages, userMessage].map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    chatId: context.chatSessionId,
    requestId: assistantId,
    context: {
      readOnly: context.settings.readOnly === true,
      openFiles: context.openFileContexts,
      selection: context.getEditorSelection?.() ?? null,
      activeFile: context.activeFileContext,
      acl: context.aclConfig ?? undefined,
      watchPreviewExceptions: context.settings.watchPreviewExceptions,
      previewExceptionsLimit: 20,
    },
    stream: true,
    systemPrompt: context.systemPrompt || undefined,
    config: context.settings.allowClientConfig
      ? {
          model: context.settings.model,
        }
      : undefined,
  };
}
