import { listAllCurves } from '@/lib/revenue-curves/actions';
import CurvesClient from './CurvesClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Revenue Curves | Admin' };

export default async function CurvesPage() {
  const curves = await listAllCurves();
  return <CurvesClient initialCurves={curves} />;
}
