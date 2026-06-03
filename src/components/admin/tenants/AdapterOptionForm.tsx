import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { STAGES, asObject, asReadText, asText, inferEntryMode } from './adapterConfigModel';

type AdapterOptionFormProps = {
  adapter: string;
  optionKey: string;
  entry: unknown;
  onRename: (nextKey: string) => void;
  onRemove: () => void;
  onSingleRefChange: (path: string[], value: string) => void;
  onReadWriteRefChange: (stage: string, field: 'read' | 'write', value: string) => void;
};

export function AdapterOptionForm({
  adapter,
  optionKey,
  entry: rawEntry,
  onRename,
  onRemove,
  onSingleRefChange,
  onReadWriteRefChange,
}: AdapterOptionFormProps) {
  const [draftKey, setDraftKey] = useState(optionKey);
  const entry = asObject(rawEntry);
  const stages = asObject(entry.stages);
  const mode = inferEntryMode(adapter, entry);

  useEffect(() => {
    setDraftKey(optionKey);
  }, [optionKey]);

  const applyRename = () => {
    if (draftKey !== optionKey) onRename(draftKey);
  };

  return (
    <article className="rounded-lg border border-borderSubtle bg-bgApp p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1">
          <Input
            label="Option key"
            value={draftKey}
            onBlur={applyRename}
            onChange={(e) => setDraftKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyRename();
              }
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:pt-7">
          <span className="rounded-full border border-borderSubtle bg-bgSurface px-2.5 py-1 text-xs text-textPrimary">
            {mode === 'readWrite' ? 'Read/write' : 'Single secret'}
          </span>
          <Button type="button" variant="danger" size="xs" onClick={onRemove}>
            Remove option
          </Button>
        </div>
      </div>

      {mode === 'readWrite' ? (
        <div className="grid gap-3 md:grid-cols-2">
          <TextArea
            label="Default read refs"
            value={asReadText(asObject(entry.default).read)}
            onChange={(e) => onReadWriteRefChange('default', 'read', e.target.value)}
            className="min-h-[74px]"
          />
          <Input
            label="Default write ref"
            value={asText(asObject(entry.default).write)}
            onChange={(e) => onReadWriteRefChange('default', 'write', e.target.value)}
          />
          {STAGES.map((stage) => (
            <div key={stage} className="grid gap-3 rounded-md border border-borderSubtle bg-bgSurface p-3 md:col-span-2 md:grid-cols-2">
              <div className="md:col-span-2 text-xs font-semibold uppercase tracking-wide text-textMuted">
                {stage}
              </div>
              <TextArea
                label={`${stage} read refs`}
                value={asReadText(asObject(stages[stage]).read)}
                onChange={(e) => onReadWriteRefChange(stage, 'read', e.target.value)}
                className="min-h-[68px]"
              />
              <Input
                label={`${stage} write ref`}
                value={asText(asObject(stages[stage]).write)}
                onChange={(e) => onReadWriteRefChange(stage, 'write', e.target.value)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Default secret ref"
            value={asText(entry.default)}
            onChange={(e) => onSingleRefChange(['default'], e.target.value)}
          />
          {STAGES.map((stage) => (
            <Input
              key={stage}
              label={`${stage} secret ref`}
              value={asText(stages[stage])}
              onChange={(e) => onSingleRefChange(['stages', stage], e.target.value)}
            />
          ))}
        </div>
      )}
    </article>
  );
}
