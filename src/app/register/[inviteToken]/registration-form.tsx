"use client";

import { useActionState, useState, useTransition } from "react";
import type { RegisterState } from "./actions";
import { TRADE_CATEGORIES } from "@/lib/compliance";

type AbnStatus = "idle" | "checking" | "valid" | "invalid";

export function RegistrationForm({
  registerAction,
  abnCheckAction,
  invitation,
}: {
  registerAction: (prev: RegisterState, fd: FormData) => Promise<RegisterState>;
  abnCheckAction: (abn: string) => Promise<{ valid: boolean; businessName?: string; error?: string }>;
  invitation: { companyName: string; contactName: string; email: string };
}) {
  const [state, action, pending] = useActionState(registerAction, {});
  const [abn, setAbn] = useState("");
  const [abnStatus, setAbnStatus] = useState<AbnStatus>("idle");
  const [abnMessage, setAbnMessage] = useState("");
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  function handleAbnChange(value: string) {
    setAbn(value);
    setAbnStatus("idle");
    setAbnMessage("");
  }

  function handleAbnBlur() {
    const digits = abn.replace(/\s/g, "");
    if (digits.length !== 11) return;
    setAbnStatus("checking");
    startTransition(async () => {
      const result = await abnCheckAction(digits);
      if (result.valid) {
        setAbnStatus("valid");
        setAbnMessage(result.businessName ? `Registered as: ${result.businessName}` : "ABN is valid");
      } else {
        setAbnStatus("invalid");
        setAbnMessage(result.error ?? "Invalid ABN");
      }
    });
  }

  function toggleTrade(trade: string) {
    setSelectedTrades((prev) =>
      prev.includes(trade) ? prev.filter((t) => t !== trade) : [...prev, trade],
    );
  }

  return (
    <form action={action} className="space-y-6">
      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Company name</label>
          <input name="companyName" type="text" defaultValue={invitation.companyName} required
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            ABN <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              name="abn"
              type="text"
              inputMode="numeric"
              value={abn}
              onChange={(e) => handleAbnChange(e.target.value)}
              onBlur={handleAbnBlur}
              required
              placeholder="51 824 753 556"
              className={`w-full rounded-lg border px-3 py-2 pr-8 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:bg-zinc-800 dark:text-zinc-50 ${
                abnStatus === "valid" ? "border-green-400" :
                abnStatus === "invalid" ? "border-red-400" :
                "border-zinc-300 dark:border-zinc-600"
              }`}
            />
            {abnStatus === "checking" && (
              <span className="absolute right-2 top-2.5 text-xs text-zinc-400">…</span>
            )}
            {abnStatus === "valid" && (
              <span className="absolute right-2 top-2.5 text-green-500">✓</span>
            )}
            {abnStatus === "invalid" && (
              <span className="absolute right-2 top-2.5 text-red-500">✗</span>
            )}
          </div>
          {abnMessage && (
            <p className={`mt-1 text-xs ${abnStatus === "valid" ? "text-green-600" : "text-red-600"}`}>
              {abnMessage}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Company address</label>
          <input name="address" type="text" placeholder="123 Collins St, Melbourne VIC 3000"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Website (optional)</label>
          <input name="website" type="url" placeholder="https://smithelectrical.com.au"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Trade categories <span className="text-red-500">*</span>
          <span className="ml-2 text-xs font-normal text-zinc-400">{selectedTrades.length} selected</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {TRADE_CATEGORIES.map((trade) => {
            const selected = selectedTrades.includes(trade);
            return (
              <button
                key={trade}
                type="button"
                onClick={() => toggleTrade(trade)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  selected
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-500"
                }`}
              >
                {trade}
              </button>
            );
          })}
        </div>
        {selectedTrades.map((t) => (
          <input key={t} type="hidden" name="tradeCategories" value={t} />
        ))}
      </div>

      <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Pre-filled from invitation</p>
        <p className="text-sm text-zinc-500">Contact: {invitation.contactName} · {invitation.email}</p>
      </div>

      <button
        type="submit"
        disabled={pending || abnStatus === "invalid" || abnStatus === "checking"}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Registering…" : "Complete registration"}
      </button>
    </form>
  );
}
