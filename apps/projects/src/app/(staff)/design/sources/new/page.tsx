import { requireAppUser } from '@/lib/auth';
import NewSourceClient from './NewSourceClient';

export default async function NewSourcePage() {
  await requireAppUser();
  return <NewSourceClient />;
}
