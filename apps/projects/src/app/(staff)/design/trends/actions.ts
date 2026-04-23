'use server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';


export async function getTrendItems(organisationId: string, filters?: {
  sourceType?: string; status?: string; showDismissed?: boolean;
}) {
  const where: Record<string, unknown> = { organisationId };
  if (filters?.sourceType && filters.sourceType !== 'ALL') where.sourceType = filters.sourceType;
  if (!filters?.showDismissed) {
    where.status = filters?.status && filters.status !== 'ALL' ? filters.status : { not: 'DISMISSED' };
  } else if (filters?.status && filters.status !== 'ALL') {
    where.status = filters.status;
  }
  return prisma.designTrendItem.findMany({
    where,
    include: {
      rssFeed: { select: { name: true } },
      submittedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ publishedAt: 'desc' }, { fetchedAt: 'desc' }],
  });
}

export async function submitTrendItem(fd: FormData) {
  const user = await requireAppUser();
  await prisma.designTrendItem.create({
    data: {
      organisationId: user.organisationId,
      title: fd.get('title') as string,
      sourceName: fd.get('sourceName') as string,
      sourceType: 'MANUAL',
      url: (fd.get('url') as string) || null,
      excerpt: (fd.get('excerpt') as string) || null,
      publishedAt: fd.get('publishedAt') ? new Date(fd.get('publishedAt') as string) : null,
      submittedById: user.id,
    },
  });
  revalidatePath('/design/trends');
}

export async function addTrendItemToSources(id: string) {
  const user = await requireAppUser();
  const item = await prisma.designTrendItem.findUniqueOrThrow({ where: { id } });
  const isAdmin = user.role === 'DIRECTOR' || user.role === 'ADMINISTRATOR';
  const config = await prisma.designExpiryConfig.findUnique({ where: { organisationId: user.organisationId } });
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + (config?.defaultExpiryMonths ?? 12));

  const source = await prisma.designSource.create({
    data: {
      organisationId: user.organisationId,
      title: item.title,
      type: 'NON_GLOBAL',
      category: 'RESEARCH_TRENDS',
      industryTag: 'ALL',
      url: item.url,
      fetchedContent: item.excerpt,
      expiryDate,
      status: isAdmin ? 'PENDING_INDEX' : 'PENDING_APPROVAL',
      submittedById: user.id,
    },
  });

  await prisma.designTrendItem.update({
    where: { id },
    data: { status: 'ADDED_TO_SOURCES', addedToSourceId: source.id },
  });
  revalidatePath('/design/trends');
  revalidatePath('/design/sources');
}

export async function dismissTrendItem(id: string) {
  await requireAppUser();
  await prisma.designTrendItem.update({ where: { id }, data: { status: 'DISMISSED' } });
  revalidatePath('/design/trends');
}

// ── RSS Feed Fetch (manual trigger) ──────────────────────────────────────────

export async function fetchRssFeed(feedId: string) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR' && user.role !== 'ADMINISTRATOR') throw new Error('Admin only');
  const feed = await prisma.designRssFeed.findUniqueOrThrow({ where: { id: feedId } });

  try {
    const res = await fetch(feed.url, { headers: { 'User-Agent': 'AgeroERP/1.0' } });
    const xml = await res.text();

    // Parse RSS items — extract <item> blocks
    const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    let created = 0;

    for (const block of itemBlocks) {
      const content = block[1];
      const title = content.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/)?.[1]
        ?? content.match(/<title>(.*?)<\/title>/)?.[1] ?? 'Untitled';
      const link = content.match(/<link>(.*?)<\/link>/)?.[1]
        ?? content.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] ?? null;
      const desc = content.match(/<description><!\[CDATA\[([\s\S]*?)\]\]>|<description>([\s\S]*?)<\/description>/)?.[1]
        ?? content.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? null;
      const pubDateStr = content.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? null;
      const pubDate = pubDateStr ? new Date(pubDateStr) : null;

      // Skip if already exists
      if (link) {
        const exists = await prisma.designTrendItem.findFirst({
          where: { organisationId: user.organisationId, url: link },
        });
        if (exists) continue;
      }

      await prisma.designTrendItem.create({
        data: {
          organisationId: user.organisationId,
          title: title.substring(0, 500),
          sourceName: feed.name,
          sourceType: 'RSS',
          url: link,
          excerpt: desc ? desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000) : null,
          publishedAt: pubDate,
          rssFeedId: feed.id,
        },
      });
      created++;
    }

    await prisma.designRssFeed.update({ where: { id: feedId }, data: { lastFetchedAt: new Date() } });
    revalidatePath('/design/trends');
    revalidatePath('/design/settings');
    return { ok: true, created };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Monitored URL Fetch (manual trigger) ──────────────────────────────────────

export async function fetchMonitoredUrl(urlId: string) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR' && user.role !== 'ADMINISTRATOR') throw new Error('Admin only');
  const mu = await prisma.designMonitoredUrl.findUniqueOrThrow({ where: { id: urlId } });

  try {
    const res = await fetch(mu.url, { headers: { 'User-Agent': 'AgeroERP/1.0' } });
    const html = await res.text();
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    // Simple hash
    let hash = 0;
    for (let i = 0; i < Math.min(text.length, 10000); i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    const contentHash = hash.toString(16);

    const changed = mu.lastContentHash !== contentHash;

    if (changed) {
      await prisma.designTrendItem.create({
        data: {
          organisationId: user.organisationId,
          title: `Updated: ${mu.name}`,
          sourceName: mu.name,
          sourceType: 'MONITORED_URL',
          url: mu.url,
          excerpt: text.substring(0, 2000),
          monitoredUrlId: mu.id,
        },
      });
    }

    await prisma.designMonitoredUrl.update({
      where: { id: urlId },
      data: { lastFetchedAt: new Date(), lastContentHash: contentHash },
    });

    revalidatePath('/design/trends');
    revalidatePath('/design/settings');
    return { ok: true, changed };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
