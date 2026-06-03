import { AdminSummaryCards } from '@/components/admin/AdminSummaryCards';
import { buildUserSummaryCards, type UserListItem } from './userDetailModel';

type UserWorkspaceSummaryProps = {
  user: UserListItem | null;
};

export function UserWorkspaceSummary({ user }: UserWorkspaceSummaryProps) {
  return <AdminSummaryCards cards={buildUserSummaryCards(user)} />;
}

export default UserWorkspaceSummary;
