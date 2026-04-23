import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const urls = await prisma.designMonitoredUrl.findMany({
    where: { isActive: true, fetchSchedule: { in: ['DAILY', 'WEEKLY'] } },
  });

  let totalCreated = 0;

  for (const mu of urls) {
    try {
      const res = await fetch(mu.url, { headers: { 'User-Agent': 'AgeroERP/1.0' } });
      const html = await res.text();
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      let hash = 0;
      for (let i = 0; i < Math.min(text.length, 10000); i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
      const contentHash = hash.toString(16);

      if (mu.lastContentHash !== contentHash) {
        await prisma.designTrendItem.create({
          data: {
            organisationId: mu.organisationId,
            title: `Updated: ${mu.name}`,
            sourceName: mu.name,
            sourceType: 'MONITORED_URL',
            url: mu.url,
            excerpt: text.substring(0, 2000),
            monitoredUrlId: mu.id,
          },
        });
        totalCreated++;
      }

      await prisma.designMonitoredUrl.update({
        where: { id: mu.id },
        data: { lastFetchedAt: new Date(), lastContentHash: contentHash },
      });
    } catch {
      // Continue with next URL
    }
  }

  return NextResponse.json({ ok: true, created: totalCreated });
}
