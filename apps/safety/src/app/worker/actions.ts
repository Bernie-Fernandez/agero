"use server";

import { clearWorkerSessionCookie } from "@/lib/worker-auth";
import { redirect } from "next/navigation";

export async function signOutWorker() {
  await clearWorkerSessionCookie();
  redirect("/worker/login");
}
