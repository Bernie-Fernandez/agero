'use client';

export type StepperStage = {
  stage: number;
  label: string;
  status: 'complete' | 'current' | 'pending' | 'na';
  tabKey?: string;
};

const TAB_MAP: Record<number, string> = {
  2: 'documents',
  3: 'documents',
  4: 'takeoff',
  5: 'cost-plan',
  6: 'scope',
  7: 'scope',
};

export default function EstimateStepper({
  stages,
  estimateId,
}: {
  stages: StepperStage[];
  estimateId: string;
}) {
  function handleClick(stage: StepperStage) {
    const tab = TAB_MAP[stage.stage];
    if (tab && stage.status === 'complete') {
      window.location.href = `/leads/${estimateId}/${tab}`;
    }
  }

  return (
    <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-3">
      <div className="flex items-center gap-0 min-w-0 overflow-x-auto">
        {stages.map((stage, idx) => (
          <div key={stage.stage} className="flex items-center shrink-0">
            {/* Circle + label */}
            <button
              onClick={() => handleClick(stage)}
              disabled={stage.status !== 'complete' || !TAB_MAP[stage.stage]}
              className={`flex flex-col items-center gap-1 group ${
                stage.status === 'complete' && TAB_MAP[stage.stage] ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                stage.status === 'complete'
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : stage.status === 'current'
                  ? 'bg-white border-blue-600 text-blue-600 ring-2 ring-blue-200 ring-offset-1'
                  : stage.status === 'na'
                  ? 'bg-zinc-200 border-zinc-300 text-zinc-400'
                  : 'bg-white border-zinc-300 text-zinc-400'
              }`}>
                {stage.status === 'complete' ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  stage.stage
                )}
              </div>
              <span className={`text-[10px] whitespace-nowrap font-medium ${
                stage.status === 'complete'
                  ? 'text-blue-600 group-hover:text-blue-800'
                  : stage.status === 'current'
                  ? 'text-blue-600'
                  : stage.status === 'na'
                  ? 'text-zinc-400'
                  : 'text-zinc-400'
              }`}>
                {stage.status === 'na' ? 'N/A' : stage.label}
              </span>
            </button>

            {/* Connector line */}
            {idx < stages.length - 1 && (
              <div className={`h-0.5 w-8 mx-1 mb-4 rounded transition-colors ${
                stage.status === 'complete' ? 'bg-blue-600' : 'bg-zinc-200'
              }`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
