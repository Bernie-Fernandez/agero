"use server";

import { clearWorkerSessionCookie } from "@/lib/worker-auth";
import { redirect } from "next/navigation";

export async function clearSiteSession(projectToken: string) {
  await clearWorkerSessionCookie();
  redirect(`/site/${projectToken}`);
}
