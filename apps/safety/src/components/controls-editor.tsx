"use client";

import {
  CONTROL_LEVELS,
  PPE_ONLY_WARNING,
  isPpeOnly,
  type ControlLevel,
  type ControlMeasure,
} from "@/lib/hierarchy-of-controls";

interface Props {
  controls: ControlMeasure[];
  onChange: (controls: ControlMeasure[]) => void;
  justification: string;
  onJustificationChange: (v: string) => void;
}

/**
 * Hierarchy-of-controls editor with live PPE-only enforcement.
 * When the only control(s) are PPE, a written justification field appears and is
 * required before submission (enforced again server-side via validateHierarchy).
 */
export function ControlsEditor({
  controls,
  onChange,
  justification,
  onJustificationChange,
}: Props) {
  const ppeOnly = isPpeOnly(controls);

  function add() {
    onChange([...controls, { level: "ELIMINATE", description: "" }]);
  }
  function update(i: number, patch: Partial<ControlMeasure>) {
    onChange(controls.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function remove(i: number) {
    onChange(controls.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Control measures
          </h3>
          <p className="text-xs text-zinc-500">
            Work top-down through the hierarchy. PPE cannot be the only control.
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          + Add control
        </button>
      </div>

      {controls.length === 0 && (
        <p className="text-xs text-zinc-500">No controls added yet.</p>
      )}

      {controls.map((c, i) => (
        <div
          key={i}
          className="grid grid-cols-1 gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700 sm:grid-cols-[200px_1fr_auto]"
        >
          <select
            value={c.level}
            onChange={(e) => update(i, { level: e.target.value as ControlLevel })}
            className="rounded-lg border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            {CONTROL_LEVELS.map((lvl) => (
              <option key={lvl.level} value={lvl.level}>
                {lvl.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={c.description}
            onChange={(e) => update(i, { description: e.target.value })}
            placeholder="Describe the control measure…"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-xs text-red-600 hover:underline dark:text-red-400"
          >
            Remove
          </button>
        </div>
      ))}

      {ppeOnly && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/20">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {PPE_ONLY_WARNING}
          </p>
          <label className="mt-3 block text-xs font-medium text-amber-800 dark:text-amber-300">
            Written justification (required)
          </label>
          <textarea
            value={justification}
            onChange={(e) => onJustificationChange(e.target.value)}
            rows={3}
            placeholder="Explain why higher-level controls are not reasonably practicable…"
            className="mt-1 w-full rounded-lg border border-amber-300 px-3 py-2 text-sm dark:border-amber-800/50 dark:bg-zinc-900"
          />
        </div>
      )}
    </div>
  );
}
