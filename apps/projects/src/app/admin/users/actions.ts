'use server';
import { prisma } from '@/lib/prisma';
import { requireDirector, requireAppUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getRolePreset } from '@agero/db';
import { createAuditLog } from '@/lib/audit';

export async function toggleUserActive(id: string, active: boolean) {
  const director = await requireDirector();
  if (id === director.id) return;
  await prisma.user.update({ where: { id }, data: { isActive: active } });
  await createAuditLog({ userId: director.id, action: active ? 'ACTIVATE' : 'DEACTIVATE', entity: 'User', entityId: id });
  revalidatePath('/admin/users');
}

export async function updateUserProfile(id: string, fd: FormData) {
  const director = await requireDirector();
  const str = (k: string) => (fd.get(k) as string) || null;
  const date = (k: string) => { const v = fd.get(k) as string; return v ? new Date(v) : null; };
  const num = (k: string) => { const v = fd.get(k) as string; return v ? parseFloat(v) : null; };
  await prisma.user.update({
    where: { id },
    data: {
      firstName: str('firstName') ?? undefined,
      lastName: str('lastName') ?? undefined,
      initials: str('initials'),
      email: str('email') ?? undefined,
      phone: str('phone'),
      mobile: str('mobile'),
      role: (str('role') as never) ?? undefined,
      isActive: fd.get('isActive') === 'true',
      employmentType: (str('employmentType') as never),
      startDate: date('startDate'),
      normalRate: num('normalRate'),
      overtimeRate: num('overtimeRate'),
      contractReviewDate: date('contractReviewDate'),
      probationEndDate: date('probationEndDate'),
      hrNotes: str('hrNotes'),
      safetyInductionNo: str('safetyInductionNo'),
      safetyLevel: str('safetyLevel'),
      safetyExpiry: date('safetyExpiry'),
      licenceNo: str('licenceNo'),
      licenceType: str('licenceType'),
      licenceExpiry: date('licenceExpiry'),
      whiteCardNo: str('whiteCardNo'),
      whiteCardExpiry: date('whiteCardExpiry'),
      nokName: str('nokName'),
      nokRelationship: str('nokRelationship'),
      nokPhone: str('nokPhone'),
      nok2Name: str('nok2Name'),
      nok2Relationship: str('nok2Relationship'),
      nok2Phone: str('nok2Phone'),
      medicalNotes: str('medicalNotes'),
    },
  });
  await createAuditLog({ userId: director.id, action: 'UPDATE', entity: 'User', entityId: id });
  revalidatePath(`/admin/users/${id}`);
  revalidatePath('/admin/users');
}

export async function updateUserPermissions(id: string, fd: FormData) {
  const director = await requireDirector();
  const modules: Record<string, string> = {};
  const maf: Record<string, { state: string; limit: number }> = {};
  const MODULE_KEYS = ['admin','finance','estimating','crm','delivery','safety','marketing'];
  const MAF_KEYS = ['subcontract_award','supplier_order','subcontract_variation','subcontract_claim','client_variation','head_contract','tender_submission'];
  for (const k of MODULE_KEYS) { const v = fd.get(`module_${k}`) as string; if (v) modules[k] = v; }
  for (const k of MAF_KEYS) {
    const state = fd.get(`maf_${k}_state`) as string;
    const limit = parseInt(fd.get(`maf_${k}_limit`) as string || '0', 10);
    if (state) maf[k] = { state, limit };
  }
  await prisma.user.update({ where: { id }, data: { permissions: { modules, maf } } });
  await createAuditLog({ userId: director.id, action: 'UPDATE_PERMISSIONS', entity: 'User', entityId: id });
  revalidatePath(`/admin/users/${id}`);
}

export async function resetToRolePreset(id: string) {
  const director = await requireDirector();
  const user = await prisma.user.findUniqueOrThrow({ where: { id }, select: { role: true } });
  const preset = getRolePreset(user.role);
  await prisma.user.update({ where: { id }, data: { permissions: preset as never } });
  await createAuditLog({ userId: director.id, action: 'RESET_PERMISSIONS', entity: 'User', entityId: id });
  revalidatePath(`/admin/users/${id}`);
}

export async function createUser(fd: FormData) {
  const director = await requireDirector();
  const role = fd.get('role') as string;
  const preset = getRolePreset(role);
  const user = await prisma.user.create({
    data: {
      organisationId: director.organisationId,
      clerkId: `pending_${Date.now()}`,
      firstName: fd.get('firstName') as string,
      lastName: fd.get('lastName') as string,
      email: fd.get('email') as string,
      role: role as never,
      employmentType: (fd.get('employmentType') as never) || null,
      isActive: true,
      permissions: preset as never,
    },
  });
  await createAuditLog({ userId: director.id, action: 'CREATE', entity: 'User', entityId: user.id });
  revalidatePath('/admin/users');
  return user.id;
}

export async function addTrainingRecord(userId: string, fd: FormData) {
  await requireDirector();
  const str = (k: string) => (fd.get(k) as string) || null;
  const date = (k: string) => { const v = fd.get(k) as string; return v ? new Date(v) : null; };
  await prisma.userTraining.create({
    data: { userId, trainingName: fd.get('trainingName') as string, completedDate: date('completedDate'), expiryDate: date('expiryDate'), notes: str('notes') },
  });
  revalidatePath(`/admin/users/${userId}`);
}

export async function deleteTrainingRecord(trainingId: string, userId: string) {
  await requireDirector();
  await prisma.userTraining.delete({ where: { id: trainingId } });
  revalidatePath(`/admin/users/${userId}`);
}

export async function updateMyProfile(fd: FormData) {
  const user = await requireAppUser();
  const str = (k: string) => (fd.get(k) as string) || null;
  const date = (k: string) => { const v = fd.get(k) as string; return v ? new Date(v) : null; };
  await prisma.user.update({
    where: { id: user.id },
    data: {
      firstName: str('firstName') ?? undefined,
      lastName: str('lastName') ?? undefined,
      initials: str('initials'),
      phone: str('phone'),
      mobile: str('mobile'),
      safetyInductionNo: str('safetyInductionNo'),
      safetyLevel: str('safetyLevel'),
      safetyExpiry: date('safetyExpiry'),
      licenceNo: str('licenceNo'),
      licenceType: str('licenceType'),
      licenceExpiry: date('licenceExpiry'),
      whiteCardNo: str('whiteCardNo'),
      whiteCardExpiry: date('whiteCardExpiry'),
      nokName: str('nokName'),
      nokRelationship: str('nokRelationship'),
      nokPhone: str('nokPhone'),
      nok2Name: str('nok2Name'),
      nok2Relationship: str('nok2Relationship'),
      nok2Phone: str('nok2Phone'),
    },
  });
  revalidatePath('/profile');
}
