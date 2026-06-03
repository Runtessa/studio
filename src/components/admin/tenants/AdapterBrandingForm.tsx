import { Input } from '@/components/ui/Input';
import { asText } from './adapterConfigModel';

type AdapterBrandingFormProps = {
  branding: Record<string, any>;
  onChange: (key: string, value: string) => void;
};

export function AdapterBrandingForm({ branding, onChange }: AdapterBrandingFormProps) {
  return (
    <section className="rounded-lg border border-borderSubtle bg-bgSurface p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-textPrimary">Application branding</h3>
        <p className="mt-1 text-xs text-textMuted">These values feed tenant title and icon tags.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="App title" value={asText(branding.title)} onChange={(e) => onChange('title', e.target.value)} />
        <Input label="Favicon URL" value={asText(branding.faviconUrl)} onChange={(e) => onChange('faviconUrl', e.target.value)} />
        <Input
          label="Apple touch icon URL"
          value={asText(branding.appleTouchIconUrl)}
          onChange={(e) => onChange('appleTouchIconUrl', e.target.value)}
        />
      </div>
    </section>
  );
}
