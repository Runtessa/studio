import { Children, isValidElement, useMemo, type ReactElement, type ReactNode } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MarkdownCodeBlock } from './MarkdownCodeBlock';
import styles from './AssistantMarkdown.module.css';

export function AssistantMarkdown({
  content,
  onCopy,
  messageId,
}: {
  content: string;
  onCopy: (text: string) => Promise<void>;
  messageId: string;
}) {
  const components = useMemo<Components>(
    () => ({
      pre: ({ children }) => {
        const element = Children.toArray(children).find(isValidElement) as
          | ReactElement<{
              children?: ReactNode;
              className?: string;
            }>
          | undefined;
        const code = String(element?.props.children ?? '');
        const language = /(?:^|\s)language-([^\s]+)/.exec(element?.props.className || '')?.[1];
        return <MarkdownCodeBlock code={code} language={language} onCopy={onCopy} />;
      },
      a: ({ node: _node, children, href, ...props }) =>
        href ? (
          <a
            {...props}
            href={href}
            target={href.startsWith('#') ? undefined : '_blank'}
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ) : (
          <span>{children}</span>
        ),
      table: ({ node: _node, ...props }) => (
        <div className={styles.tableScroll} role="region" aria-label="Response table" tabIndex={0}>
          <table {...props} />
        </div>
      ),
      // Model-produced images must not automatically send browser requests.
      img: ({ alt }) => (alt ? <span className={styles.imageLabel}>{alt}</span> : null),
    }),
    [onCopy],
  );
  return (
    <div className={styles.markdown}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        remarkRehypeOptions={{ clobberPrefix: `assistant-${messageId}-` }}
        components={components}
        skipHtml
      >
        {content}
      </Markdown>
    </div>
  );
}
