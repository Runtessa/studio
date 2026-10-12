import { FiChevronRight, FiAlertCircle } from 'react-icons/fi';
import type { AiMessage } from './shared';
import { activityLabel } from './messagePresentation';

export function MessageActivity({ msg, pending }: { msg: AiMessage; pending: boolean }) {
  if (
    !msg.progress?.length &&
    !msg.steps?.length &&
    !msg.liveFiles?.length &&
    !pending &&
    msg.status !== 'failed' &&
    msg.status !== 'running'
  )
    return null;
  return (
    <details className="group min-w-0 text-[11px] text-gray-400">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1 hover:text-gray-200">
        <FiChevronRight aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-90" />
        {msg.status === 'failed' ? <FiAlertCircle aria-hidden="true" /> : null}
        <span>{activityLabel(msg, pending)}</span>
        {pending ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-500" /> : null}
      </summary>
      <div className="ml-1.5 mt-1 space-y-3 border-l border-[#2a2d2e] pl-3">
        {msg.progress?.length ? (
          <div>
            <div className="mb-1 text-gray-300">Progress</div>
            <div className="max-h-40 overflow-auto font-mono text-[10px] leading-5">
              {msg.progress.map((line, index) => (
                <div key={index} className="break-words">
                  {line}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {msg.liveFiles?.length ? (
          <div>
            <div className="mb-1 text-gray-300">Workspace activity</div>
            <ul className="max-h-40 space-y-1 overflow-auto font-mono text-[10px]">
              {msg.liveFiles.map((file) => (
                <li key={file.path} className="break-all">
                  <span className="text-gray-500">{file.action}</span> {file.path}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {msg.steps?.length ? (
          <div>
            <div className="mb-1 text-gray-300">Timeline</div>
            <ol className="max-h-40 space-y-1 overflow-auto text-[10px]">
              {msg.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </details>
  );
}
