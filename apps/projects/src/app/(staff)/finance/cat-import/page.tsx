import { requireDirector } from '@/lib/auth';
import CatImportWizard from './CatImportWizard';

export const metadata = { title: 'CAT Import | Finance' };

export default async function CatImportPage() {
  await requireDirector();
  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">CAT Cloud Import</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Import a Project Financial Summary CSV or XLSX export from CAT Cloud.
        </p>
      </div>
      <CatImportWizard />
    </div>
  );
}
