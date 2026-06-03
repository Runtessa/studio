type AdminSummaryCard = {
  label: string;
  value: string;
  hint: string;
};

type AdminSummaryCardsProps = {
  cards: AdminSummaryCard[];
};

export function AdminSummaryCards({ cards }: AdminSummaryCardsProps) {
  if (!cards.length) return null;

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-borderSubtle bg-bgSurface px-4 py-4 shadow-soft"
        >
          <div className="text-[11px] uppercase tracking-[0.18em] text-textMuted">{card.label}</div>
          <div className="mt-2 text-lg font-semibold text-textPrimary">{card.value}</div>
          <p className="mt-1 text-xs text-textMuted">{card.hint}</p>
        </div>
      ))}
    </section>
  );
}

export default AdminSummaryCards;
