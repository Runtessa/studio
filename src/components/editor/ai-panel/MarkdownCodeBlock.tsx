import { FiCopy } from 'react-icons/fi';
import styles from './AssistantMarkdown.module.css';

type Props = { code: string; language?: string; onCopy: (text: string) => Promise<void> };

export function MarkdownCodeBlock({ code, language, onCopy }: Props) {
  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span>{language || 'Code'}</span>
        <button type="button" onClick={() => void onCopy(code)} aria-label="Copy code" title="Copy code">
          <FiCopy aria-hidden="true" /> Copy
        </button>
      </div>
      <pre dir="ltr" tabIndex={0} aria-label={`${language || 'Source'} code`}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
