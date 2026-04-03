import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { InductionForm } from "./induction-form";
import { submitInduction } from "./actions";

type Question = {
  question: string;
  options: string[];
  correctAnswer: number;
};

export default async function PublicInductionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ worker?: string }>;
}) {
  const { id } = await params;
  const { worker: workerId } = await searchParams;

  const template = await prisma.inductionTemplate.findUnique({ where: { id } });
  if (!template) notFound();

  let workerName: string | null = null;
  if (workerId) {
    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
    if (worker) workerName = `${worker.firstName} ${worker.lastName}`;
  }

  const questions = template.questions as Question[];
  const submitAction = submitInduction.bind(null, id, workerId ?? "");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Agero Safety</span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{template.title}</h1>
        {template.type === "generic" && (
          <p className="mt-1 text-sm text-zinc-500">General site induction — valid across all projects</p>
        )}
        {workerName && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Completing for: <span className="font-medium">{workerName}</span>
          </p>
        )}
        <p className="mt-1 text-sm text-zinc-500">{questions.length} questions · Pass mark: 80%</p>

        <div className="mt-6">
          <InductionForm questions={questions} submitAction={submitAction} />
        </div>
      </main>
    </div>
  );
}
