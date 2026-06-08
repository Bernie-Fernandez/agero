import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { signInVisitor } from "../actions";
import { VisitorSignInForm } from "./visitor-sign-in-form";

export default async function VisitorSignInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id },
    select: { id: true, name: true, address: true },
  });
  if (!safetyProject) notFound();

  return (
    <VisitorSignInForm
      projectName={`${safetyProject.name}${safetyProject.address ? ` · ${safetyProject.address}` : ""}`}
      submitAction={signInVisitor.bind(null, id)}
    />
  );
}
