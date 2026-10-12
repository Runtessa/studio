import { useCallback, useEffect, useRef, useState } from 'react';
import { createId, type AiMessage } from './shared';
import { performAssistantRequest } from './performAssistantRequest';
import { buildChatPayload, type AssistantChatParams } from './assistantChatContext';
export type { ActiveFileContext } from './assistantChatContext';
import { useRecoverRuns } from './useRecoverRuns';
import type { AssistantAttachment } from '@/lib/assistant/attachment-types';
const isAbortError = (err: unknown) => {
  if (!err) return false;
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return err.name === 'AbortError';
  }
  const error = err as Error;
  return error.name === 'AbortError' || /abort|aborted/i.test(String(error.message || ''));
};

export const useAssistantChat = ({
  ready = true,
  apiFetch,
  apiStreamFetch,
  chatSessionId,
  input,
  attachments = [],
  attachmentsBusy = false,
  onAttachmentsSent,
  setInput,
  messages,
  setMessages,
  activeFileContext,
  aclConfig,
  openFileContexts,
  getEditorSelection,
  settings,
  systemPrompt,
  onWorkspaceRefresh,
  onLiveWorkspaceFileUpdate,
  onLiveWorkspaceRunStateChange,
  loadRuns,
  success,
  showError,
}: AssistantChatParams) => {
  const [sending, setSending] = useState(false);
  const [pendingAssistantId, setPendingAssistantId] = useState<string | null>(null);

  const streamAbortRef = useRef<AbortController | null>(null);
  const stoppingRef = useRef(false);
  const activeRunIdRef = useRef('');
  useEffect(() => () => streamAbortRef.current?.abort(), [chatSessionId]);
  useRecoverRuns({ sending, chatSessionId, messages, apiFetch, setMessages, onWorkspaceRefresh, loadRuns });

  const sendMessage = async (overrideText?: string, overrideAttachments?: AssistantAttachment[]) => {
    if (sending || !ready || attachmentsBusy) return;
    const files = overrideAttachments ?? attachments;
    const prompt = (typeof overrideText === 'string' ? overrideText.trim() : input.trim()) || (files.length ? 'Review the attached files.' : '');
    if (!prompt) return;
    const abortController = new AbortController();
    streamAbortRef.current = abortController;
    stoppingRef.current = false;
    activeRunIdRef.current = '';
    onLiveWorkspaceRunStateChange?.('started');

    const userMessage: AiMessage = {
      id: `user-${createId()}`,
      role: 'user',
      content: prompt,
      ...(files.length ? { attachments: files } : {}),
      createdAt: new Date().toISOString(),
    };
    const assistantId = `assistant-${createId()}`;
    const assistantSeed: AiMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      status: 'running',
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMessage, assistantSeed];
    setMessages(nextMessages);
    if (typeof overrideText !== 'string') {
      setInput('');
      onAttachmentsSent?.();
    }
    setSending(true);
    setPendingAssistantId(assistantId);

    try {
      const payload = buildChatPayload(
        {
          messages,
          chatSessionId,
          settings,
          systemPrompt,
          openFileContexts,
          getEditorSelection,
          activeFileContext,
          aclConfig,
        },
        userMessage,
        assistantId,
      );
      await performAssistantRequest({
        apiStreamFetch,
        body: payload,
        signal: abortController.signal,
        patch: (update) =>
          setMessages((current) =>
            current.map((message) => (message.id === assistantId ? update(message) : message)),
          ),
        onRunId: (id) => {
          activeRunIdRef.current = id;
        },
        onLiveWorkspaceFileUpdate,
        onLiveWorkspaceRunStateChange,
        onWorkspaceRefresh,
        loadRuns,
        success,
        showError,
      });
    } catch (err) {
      onLiveWorkspaceRunStateChange?.('reverted');
      const interrupted = stoppingRef.current || isAbortError(err);
      const content = interrupted
        ? 'Request interrupted. Checking the recorded result.'
        : (err as Error).message || 'Assistant request failed';
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? { ...message, status: activeRunIdRef.current ? 'running' : 'failed', content }
            : message,
        ),
      );
      if (!interrupted) showError(content);
    } finally {
      streamAbortRef.current = null;
      stoppingRef.current = false;
      setSending(false);
      setPendingAssistantId(null);
    }
  };

  const stopMessage = () => {
    if (!sending) return;
    stoppingRef.current = true;
    if (apiFetch && activeRunIdRef.current) {
      void apiFetch(`/api/assistant/runs/${encodeURIComponent(activeRunIdRef.current)}/stop`, {
        method: 'POST',
      }).catch(() => streamAbortRef.current?.abort());
    } else streamAbortRef.current?.abort();
  };

  const getRetryPrompt = (messageId: string) => {
    const index = messages.findIndex((item) => item.id === messageId);
    if (index === -1) return '';
    const current = messages[index];
    if (current?.role === 'user') return current.content || '';
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const candidate = messages[cursor];
      if (candidate?.role === 'user' && String(candidate.content || '').trim()) {
        return candidate.content;
      }
    }
    return '';
  };

  const handleCopyMessage = useCallback(async (text: string) => {
    const value = String(text || '');
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
      success('Copied');
    } catch {
      showError('Copy failed');
    }
  }, [success, showError]);

  const handleRetryMessage = async (messageId: string) => {
    if (sending) return;
    const retryPrompt = getRetryPrompt(messageId);
    if (!retryPrompt.trim()) {
      showError('No prompt available to retry');
      return;
    }
    const index = messages.findIndex(message => message.id === messageId);
    const source = [...messages.slice(0, index + 1)].reverse().find(message => message.role === 'user');
    await sendMessage(retryPrompt, source?.attachments ?? []);
  };

  return {
    sending,
    pendingAssistantId,
    sendMessage,
    stopMessage,
    getRetryPrompt,
    handleCopyMessage,
    handleRetryMessage,
  };
};
