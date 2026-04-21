import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import CompaniesListClient from './CompaniesListClient';

export default async function CompaniesPage() {
  const user = await requireAppUser();

  const org = await prisma.organisation.findFirst({ where: { id: user.organisationId }, select: { id: true } });

  const [ptList, companies] = await Promise.all([
    org ? prisma.paymentTerm.findMany({
      where: { organisationId: org.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }) : [],
    prisma.company.findMany({
      where: { organisationId: user.organisationId },
      include: {
        _count: { select: { companyContacts: true } },
        trades: {
          where: { isPrimaryTrade: true },
          include: { costCode: { select: { codeDescription: true } } },
          take: 1,
        },
        insurancePolicies: {
          where: { isCurrent: true },
          select: { expiryDate: true, policyType: { select: { isMandatory: true } } },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const paymentTermsById: Record<string, string> = Object.fromEntries(ptList.map((p) => [p.id, p.name]));

  return (
    <CompaniesListClient
      initialCompanies={companies as never}
      paymentTermsById={paymentTermsById}
      paymentTermsList={ptList}
    />
  );
}
