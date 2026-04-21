'use server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function createHazard(fd: FormData) {
  const user = await requireAppUser();
  const likePre = fd.get('likelihoodPre') ? Number(fd.get('likelihoodPre')) : null;
  const consPre = fd.get('consequencePre') ? Number(fd.get('consequencePre')) : null;
  const likePost = fd.get('likelihoodPost') ? Number(fd.get('likelihoodPost')) : null;
  const consPost = fd.get('consequencePost') ? Number(fd.get('consequencePost')) : null;

  await prisma.hazard.create({
    data: {
      organisationId: user.organisationId,
      title: fd.get('title') as string,
      description: (fd.get('description') as string) || null,
      location: (fd.get('location') as string) || null,
      controls: (fd.get('controls') as string) || null,
      status: 'OPEN',
      likelihoodPre: likePre,
      consequencePre: consPre,
      likelihoodPost: likePost,
      consequencePost: consPost,
      raisedById: user.id,
      projectId: (fd.get('projectId') as string) || null,
    },
  });
  revalidatePath('/hazards');
}
