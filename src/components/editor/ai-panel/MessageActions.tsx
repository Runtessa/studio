import { FiCopy, FiRefreshCw } from 'react-icons/fi';
import type { AiMessage } from './shared';

type Props = {
  msg: AiMessage;
  content: string;
  sending: boolean;
  onCopy: (text: string) => Promise<void>;
  onRetry: (id: string) => Promise<void>;
  getRetryPrompt: (id: string) => string;
};
export function MessageActions({ msg, content, sending, onCopy, onRetry, getRetryPrompt }: Props) {
  const copyLabel = msg.role === 'user' ? 'Copy message' : 'Copy response';
  const button =
    'inline-flex h-7 w-7 items-center justify-center rounded hover:bg-[#2a2d2e] hover:text-gray-200 disabled:opacity-40';
  return (
    <div className="flex items-center gap-1 text-gray-500">
      <button
        type="button"
        className={button}
        onClick={() => void onCopy(content)}
        title={copyLabel}
        aria-label={copyLabel}
        disabled={!content.trim()}
      >
        <FiCopy className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={button}
        onClick={() => void onRetry(msg.id)}
        title="Retry"
        aria-label="Retry"
        disabled={sending || msg.status === 'running' || !getRetryPrompt(msg.id).trim()}
      >
        <FiRefreshCw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
