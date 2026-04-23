import { requireAppUser } from '@/lib/auth';
import { getSource } from '../actions';
import { notFound } from 'next/navigation';
import SourceDetailClient from './SourceDetailClient';

export default async function SourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAppUser();
  const { id } = await params;
  const source = await getSource(id);
  if (!source) notFound();
  const isAdmin = user.role === 'DIRECTOR' || user.role === 'ADMINISTRATOR';
  return <SourceDetailClient source={source as never} isAdmin={isAdmin} />;
}
