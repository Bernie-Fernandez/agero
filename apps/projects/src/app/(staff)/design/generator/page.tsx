export default function DesignGeneratorPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-48px)] bg-zinc-50">
      <div className="text-center max-w-md px-6">
        <div className="flex justify-center mb-4">
          <svg className="w-12 h-12 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-zinc-700 mb-2">Design Generator</h1>
        <p className="text-sm text-zinc-500 mb-1">Coming in Design Studio 2</p>
        <p className="text-xs text-zinc-400">
          The Design Generator will use your uploaded sources and client briefs to automatically generate floor plan options, space programming recommendations, and design specifications.
        </p>
      </div>
    </div>
  );
}
