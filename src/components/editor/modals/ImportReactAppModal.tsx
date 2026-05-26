import { useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/TextArea';
import type { ImportedReactAppPayload } from '@/components/editor/utils/importReactApp';

type Props = {
  open: boolean;
  busy: boolean;
  payload: ImportedReactAppPayload | null;
  packageName: string;
  packageVersion: string;
  dependenciesInput: string;
  errorMessage: string;
  onPickFiles: (files: FileList | null) => void;
  onNameChange: (value: string) => void;
  onVersionChange: (value: string) => void;
  onDependenciesChange: (value: string) => void;
  onClose: () => void;
  onImport: () => void;
};

export function ImportReactAppModal({
  open,
  busy,
  payload,
  packageName,
  packageVersion,
  dependenciesInput,
  errorMessage,
  onPickFiles,
  onNameChange,
  onVersionChange,
  onDependenciesChange,
  onClose,
  onImport,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import Existing React App"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onImport}
            disabled={busy || !payload || !packageName.trim() || !packageVersion.trim()}
          >
            {busy ? 'Importing...' : 'Import & Save'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-textMuted">
          Select an existing React app folder. The editor will detect entry file, dependencies,
          rewrite internal imports, and save each file as a UI entity in this tenant.
        </p>

        <input
          ref={(node) => {
            fileInputRef.current = node;
            if (node) {
              node.setAttribute('webkitdirectory', '');
              node.setAttribute('directory', '');
            }
          }}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => onPickFiles(event.target.files)}
        />

        <div className="rounded-md border border-borderSubtle bg-bgApp/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-textMuted">
              {payload
                ? `Detected ${payload.fileCount} source files. Entry: ${payload.entryPath}`
                : 'No folder selected yet.'}
            </div>
            <Button variant="secondary" size="sm" onClick={handleBrowse} disabled={busy}>
              Choose App Folder
            </Button>
          </div>
        </div>

        {!!errorMessage && (
          <div className="rounded-md border border-danger/50 bg-danger/10 px-3 py-2 text-xs text-danger">
            {errorMessage}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Package name"
            value={packageName}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="@app/my-app"
          />
          <Input
            label="Version"
            value={packageVersion}
            onChange={(event) => onVersionChange(event.target.value)}
            placeholder="1.0.0"
          />
        </div>

        {payload && (
          <div className="rounded-md border border-borderSubtle bg-bgApp/30 p-3">
            <div className="text-xs font-semibold text-textPrimary">Detected dependencies</div>
            <div className="mt-2 max-h-28 overflow-y-auto text-xs text-textMuted">
              {payload.dependencies.length
                ? payload.dependencies.join(', ')
                : 'No external npm dependencies detected.'}
            </div>
          </div>
        )}

        <TextArea
          label="Dependencies to save (comma/newline separated)"
          value={dependenciesInput}
          onChange={(event) => onDependenciesChange(event.target.value)}
          placeholder="react-router-dom, @tanstack/react-query"
          rows={4}
        />
      </div>
    </Modal>
  );
}
