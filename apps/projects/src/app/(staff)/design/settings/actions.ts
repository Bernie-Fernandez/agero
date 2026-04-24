'use server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function getDesignPendingApprovalCount(): Promise<number> {
  try {
    const user = await requireAppUser();
    return prisma.designSettingNonGlobalProposal.count({
      where: { organisationId: user.organisationId, status: 'PENDING' },
    });
  } catch {
    return 0;
  }
}

export async function getDesignExpiryConfig(organisationId: string) {
  return prisma.designExpiryConfig.findUnique({ where: { organisationId } });
}

// ── Global Settings ───────────────────────────────────────────────────────────

export async function getGlobalSettings(organisationId: string) {
  return prisma.designSettingGlobal.findMany({
    where: { organisationId },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
    orderBy: [{ category: 'asc' }, { label: 'asc' }],
  });
}

export async function createGlobalSetting(fd: FormData) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') throw new Error('Admin only');
  await prisma.designSettingGlobal.create({
    data: {
      organisationId: user.organisationId,
      key: fd.get('key') as string,
      label: fd.get('label') as string,
      value: fd.get('value') as string,
      description: (fd.get('description') as string) || null,
      category: fd.get('category') as string,
      createdById: user.id,
    },
  });
  revalidatePath('/design/settings');
}

export async function updateGlobalSetting(id: string, fd: FormData) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') throw new Error('Admin only');
  const existing = await prisma.designSettingGlobal.findUniqueOrThrow({ where: { id } });
  const newValue = fd.get('value') as string;
  const reason = (fd.get('reason') as string) || '';
  await prisma.$transaction([
    prisma.designSettingGlobalAudit.create({
      data: {
        settingId: id,
        previousValue: existing.value,
        newValue,
        reason,
        changedById: user.id,
      },
    }),
    prisma.designSettingGlobal.update({
      where: { id },
      data: {
        value: newValue,
        label: (fd.get('label') as string) || existing.label,
        description: (fd.get('description') as string) || existing.description,
        category: (fd.get('category') as string) || existing.category,
      },
    }),
  ]);
  revalidatePath('/design/settings');
}

export async function deleteGlobalSetting(id: string) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') throw new Error('Admin only');
  await prisma.designSettingGlobal.delete({ where: { id } });
  revalidatePath('/design/settings');
}

export async function getGlobalSettingAuditLog(settingId: string) {
  return prisma.designSettingGlobalAudit.findMany({
    where: { settingId },
    include: { changedBy: { select: { firstName: true, lastName: true } } },
    orderBy: { changedAt: 'desc' },
  });
}

// ── Non-Global Settings ───────────────────────────────────────────────────────

export async function getNonGlobalSettings(organisationId: string) {
  return prisma.designSettingNonGlobal.findMany({
    where: { organisationId, status: 'ACTIVE' },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
    orderBy: [{ category: 'asc' }, { label: 'asc' }],
  });
}

export async function proposeNonGlobalSetting(fd: FormData) {
  const user = await requireAppUser();
  await prisma.designSettingNonGlobalProposal.create({
    data: {
      settingId: (fd.get('settingId') as string) || null,
      organisationId: user.organisationId,
      proposedKey: fd.get('proposedKey') as string,
      proposedLabel: fd.get('proposedLabel') as string,
      proposedValue: fd.get('proposedValue') as string,
      reason: (fd.get('reason') as string) || null,
      proposedById: user.id,
    },
  });
  revalidatePath('/design/settings');
}

export async function getPendingProposals(organisationId: string) {
  return prisma.designSettingNonGlobalProposal.findMany({
    where: { organisationId, status: 'PENDING' },
    include: {
      proposedBy: { select: { firstName: true, lastName: true } },
      setting: { select: { key: true, label: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function approveProposal(id: string) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') throw new Error('Admin only');
  const proposal = await prisma.designSettingNonGlobalProposal.findUniqueOrThrow({ where: { id } });

  await prisma.$transaction(async (tx) => {
    if (proposal.settingId) {
      await tx.designSettingNonGlobal.update({
        where: { id: proposal.settingId },
        data: { value: proposal.proposedValue, label: proposal.proposedLabel },
      });
    } else {
      await tx.designSettingNonGlobal.create({
        data: {
          organisationId: proposal.organisationId,
          key: proposal.proposedKey,
          label: proposal.proposedLabel,
          value: proposal.proposedValue,
          category: 'General',
          createdById: proposal.proposedById,
        },
      });
    }
    await tx.designSettingNonGlobalProposal.update({
      where: { id },
      data: { status: 'APPROVED', reviewedById: user.id, reviewedAt: new Date() },
    });
  });
  revalidatePath('/design/settings');
  revalidatePath('/design/settings/approvals');
}

export async function rejectProposal(id: string, reason: string) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') throw new Error('Admin only');
  await prisma.designSettingNonGlobalProposal.update({
    where: { id },
    data: { status: 'REJECTED', reviewedById: user.id, reviewedAt: new Date(), rejectionReason: reason },
  });
  revalidatePath('/design/settings');
  revalidatePath('/design/settings/approvals');
}

// ── Expiry Config ─────────────────────────────────────────────────────────────

export async function updateExpiryConfig(fd: FormData) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') throw new Error('Admin only');
  await prisma.designExpiryConfig.upsert({
    where: { organisationId: user.organisationId },
    create: {
      organisationId: user.organisationId,
      defaultExpiryMonths: Number(fd.get('defaultExpiryMonths')),
      reminderDaysBefore: Number(fd.get('reminderDaysBefore')),
      updatedById: user.id,
    },
    update: {
      defaultExpiryMonths: Number(fd.get('defaultExpiryMonths')),
      reminderDaysBefore: Number(fd.get('reminderDaysBefore')),
      updatedById: user.id,
    },
  });
  revalidatePath('/design/settings');
}

// ── RSS Feeds ─────────────────────────────────────────────────────────────────

const DEFAULT_RSS_FEEDS = [
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

export async function seedDefaultRssFeeds() {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') throw new Error('Admin only');
  let created = 0;
  for (const feed of DEFAULT_RSS_FEEDS) {
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
  revalidatePath('/design/settings');
  return created;
}

export async function getRssFeeds(organisationId: string) {
  return prisma.designRssFeed.findMany({
    where: { organisationId },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function createRssFeed(fd: FormData) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') throw new Error('Admin only');
  await prisma.designRssFeed.create({
    data: {
      organisationId: user.organisationId,
      name: fd.get('name') as string,
      url: fd.get('url') as string,
      createdById: user.id,
    },
  });
  revalidatePath('/design/settings');
}

export async function updateRssFeed(id: string, fd: FormData) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') throw new Error('Admin only');
  await prisma.designRssFeed.update({
    where: { id },
    data: {
      name: fd.get('name') as string,
      url: fd.get('url') as string,
      isActive: fd.get('isActive') === 'true',
    },
  });
  revalidatePath('/design/settings');
}

export async function deleteRssFeed(id: string) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') throw new Error('Admin only');
  await prisma.designRssFeed.delete({ where: { id } });
  revalidatePath('/design/settings');
}

export async function toggleRssFeed(id: string, isActive: boolean) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') throw new Error('Admin only');
  await prisma.designRssFeed.update({ where: { id }, data: { isActive } });
  revalidatePath('/design/settings');
}

// ── Monitored URLs ────────────────────────────────────────────────────────────

export async function getMonitoredUrls(organisationId: string) {
  return prisma.designMonitoredUrl.findMany({
    where: { organisationId },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function createMonitoredUrl(fd: FormData) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') throw new Error('Admin only');
  await prisma.designMonitoredUrl.create({
    data: {
      organisationId: user.organisationId,
      name: fd.get('name') as string,
      url: fd.get('url') as string,
      fetchSchedule: (fd.get('fetchSchedule') as 'MANUAL' | 'DAILY' | 'WEEKLY') ?? 'DAILY',
      createdById: user.id,
    },
  });
  revalidatePath('/design/settings');
}

export async function deleteMonitoredUrl(id: string) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') throw new Error('Admin only');
  await prisma.designMonitoredUrl.delete({ where: { id } });
  revalidatePath('/design/settings');
}
