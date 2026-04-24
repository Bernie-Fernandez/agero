import { prisma } from '@/lib/prisma';
import { requireDirector } from '@/lib/auth';
import BudgetClient from './BudgetClient';

function currentFY() {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

export default async function BudgetPage() {
  const user = await requireDirector();
  const fy = currentFY();

  const budgets = await prisma.annualBudget.findMany({
    where: { organisationId: user.organisationId, financialYear: fy },
    orderBy: [{ displayOrder: 'asc' }, { category: 'asc' }, { lineItem: 'asc' }],
  });

  return <BudgetClient budgets={budgets as never} defaultFY={fy} organisationId={user.organisationId} />;
}
