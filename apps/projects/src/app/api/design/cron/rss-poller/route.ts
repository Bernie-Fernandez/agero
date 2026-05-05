import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const feeds = await prisma.designRssFeed.findMany({ where: { isActive: true } });
  let totalCreated = 0;

  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, { headers: { 'User-Agent': 'AgeroERP/1.0' } });
      const xml = await res.text();
      const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

      for (const block of itemBlocks) {
        const content = block[1];
        const title = content.match(/<title><!\[CDATA\[(.*?)\]\]>/)?.[1]
          ?? content.match(/<title>(.*?)<\/title>/)?.[1] ?? 'Untitled';
        const link = content.match(/<link>(.*?)<\/link>/)?.[1]
          ?? content.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] ?? null;
        const desc = content.match(/<description><!\[CDATA\[([\s\S]*?)\]\]>/)?.[1]
          ?? content.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? null;
        const pubDateStr = content.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? null;
        const pubDate = pubDateStr ? new Date(pubDateStr) : null;

        if (link) {
          const exists = await prisma.designTrendItem.findFirst({
            where: { organisationId: feed.organisationId, url: link },
          });
          if (exists) continue;
        }

        await prisma.designTrendItem.create({
          data: {
            organisationId: feed.organisationId,
            title: title.substring(0, 500),
            sourceName: feed.name,
            sourceType: 'RSS',
            url: link,
            excerpt: desc ? desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000) : null,
            publishedAt: pubDate,
            rssFeedId: feed.id,
          },
        });
        totalCreated++;
      }

      await prisma.designRssFeed.update({ where: { id: feed.id }, data: { lastFetchedAt: new Date() } });
    } catch {
      // Continue with next feed
    }
  }

  return NextResponse.json({ ok: true, created: totalCreated });
}
