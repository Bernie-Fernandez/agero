'use server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function createPermit(fd: FormData) {
  const user = await requireAppUser();
  await prisma.permit.create({
    data: {
      organisationId: user.organisationId,
      permitType: fd.get('permitType') as string,
      title: fd.get('title') as string,
      description: (fd.get('description') as string) || null,
      startDate: new Date(fd.get('startDate') as string),
      endDate: new Date(fd.get('endDate') as string),
      status: 'ACTIVE',
      issuedById: user.id,
      projectId: (fd.get('projectId') as string) || null,
    },
  });
  revalidatePath('/permits');
}
