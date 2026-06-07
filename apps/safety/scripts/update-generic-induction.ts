import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

const TEMPLATE_ID = "85f14161-7527-44ed-bfd8-be64ef668924";

async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("No connection string");

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as never);

  const template = await (prisma as any).inductionTemplate.findUnique({
    where: { id: TEMPLATE_ID },
    select: { questions: true, version: true },
  });

  if (!template) throw new Error("Template not found");

  const questions = template.questions as Array<{
    question: string;
    options: string[];
    correctAnswers?: number[];
    correctAnswer?: number;
  }>;

  // Step 3 — Q8: capitalise NOT
  questions[7].question = "If a fire alarm sounds, which action is NOT correct?";

  // Step 3 — Q10: add DRSABCD framework reference
  questions[9].question =
    "You arrive first at an accident scene before the first aider. What is your first priority? (Per the DRSABCD framework)";

  // Step 4 — Add right-to-stop-work question after Q10, before declaration
  const rightToStopWork = {
    question:
      "Under the Victorian Occupational Health and Safety Act 2004, you have the right to stop work and leave an area if you believe there is an immediate risk to your health or safety — without fear of being penalised or dismissed for doing so. You must notify your supervisor as soon as it is safe to do so.\n\nTrue or False: You can be disciplined for stopping work if you genuinely believed the situation was unsafe.",
    options: ["True", "False"],
    correctAnswers: [1], // False (0-indexed: option index 1)
  };
  questions.push(rightToStopWork);

  await (prisma as any).inductionTemplate.update({
    where: { id: TEMPLATE_ID },
    data: { questions: questions as object[] },
  });

  console.log(`✓ Template ${TEMPLATE_ID} updated (v${template.version})`);
  console.log(`  Q8 → ${questions[7].question}`);
  console.log(`  Q10 → ${questions[9].question}`);
  console.log(`  Q11 (new) → Right to stop work added. Correct answer: False`);
  console.log(`  Total questions: ${questions.length}`);

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
