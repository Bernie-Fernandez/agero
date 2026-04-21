'use server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

const MAX_BOOKMARKS = 20;

export type BookmarkData = {
  id: string;
  entityType: string;
  entityLabel: string;
  entityUrl: string;
};

export async function getUserBookmarks(): Promise<BookmarkData[]> {
  const { userId } = await auth();
  if (!userId) return [];
  return prisma.userBookmark.findMany({
    where: { clerkUserId: userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, entityType: true, entityLabel: true, entityUrl: true },
  });
}

export async function addBookmark(entityType: string, entityId: string, entityLabel: string, entityUrl: string): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: 'Not authenticated' };

  const count = await prisma.userBookmark.count({ where: { clerkUserId: userId } });
  if (count >= MAX_BOOKMARKS) return { ok: false, error: 'Bookmark limit reached. Remove a bookmark to add another.' };

  const existing = await prisma.userBookmark.findFirst({ where: { clerkUserId: userId, entityId } });
  if (existing) return { ok: true };

  await prisma.userBookmark.create({
    data: { clerkUserId: userId, entityType, entityId, entityLabel, entityUrl },
  });
  revalidatePath(entityUrl);
  return { ok: true };
}

export async function removeBookmark(entityId: string): Promise<{ ok: boolean }> {
  const { userId } = await auth();
  if (!userId) return { ok: false };
  await prisma.userBookmark.deleteMany({ where: { clerkUserId: userId, entityId } });
  return { ok: true };
}

export async function isBookmarked(entityId: string): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  const existing = await prisma.userBookmark.findFirst({ where: { clerkUserId: userId, entityId } });
  return !!existing;
}
