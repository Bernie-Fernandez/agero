import { requireAppUser } from '@/lib/auth';
import { getChatbotSessions } from './actions';
import ChatbotListClient from './ChatbotListClient';

export default async function ChatbotPage() {
  await requireAppUser();
  const sessions = await getChatbotSessions();
  return <ChatbotListClient sessions={sessions as never} />;
}
