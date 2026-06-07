import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("No connection string");

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as never);

  const template = await (prisma as any).inductionTemplate.findUnique({
    where: { id: "85f14161-7527-44ed-bfd8-be64ef668924" },
    select: { questions: true, version: true, title: true },
  });

  console.log(`Template: ${template.title} v${template.version}`);
  const questions = template.questions as Array<{ question: string; options: string[]; correctAnswers?: number[] }>;
  questions.forEach((q, i) => {
    console.log(`\nQ${i + 1}: ${q.question}`);
    q.options.forEach((o, j) => console.log(`  ${j + 1}. ${o}`));
    if (q.correctAnswers) console.log(`  Correct: ${q.correctAnswers.map(a => a + 1).join(", ")}`);
  });

  await pool.end();
}

main().catch(console.error);
