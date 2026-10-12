import { AttachmentCards } from './AttachmentCards';
import type { ApiFetch } from './shared';
import { MessageActions } from './MessageActions';
import type { Dispatch, SetStateAction } from 'react';
import type { AiMessage, ChangeDiffPayload } from './shared';
import { AssistantMarkdown } from './AssistantMarkdown';
import { MessageActivity } from './MessageActivity';
import { MessageChanges } from './MessageChanges';
import { assistantAnswer } from './messagePresentation';

type MessageBubbleProps = {
  msg: AiMessage;
  apiFetch?: ApiFetch;
  sending: boolean;
  pendingAssistantId: string | null;
  openChangeDiffKeys: Record<string, boolean>;
  setOpenChangeDiffKeys: Dispatch<SetStateAction<Record<string, boolean>>>;
  onOpenChangeInMainEditor?: (payload: ChangeDiffPayload) => void;
  onRollback: (message: AiMessage) => Promise<void>;
  onCopyMessage: (text: string) => Promise<void>;
  onRetryMessage: (messageId: string) => Promise<void>;
  getRetryPrompt: (messageId: string) => string;
};

export function MessageBubble(props: MessageBubbleProps) {
  const { msg, sending, pendingAssistantId, onCopyMessage, onRetryMessage, getRetryPrompt } = props;
  const isUser = msg.role === 'user';
  const pending = !isUser && sending && pendingAssistantId === msg.id;
  const answer = isUser ? msg.content : assistantAnswer(msg.content);
  return (
    <article
      aria-label={isUser ? 'Your message' : 'Assistant response'}
      className={`min-w-0 ${isUser ? 'group flex flex-col items-end gap-1' : 'space-y-3 py-1'}`}
    >
      {isUser ? (
        <>
          <div className="max-w-[92%] rounded-xl border border-[#2a2d2e] bg-[#1f1f1f] px-3 py-2.5 text-[12px] leading-relaxed text-gray-100">
            <div className="whitespace-pre-wrap break-words">{answer}</div>
            <div className="mt-2"><AttachmentCards files={(msg.attachments || []).map(attachment => ({ attachment }))} apiFetch={props.apiFetch} /></div>
          </div>
          <MessageActions
            msg={msg}
            content={answer}
            sending={sending}
            onCopy={onCopyMessage}
            onRetry={onRetryMessage}
            getRetryPrompt={getRetryPrompt}
          />
        </>
      ) : (
        <>
          <MessageActivity msg={msg} pending={pending} />
          {msg.status === 'running' && !pending ? (
            <div role="status" className="text-[11px] text-gray-400">
              Recovering run result…
            </div>
          ) : null}
          {answer ? <AssistantMarkdown content={answer} onCopy={onCopyMessage} messageId={msg.id} /> : null}
          <MessageChanges {...props} />
          {msg.conflicts?.length ? (
            <div role="alert" className="text-[11px] text-amber-200">
              {msg.conflicts.length} conflict{msg.conflicts.length === 1 ? '' : 's'} detected. Review the run
              before retrying.
            </div>
          ) : null}
          <MessageActions
            msg={msg}
            content={answer}
            sending={sending}
            onCopy={onCopyMessage}
            onRetry={onRetryMessage}
            getRetryPrompt={getRetryPrompt}
          />
        </>
      )}
    </article>
  );
}
