import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // Expire sources past their expiry date
  const expired = await prisma.designSource.updateMany({
    where: { expiryDate: { lt: now }, status: { not: 'EXPIRED' } },
    data: { status: 'EXPIRED', isActive: false },
  });

  // Flag sources expiring within reminder window
  const configs = await prisma.designExpiryConfig.findMany();
  let reminded = 0;

  for (const config of configs) {
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + config.reminderDaysBefore);

    const result = await prisma.designSource.updateMany({
      where: {
        organisationId: config.organisationId,
        expiryDate: { lte: reminderDate, gte: now },
        expiryReminderSent: false,
        status: { not: 'EXPIRED' },
      },
      data: { expiryReminderSent: true },
    });
    reminded += result.count;
  }

  return NextResponse.json({ ok: true, expired: expired.count, reminded });
}
