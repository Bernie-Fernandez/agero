import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

const DEFAULT_FEEDS = [
  { name: 'ArchDaily', url: 'https://www.archdaily.com/feed' },
  { name: 'Dezeen', url: 'https://www.dezeen.com/feed' },
  { name: 'Work Design Magazine', url: 'https://workdesign.com/feed/' },
  { name: 'Workplace Design Magazine', url: 'https://workplacedesignmagazine.com/feed/' },
  { name: 'Interior Design Magazine', url: 'https://interiordesign.net/feed/' },
  { name: 'Architectural Digest', url: 'https://www.architecturaldigest.com/feed/rss' },
  { name: 'Azure Magazine', url: 'https://www.azuremagazine.com/feed/' },
  { name: 'Frame Magazine', url: 'https://www.frameweb.com/rss.xml' },
  { name: 'Metropolis Magazine', url: 'https://metropolismag.com/feed/' },
  { name: 'WORKTECH Academy', url: 'https://worktechacademy.com/feed/' },
];

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (user.role !== 'DIRECTOR' && user.role !== 'ADMINISTRATOR') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  let created = 0;
  for (const feed of DEFAULT_FEEDS) {
    const existing = await prisma.designRssFeed.findFirst({
      where: { organisationId: user.organisationId, url: feed.url },
    });
    if (!existing) {
      await prisma.designRssFeed.create({
        data: { organisationId: user.organisationId, name: feed.name, url: feed.url, createdById: user.id },
      });
      created++;
    }
  }

  return NextResponse.json({ ok: true, created });
}
