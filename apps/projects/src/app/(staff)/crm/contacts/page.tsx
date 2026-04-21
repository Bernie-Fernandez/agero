import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import ContactsListClient from './ContactsListClient';

export default async function ContactsPage() {
  const user = await requireAppUser();

  const [contacts, companies] = await Promise.all([
    prisma.contact.findMany({
      where: { organisationId: user.organisationId },
      include: {
        companyContacts: {
          where: { isPrimary: true },
          include: { company: { select: { id: true, name: true } } },
          take: 1,
        },
        contactOwner: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.company.findMany({
      where: { organisationId: user.organisationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return <ContactsListClient initialContacts={contacts as never} companies={companies} />;
}
