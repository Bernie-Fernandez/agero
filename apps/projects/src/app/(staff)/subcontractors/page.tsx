import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import SubcontractorsListClient from './SubcontractorsListClient';

export default async function SubcontractorsPage() {
  const user = await requireAppUser();

  const companies = await prisma.company.findMany({
    where: {
      organisationId: user.organisationId,
      types: { has: 'SUBCONTRACTOR' },
    },
    include: {
      subcontractorProfile: { select: { approvalStatus: true, portalAccessEnabled: true } },
      trades: {
        where: { isPrimaryTrade: true },
        include: { costCode: { select: { codeDescription: true } } },
        take: 1,
      },
      insurancePolicies: {
        where: { isCurrent: true },
        select: { expiryDate: true, policyType: { select: { isMandatory: true } } },
      },
      _count: { select: { companyContacts: true } },
    },
    orderBy: { name: 'asc' },
  });

  const allCompanies = await prisma.company.findMany({
    where: { organisationId: user.organisationId, types: { has: 'SUBCONTRACTOR' }, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return <SubcontractorsListClient initialData={companies as never} companies={allCompanies} />;
}
