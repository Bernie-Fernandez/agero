import { cookies } from "next/headers";
import { prisma } from "./prisma";

const COOKIE_NAME = "ws_token";
const SESSION_DAYS = 30;

export type WorkerSessionWithAccount = {
  id: string;
  token: string;
  expiresAt: Date;
  workerAccountId: string;
  workerAccount: {
    id: string;
    mobile: string;
    firstName: string;
    lastName: string;
    trades: string[];
    whiteCardNumber: string | null;
    whiteCardExpiry: Date | null;
    tradeLicenceNumber: string | null;
    tradeLicenceExpiry: Date | null;
    firstAidCertNumber: string | null;
    firstAidExpiry: Date | null;
  };
};

export async function getWorkerSession(): Promise<WorkerSessionWithAccount | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.workerSession.findUnique({
    where: { token },
    include: { workerAccount: true },
  });

  if (!session || session.expiresAt < new Date()) return null;
  return session as WorkerSessionWithAccount;
}

export async function createWorkerSession(workerAccountId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const session = await prisma.workerSession.create({
    data: { workerAccountId, expiresAt },
  });
  return session.token;
}

export async function setWorkerSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export async function clearWorkerSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
