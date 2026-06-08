"use client";

import { useActionState, useRef, useEffect, useCallback, useState } from "react";
import type { ToolboxState, ToolboxPayload } from "./actions";

const PSYCHOSOCIAL_TOPIC = "Psychosocial hazards and mental health on site (mandatory — VIC OHS Psych Health Regs 2025)";

const SUGGESTED_TOPICS = [
  PSYCHOSOCIAL_TOPIC,
  "Site-specific hazard review",
  "Near miss reporting",
  "Emergency procedures",
  "Manual handling and ergonomics",
  "Working at height",
  "Plant and equipment safety",
  "Housekeeping and site tidiness",
  "Heat and cold stress management",
  "Chemical and hazardous substances",
];

interface Attendee {
  name: string;
  company: string;
  signatureDataUrl: string;
}

interface Action {
  description: string;
  assignedTo: string;
  dueDate: string;
}

interface Props {
  submitAction: (prev: ToolboxState, fd: FormData) => Promise<ToolboxState>;
}

function AttendeeSignatureCanvas({
  onCapture,
  onClear,
}: {
  onCapture: (dataUrl: string) => void;
  onClear: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [signed, setSigned] = useState(false);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setSigned(false);
  }, []);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  function getPos(canvas: HTMLCanvasElement, e: React.MouseEvent | React.TouchEvent) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * sx, y: (e.touches[0].clientY - rect.top) * sy };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * sx, y: ((e as React.MouseEvent).clientY - rect.top) * sy };
  }

  function start(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    isDrawing.current = true;
    const pos = getPos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(canvas, e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setSigned(true);
  }

  function stop() {
    isDrawing.current = false;
    if (signed && canvasRef.current) {
      onCapture(canvasRef.current.toDataURL("image/png"));
    }
  }

  function clear() {
    initCanvas();
    onClear();
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={400}
        height={80}
        onMouseDown={start}
        onMouseMove={draw}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={start}
        onTouchMove={draw}
        onTouchEnd={stop}
        className="w-full touch-none rounded border border-zinc-200 bg-white dark:border-zinc-700"
        style={{ cursor: "crosshair" }}
      />
      <button
        type="button"
        onClick={clear}
        className="mt-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        Clear
      </button>
    </div>
  );
}

export function ToolboxForm({ submitAction }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const today = new Date().toISOString().split("T")[0];

  const [selectedTopics, setSelectedTopics] = useState<string[]>([PSYCHOSOCIAL_TOPIC]);
  const [customTopic, setCustomTopic] = useState("");
  const [attendees, setAttendees] = useState<Attendee[]>([{ name: "", company: "", signatureDataUrl: "" }]);
  const [actions, setActions] = useState<Action[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);

  function toggleTopic(t: string) {
    if (t === PSYCHOSOCIAL_TOPIC) return; // mandatory — cannot deselect
    setSelectedTopics((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  function addCustomTopic() {
    const t = customTopic.trim();
    if (t && !selectedTopics.includes(t)) {
      setSelectedTopics((prev) => [...prev, t]);
    }
    setCustomTopic("");
  }

  function addAttendee() {
    setAttendees((prev) => [...prev, { name: "", company: "", signatureDataUrl: "" }]);
  }

  function updateAttendee(i: number, patch: Partial<Attendee>) {
    setAttendees((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }

  function removeAttendee(i: number) {
    setAttendees((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addAction() {
    setActions((prev) => [...prev, { description: "", assignedTo: "", dueDate: today }]);
  }

  function updateAction(i: number, patch: Partial<Action>) {
    setActions((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }

  function removeAction(i: number) {
    setActions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const validAttendees = attendees.filter((a) => a.name.trim());
    if (!validAttendees.length) {
      e.preventDefault();
      setClientError("At least one attendee is required.");
      return;
    }
    for (const a of validAttendees) {
      if (!a.signatureDataUrl) {
        e.preventDefault();
        setClientError(`Please get a signature from ${a.name || "attendee"}.`);
        return;
      }
    }
    setClientError(null);
    const payload: ToolboxPayload = {
      conductedAt: (e.currentTarget.elements.namedItem("conductedAt") as HTMLInputElement).value,
      topics: selectedTopics,
      attendees: validAttendees,
      actions: actions.filter((a) => a.description.trim()),
    };
    const hidden = (e.currentTarget as HTMLFormElement).elements.namedItem("payload") as HTMLInputElement | null;
    if (hidden) hidden.value = JSON.stringify(payload);
  }

  const error = clientError ?? state.error;

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Meeting date and time
        </label>
        <input
          name="conductedAt"
          type="datetime-local"
          defaultValue={new Date().toISOString().slice(0, 16)}
          required
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      {/* Topics */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Topics discussed</h2>
        <div className="space-y-2">
          {SUGGESTED_TOPICS.map((t) => {
            const mandatory = t === PSYCHOSOCIAL_TOPIC;
            const selected = selectedTopics.includes(t);
            return (
              <label
                key={t}
                className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 cursor-pointer ${
                  selected
                    ? mandatory
                      ? "border-blue-200 bg-blue-50 dark:border-blue-800/50 dark:bg-blue-950/20"
                      : "border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleTopic(t)}
                  disabled={mandatory}
                  className="mt-0.5 h-4 w-4"
                />
                <span className="text-xs text-zinc-700 dark:text-zinc-300">
                  {t}
                  {mandatory && (
                    <span className="ml-1 text-blue-600 dark:text-blue-400">(mandatory)</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomTopic())}
            placeholder="Add custom topic…"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button
            type="button"
            onClick={addCustomTopic}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
          >
            Add
          </button>
        </div>
        {selectedTopics
          .filter((t) => !SUGGESTED_TOPICS.includes(t))
          .map((t) => (
            <div key={t} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{t}</span>
              <button
                type="button"
                onClick={() => setSelectedTopics((prev) => prev.filter((x) => x !== t))}
                className="text-zinc-400 hover:text-red-500"
              >
                ×
              </button>
            </div>
          ))}
      </div>

      {/* Attendees */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Attendees ({attendees.length})
          </h2>
          <button
            type="button"
            onClick={addAttendee}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            + Add attendee
          </button>
        </div>
        {attendees.map((a, i) => (
          <div key={i} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={a.name}
                  onChange={(e) => updateAttendee(i, { name: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={a.company}
                  onChange={(e) => updateAttendee(i, { company: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Signature</p>
              <AttendeeSignatureCanvas
                onCapture={(sig) => updateAttendee(i, { signatureDataUrl: sig })}
                onClear={() => updateAttendee(i, { signatureDataUrl: "" })}
              />
              {a.signatureDataUrl && (
                <p className="mt-1 text-xs text-green-600 dark:text-green-400">✓ Signature captured</p>
              )}
            </div>
            {attendees.length > 1 && (
              <button
                type="button"
                onClick={() => removeAttendee(i)}
                className="text-xs text-red-600 hover:underline dark:text-red-400"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Actions arising ({actions.length})
          </h2>
          <button
            type="button"
            onClick={addAction}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            + Add action
          </button>
        </div>
        {actions.length === 0 && (
          <p className="text-xs text-zinc-500">No actions recorded.</p>
        )}
        {actions.map((a, i) => (
          <div key={i} className="grid grid-cols-3 gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <div className="col-span-3 sm:col-span-1">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Description
              </label>
              <input
                type="text"
                value={a.description}
                onChange={(e) => updateAction(i, { description: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Assigned to
              </label>
              <input
                type="text"
                value={a.assignedTo}
                onChange={(e) => updateAction(i, { assignedTo: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Due date
              </label>
              <input
                type="date"
                value={a.dueDate}
                onChange={(e) => updateAction(i, { dueDate: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <button
              type="button"
              onClick={() => removeAction(i)}
              className="col-span-3 text-left text-xs text-red-600 hover:underline dark:text-red-400"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <input type="hidden" name="payload" />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save toolbox meeting"}
      </button>
    </form>
  );
}
