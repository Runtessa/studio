import { AdminSummaryCards } from '@/components/admin/AdminSummaryCards';

type TeamDetailSummaryProps = {
  cards: Array<{
    label: string;
    value: string;
    hint: string;
  }>;
};

export function TeamDetailSummary({ cards }: TeamDetailSummaryProps) {
  return <AdminSummaryCards cards={cards} />;
}

export default TeamDetailSummary;
