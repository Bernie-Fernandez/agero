import { prisma } from '@/lib/prisma';
import { requireDirector } from '@/lib/auth';
import SecuredForecastClient from './SecuredForecastClient';

function currentFY() {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

export default async function SecuredForecastPage() {
  const user = await requireDirector();
  const fy = currentFY();

  const forecasts = await prisma.securedForecast.findMany({
    where: { organisationId: user.organisationId, financialYear: fy },
    orderBy: { jobNumber: 'asc' },
  });

  return <SecuredForecastClient forecasts={forecasts as never} defaultFY={fy} />;
}
