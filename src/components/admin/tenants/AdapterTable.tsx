import { Button } from '@/components/ui/Button';
import { asObject, getAdapterDescription, getAdapterLabel, inferEntryMode } from './adapterConfigModel';

type AdapterTableProps = {
  adapters: Array<[string, unknown]>;
  selectedAdapter: string;
  onSelect: (adapter: string) => void;
  onRemove: (adapter: string) => void;
};

const shapeSummary = (adapter: string, block: Record<string, any>) => {
  const modes = new Set(Object.values(block).map((entry) => inferEntryMode(adapter, entry)));
  if (modes.size > 1) return 'Mixed';
  if (modes.has('readWrite')) return 'Read/write';
  return 'Single';
};

const optionSummary = (block: Record<string, any>) => {
  const keys = Object.keys(block);
  if (!keys.length) return 'No options';
  if (keys.length === 1) return keys[0];
  if (keys.length === 2) return `${keys[0]}, ${keys[1]}`;
  return `${keys[0]}, ${keys[1]} +${keys.length - 2}`;
};

export function AdapterTable({ adapters, selectedAdapter, onSelect, onRemove }: AdapterTableProps) {
  if (!adapters.length) {
    return (
      <div className="rounded-lg border border-borderSubtle bg-bgSurface p-4 text-sm text-textMuted">
        No adapters configured. Add an adapter type above.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-borderSubtle bg-bgSurface">
      <table className="w-full text-left text-sm">
        <thead className="bg-bgApp text-xs uppercase tracking-wide text-textMuted">
          <tr>
            <th className="px-4 py-3 font-semibold">Adapter</th>
            <th className="px-4 py-3 font-semibold">Options</th>
            <th className="px-4 py-3 font-semibold">Shape</th>
            <th className="px-4 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-borderSubtle">
          {adapters.map(([adapter, rawBlock]) => {
            const block = asObject(rawBlock);
            const selected = selectedAdapter === adapter;
            return (
              <tr
                key={adapter}
                className={`${selected ? 'bg-accent/10' : 'bg-bgSurface hover:bg-bgApp'} cursor-pointer`}
                onClick={() => onSelect(adapter)}
              >
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-textPrimary">{getAdapterLabel(adapter)}</span>
                      <span className="rounded-full border border-borderSubtle px-2 py-0.5 text-[11px] text-textMuted">
                        {adapter}
                      </span>
                    </div>
                    <p className="text-xs text-textMuted">{getAdapterDescription(adapter)}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-textMuted">
                  <div className="space-y-1">
                    <div>{Object.keys(block).length} configured</div>
                    <div className="text-xs">Options: {optionSummary(block)}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-textMuted">{shapeSummary(adapter, block)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant={selected ? 'primary' : 'secondary'}
                      size="xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(adapter);
                      }}
                    >
                      {selected ? 'Editing' : 'Edit'}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemove(adapter);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
