import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/auth";
import { ROLE_METADATA } from "@agero/db";
import Link from "next/link";
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

  return <UsersListClient users={users as never} />;
}
