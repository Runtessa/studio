import dynamic from 'next/dynamic';
import { useState } from 'react';
import { FiCheck, FiCopy } from 'react-icons/fi';
import { useIdeTheme } from '@/lib/client/theme';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

type LogCodeViewerProps = {
  value: string;
  language: string;
  path: string;
  height?: number;
};

export function LogCodeViewer({ value, language, path, height = 260 }: LogCodeViewerProps) {
  const { theme } = useIdeTheme();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-borderSubtle bg-bgApp" style={{ height }}>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md border border-borderSubtle bg-bgSurface/90 text-textMuted shadow-sm backdrop-blur transition hover:text-textPrimary focus:outline-none focus:ring-2 focus:ring-accent/30"
        title={copied ? 'Copied' : 'Copy'}
        aria-label={copied ? 'Copied' : 'Copy editor content'}
      >
        {copied ? <FiCheck size={15} /> : <FiCopy size={15} />}
      </button>
      <MonacoEditor
        height="100%"
        language={language}
        path={path}
        theme={theme === 'light' ? 'vs-light' : 'vs-dark'}
        value={value}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 12,
          lineNumbers: 'on',
          renderLineHighlight: 'none',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          contextmenu: true,
        }}
      />
    </div>
  );
}
