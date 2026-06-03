import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { AdapterOptionForm } from './AdapterOptionForm';
import {
  type AdapterEntryMode,
  asObject,
  buildReadWriteEntry,
  buildSingleEntry,
  getAdapterDescription,
  getAdapterLabel,
  getDefaultOptionKey,
  getDefaultEntryMode,
  inferEntryMode,
  nextAvailableKey,
  normalizeConfigKey,
  toReadArray,
} from './adapterConfigModel';

type AdapterGroupFormProps = {
  adapter: string;
  block: Record<string, any>;
  onRename: (nextAdapter: string) => void;
  onRemove: () => void;
  onChange: (block: Record<string, any>) => void;
};

const firstEntryMode = (adapter: string, block: Record<string, any>): AdapterEntryMode => {
  const firstEntry = Object.values(block)[0];
  return inferEntryMode(adapter, firstEntry);
};

export function AdapterGroupForm({ adapter, block, onRename, onRemove, onChange }: AdapterGroupFormProps) {
  const [draftAdapter, setDraftAdapter] = useState(adapter);
  const [newOptionKey, setNewOptionKey] = useState<string>(getDefaultOptionKey(adapter));
  const [newOptionMode, setNewOptionMode] = useState<AdapterEntryMode>(() => firstEntryMode(adapter, block));
  const entries = Object.entries(block);

  useEffect(() => {
    setDraftAdapter(adapter);
    setNewOptionKey(getDefaultOptionKey(adapter));
    setNewOptionMode(firstEntryMode(adapter, block) || getDefaultEntryMode(adapter));
  }, [adapter]);

  const updateEntry = (key: string, entry: unknown) => onChange({ ...block, [key]: entry });

  const applyAdapterRename = () => {
    if (draftAdapter !== adapter) onRename(draftAdapter);
  };

  const addOption = () => {
    const key = nextAvailableKey(block, newOptionKey);
    const entry = newOptionMode === 'readWrite' ? buildReadWriteEntry(adapter, key) : buildSingleEntry(adapter, key);
    onChange({ ...block, [key]: entry });
    setNewOptionKey(getDefaultOptionKey(adapter));
  };

  const renameOption = (previousKey: string, rawNextKey: string) => {
    const nextKey = normalizeConfigKey(rawNextKey);
    if (!nextKey || nextKey === previousKey || block[nextKey]) return;
    const next = { ...block, [nextKey]: block[previousKey] };
    delete next[previousKey];
    onChange(next);
  };

  const removeOption = (key: string) => {
    const next = { ...block };
    delete next[key];
    onChange(next);
  };

  const updateSingleRef = (key: string, path: string[], value: string) => {
    const entry = asObject(block[key]);
    const nextEntry: Record<string, any> = { ...entry, stages: asObject(entry.stages) };
    if (path[0] === 'default') nextEntry.default = value;
    if (path[0] === 'stages') nextEntry.stages[path[1]] = value;
    updateEntry(key, nextEntry);
  };

  const updateReadWriteRef = (key: string, stage: string, field: 'read' | 'write', value: string) => {
    const entry = asObject(block[key]);
    const nextEntry = { ...entry, default: asObject(entry.default), stages: asObject(entry.stages) };
    const target = stage === 'default' ? asObject(nextEntry.default) : asObject(nextEntry.stages[stage]);
    target[field] = field === 'read' ? toReadArray(value) : value.trim();
    if (stage === 'default') nextEntry.default = target;
    else nextEntry.stages[stage] = target;
    updateEntry(key, nextEntry);
  };

  return (
    <section className="rounded-lg border border-borderSubtle bg-bgSurface p-4">
      <div className="mb-4 space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-textPrimary">{getAdapterLabel(adapter)}</h3>
          <span className="rounded-full border border-borderSubtle px-2 py-0.5 text-[11px] text-textMuted">
            {adapter}
          </span>
        </div>
        <p className="text-xs text-textMuted">{getAdapterDescription(adapter)}</p>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <Input
          label="Adapter key"
          value={draftAdapter}
          onBlur={applyAdapterRename}
          onChange={(e) => setDraftAdapter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              applyAdapterRename();
            }
          }}
        />
        <Button type="button" variant="danger" size="xs" className="self-end" onClick={onRemove}>
          Remove adapter
        </Button>
      </div>

      <div className="mb-4 rounded-lg border border-borderSubtle bg-bgApp p-4">
        <div className="mb-3 flex flex-col gap-1">
          <h4 className="text-sm font-semibold text-textPrimary">Add connection option</h4>
          <p className="text-xs text-textMuted">
            Use one option per role or destination, such as `primary`, `readonly`, `cache`, `events`, or `assets`.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
        <Input
          label="New option key"
          value={newOptionKey}
          onChange={(e) => setNewOptionKey(e.target.value)}
          helperText="Use a role-based key such as primary, readonly, cache, events, or assets."
        />
        <Select
          label="Connection shape"
          value={newOptionMode}
          options={[
            { label: 'Single secret refs', value: 'single' },
            { label: 'Read/write secret refs', value: 'readWrite' },
          ]}
          onChange={(e) => setNewOptionMode(e.target.value === 'readWrite' ? 'readWrite' : 'single')}
        />
        <Button type="button" variant="secondary" size="sm" className="self-end" onClick={addOption}>
          Add option
        </Button>
        </div>
      </div>

      <div className="space-y-4">
        {entries.length === 0 ? (
          <div className="rounded-lg border border-borderSubtle bg-bgApp px-3 py-2 text-xs text-textMuted">
            No options configured for this adapter yet. Add the first option above.
          </div>
        ) : null}
        {entries.map(([key, entry]) => (
          <AdapterOptionForm
            key={key}
            adapter={adapter}
            optionKey={key}
            entry={entry}
            onRename={(nextKey) => renameOption(key, nextKey)}
            onRemove={() => removeOption(key)}
            onSingleRefChange={(path, value) => updateSingleRef(key, path, value)}
            onReadWriteRefChange={(stage, field, value) => updateReadWriteRef(key, stage, field, value)}
          />
        ))}
      </div>
    </section>
  );
}
