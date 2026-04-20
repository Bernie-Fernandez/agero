"use server";

import { clearWorkerSessionCookie } from "@/lib/safety/worker-auth";
import { redirect } from "next/navigation";

export async function signOutWorker() {
  await clearWorkerSessionCookie();
  redirect("/worker/login");
}
