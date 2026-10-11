import Image from 'next/image';
import branding from '@/branding.json';

export function BrandLockup({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <Image src={branding.logo_icon} alt="" width={36} height={36} className="rounded-lg" priority />
      <span className="text-xl font-semibold tracking-tight">{branding.brand_name}</span>
    </span>
  );
}
