import { requireAppUser } from '@/lib/auth';
import { getChatbotSession } from '../actions';
import { notFound } from 'next/navigation';
import ChatbotSessionClient from './ChatbotSessionClient';

export default async function ChatbotSessionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAppUser();
  const { id } = await params;
  try {
    const session = await getChatbotSession(id);
    return <ChatbotSessionClient session={session as never} />;
  } catch {
    notFound();
  }
}
