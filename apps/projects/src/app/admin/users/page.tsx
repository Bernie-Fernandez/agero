import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/auth";
import { ROLE_METADATA, getRolePreset } from "@agero/db";
import UsersListClient from "./UsersListClient";

export default async function UsersPage() {
  await requireDirector();

  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      mobile: true,
      phone: true,
      role: true,
      isActive: true,
      avatarUrl: true,
      initials: true,
      employmentType: true,
      gmailConnected: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const roles = Object.entries(ROLE_METADATA).map(([value, meta]) => ({
    value,
    label: meta.label,
    tier: meta.tier,
    stream: meta.stream,
  }));

  const allPresets: Record<string, { modules: Record<string, string>; maf: Record<string, { state: string; limit: number }> }> = {};
  for (const { value } of roles) {
    allPresets[value] = getRolePreset(value) as { modules: Record<string, string>; maf: Record<string, { state: string; limit: number }> };
  }

  return <UsersListClient users={users as never} roles={roles} allPresets={allPresets} />;
}
