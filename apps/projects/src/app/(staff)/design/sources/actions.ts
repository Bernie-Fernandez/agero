'use server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { createStorageAdminClient } from '@/lib/supabase/server';


async function getExpiryDate(organisationId: string): Promise<Date> {
  const config = await prisma.designExpiryConfig.findUnique({ where: { organisationId } });
  const d = new Date();
  d.setMonth(d.getMonth() + (config?.defaultExpiryMonths ?? 12));
  return d;
}

export async function getSources(organisationId: string, filters?: {
  type?: string; category?: string; industryTag?: string; status?: string; expiringSoon?: boolean;
}) {
  const where: Record<string, unknown> = { organisationId };
  if (filters?.type && filters.type !== 'ALL') where.type = filters.type;
  if (filters?.category && filters.category !== 'ALL') where.category = filters.category;
  if (filters?.industryTag && filters.industryTag !== 'ALL') where.industryTag = filters.industryTag;
  if (filters?.status && filters.status !== 'ALL') where.status = filters.status;
  if (filters?.expiringSoon) {
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    where.expiryDate = { lte: in30 };
  }
  return prisma.designSource.findMany({
    where,
    include: {
      submittedBy: { select: { firstName: true, lastName: true } },
      approvedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getSource(id: string) {
  return prisma.designSource.findUnique({
    where: { id },
    include: {
      submittedBy: { select: { firstName: true, lastName: true } },
      approvedBy: { select: { firstName: true, lastName: true } },
      versions: {
        include: { changedBy: { select: { firstName: true, lastName: true } } },
        orderBy: { versionNumber: 'desc' },
      },
    },
  });
}

export async function createSourceFromFile(fd: FormData) {
  const user = await requireAppUser();
  const file = fd.get('file') as File | null;
  const isAdmin = user.role === 'DIRECTOR' || user.role === 'ADMINISTRATOR';
  const expiryDate = await getExpiryDate(user.organisationId);

  let filePath: string | null = null;
  let fileType: 'PDF' | 'DOCX' | null = null;

  if (file && file.size > 0) {
    const storage = createStorageAdminClient();
    const ext = file.name.split('.').pop()?.toLowerCase();
    fileType = ext === 'pdf' ? 'PDF' : 'DOCX';
    const path = `design/sources/${user.organisationId}/${Date.now()}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error } = await storage.from('agero-docs').upload(path, arrayBuffer, {
      contentType: file.type,
    });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    filePath = path;
  }

  await prisma.designSource.create({
    data: {
      organisationId: user.organisationId,
      title: fd.get('title') as string,
      type: (fd.get('type') as 'GLOBAL' | 'NON_GLOBAL') ?? 'NON_GLOBAL',
      category: (fd.get('category') as string) as never,
      industryTag: ((fd.get('industryTag') as string) ?? 'ALL') as never,
      filePath,
      fileType,
      notes: (fd.get('notes') as string) || null,
      expiryDate,
      status: isAdmin ? 'PENDING_INDEX' : 'PENDING_APPROVAL',
      submittedById: user.id,
    },
  });
  revalidatePath('/design/sources');
}

export async function createSourceFromUrl(fd: FormData) {
  const user = await requireAppUser();
  const url = fd.get('url') as string;
  const isAdmin = user.role === 'DIRECTOR' || user.role === 'ADMINISTRATOR';
  const expiryDate = await getExpiryDate(user.organisationId);

  let fetchedContent: string | null = null;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'AgeroERP/1.0' } });
    const html = await res.text();
    // Strip HTML tags for plain text storage
    fetchedContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 50000);
  } catch {
    // Store source even if fetch fails — admin can re-index
  }

  await prisma.designSource.create({
    data: {
      organisationId: user.organisationId,
      title: fd.get('title') as string,
      type: (fd.get('type') as 'GLOBAL' | 'NON_GLOBAL') ?? 'NON_GLOBAL',
      category: (fd.get('category') as string) as never,
      industryTag: ((fd.get('industryTag') as string) ?? 'ALL') as never,
      url,
      fetchedContent,
      notes: (fd.get('notes') as string) || null,
      expiryDate,
      status: fetchedContent ? (isAdmin ? 'INDEXED' : 'PENDING_APPROVAL') : (isAdmin ? 'FAILED' : 'PENDING_APPROVAL'),
      submittedById: user.id,
    },
  });
  revalidatePath('/design/sources');
}

export async function updateSource(id: string, fd: FormData) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR' && user.role !== 'ADMINISTRATOR') throw new Error('Admin only');
  const existing = await prisma.designSource.findUniqueOrThrow({ where: { id } });

  // Create version snapshot before update
  await prisma.designSourceVersion.create({
    data: {
      sourceId: id,
      versionNumber: existing.versionNumber,
      title: existing.title,
      notes: existing.notes,
      filePath: existing.filePath,
      url: existing.url,
      isActive: existing.isActive,
      changeSummary: (fd.get('changeSummary') as string) || 'Updated by admin',
      changedById: user.id,
    },
  });

  await prisma.designSource.update({
    where: { id },
    data: {
      title: (fd.get('title') as string) || existing.title,
      type: ((fd.get('type') as string) || existing.type) as never,
      category: ((fd.get('category') as string) || existing.category) as never,
      industryTag: ((fd.get('industryTag') as string) || existing.industryTag) as never,
      notes: (fd.get('notes') as string) || existing.notes,
      expiryDate: fd.get('expiryDate') ? new Date(fd.get('expiryDate') as string) : existing.expiryDate,
      versionNumber: existing.versionNumber + 1,
    },
  });
  revalidatePath(`/design/sources/${id}`);
  revalidatePath('/design/sources');
}

export async function approveSource(id: string) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR' && user.role !== 'ADMINISTRATOR') throw new Error('Admin only');
  await prisma.designSource.update({
    where: { id },
    data: { status: 'PENDING_INDEX', approvedById: user.id, approvedAt: new Date() },
  });
  revalidatePath(`/design/sources/${id}`);
  revalidatePath('/design/sources');
}

export async function rejectSource(id: string, reason: string) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR' && user.role !== 'ADMINISTRATOR') throw new Error('Admin only');
  await prisma.designSource.update({
    where: { id },
    data: { status: 'FAILED', rejectionReason: reason },
  });
  revalidatePath(`/design/sources/${id}`);
  revalidatePath('/design/sources');
}

export async function toggleSourceActive(id: string, isActive: boolean) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR' && user.role !== 'ADMINISTRATOR') throw new Error('Admin only');
  await prisma.designSource.update({ where: { id }, data: { isActive } });
  revalidatePath(`/design/sources/${id}`);
  revalidatePath('/design/sources');
}

export async function renewSourceExpiry(id: string) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR' && user.role !== 'ADMINISTRATOR') throw new Error('Admin only');
  const source = await prisma.designSource.findUniqueOrThrow({ where: { id } });
  const expiryDate = await getExpiryDate(source.organisationId);
  await prisma.designSource.update({
    where: { id },
    data: { expiryDate, expiryReminderSent: false, status: source.status === 'EXPIRED' ? 'PENDING_INDEX' : source.status },
  });
  revalidatePath(`/design/sources/${id}`);
  revalidatePath('/design/sources');
}

export async function reindexSource(id: string) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR' && user.role !== 'ADMINISTRATOR') throw new Error('Admin only');
  const source = await prisma.designSource.findUniqueOrThrow({ where: { id } });

  if (source.url) {
    try {
      const res = await fetch(source.url, { headers: { 'User-Agent': 'AgeroERP/1.0' } });
      const html = await res.text();
      const content = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 50000);
      await prisma.designSource.update({ where: { id }, data: { fetchedContent: content, status: 'INDEXED' } });
    } catch {
      await prisma.designSource.update({ where: { id }, data: { status: 'FAILED' } });
    }
  } else {
    await prisma.designSource.update({ where: { id }, data: { status: 'PENDING_INDEX' } });
  }
  revalidatePath(`/design/sources/${id}`);
}

export async function deleteSource(id: string) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR' && user.role !== 'ADMINISTRATOR') throw new Error('Admin only');
  await prisma.designSource.delete({ where: { id } });
  revalidatePath('/design/sources');
}
