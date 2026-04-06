"use server";

import { prisma } from "@/lib/prisma";
import { generateSmsCode, sendSmsCode } from "@/lib/sms";
import {
  createWorkerSession,
  getWorkerSession,
  setWorkerSessionCookie,
} from "@/lib/worker-auth";
import { redirect } from "next/navigation";

export type SiteAuthState =
  | { step: "mobile"; error?: string }
  | { step: "verify"; mobile: string; devCode?: string; error?: string }
  | { step: "name"; mobile: string; error?: string }
  | { step: "ready"; mobile: string };

/** Single action driving the SMS gate on the site sign-in page. */
export async function siteAuthAction(
  projectToken: string,
  _prev: SiteAuthState,
  fd: FormData,
): Promise<SiteAuthState> {
  const _step = fd.get("_step")?.toString() ?? "mobile";

  if (_step === "mobile") {
    const mobile = fd.get("mobile")?.toString().trim() ?? "";
    if (!mobile || mobile.replace(/\D/g, "").length < 8) {
      return { step: "mobile", error: "Enter a valid mobile number." };
    }

    // Already has an active session — go straight to sign-in
    const session = await getWorkerSession();
    if (session) return { step: "ready", mobile: session.workerAccount.mobile };

    const code = generateSmsCode();
    await prisma.smsVerification.create({
      data: { mobile, code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    });

    let devCode: string | undefined;
    try {
      await sendSmsCode(mobile, code);
      if (!process.env.TWILIO_ACCOUNT_SID) devCode = code;
    } catch {
      return { step: "mobile", error: "Could not send SMS. Please try again." };
    }

    return { step: "verify", mobile, devCode };
  }

  if (_step === "verify") {
    const mobile = fd.get("mobile")?.toString().trim() ?? "";
    const code = fd.get("code")?.toString().trim() ?? "";

    if (!code || code.length !== 6) {
      return { step: "verify", mobile, error: "Enter the 6-digit code." };
    }

    const verification = await prisma.smsVerification.findFirst({
      where: { mobile, code, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    if (!verification) {
      return { step: "verify", mobile, error: "Code incorrect or expired." };
    }

    await prisma.smsVerification.update({ where: { id: verification.id }, data: { used: true } });

    const account = await prisma.workerAccount.findUnique({ where: { mobile } });
    if (!account) {
      return { step: "name", mobile };
    }

    const token = await createWorkerSession(account.id);
    await setWorkerSessionCookie(token);
    return { step: "ready", mobile };
  }

  if (_step === "name") {
    const mobile = fd.get("mobile")?.toString().trim() ?? "";
    const firstName = fd.get("firstName")?.toString().trim() ?? "";
    const lastName = fd.get("lastName")?.toString().trim() ?? "";

    if (!firstName || !lastName) {
      return { step: "name", mobile, error: "Please enter your full name." };
    }

    const recent = await prisma.smsVerification.findFirst({
      where: { mobile, used: true, createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
    });
    if (!recent) {
      return { step: "mobile", error: "Session expired. Please start again." };
    }

    const account = await prisma.workerAccount.upsert({
      where: { mobile },
      create: { mobile, firstName, lastName },
      update: {},
    });

    const token = await createWorkerSession(account.id);
    await setWorkerSessionCookie(token);
    redirect(`/site/${projectToken}`);
  }

  return { step: "mobile" };
}
