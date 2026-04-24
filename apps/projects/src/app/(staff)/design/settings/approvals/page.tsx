import { requireAppUser } from '@/lib/auth';
import { getPendingProposals, approveProposal, rejectProposal } from '../actions';
import { redirect } from 'next/navigation';
import ApprovalsClient from './ApprovalsClient';

export default async function ApprovalsPage() {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') redirect('/design/settings');
  const proposals = await getPendingProposals(user.organisationId);
  return <ApprovalsClient proposals={proposals as never} />;
}
