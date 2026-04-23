'use server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import Anthropic from '@anthropic-ai/sdk';


const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function getChatbotSessions() {
  const user = await requireAppUser();
  const isAdmin = user.role === 'DIRECTOR' || user.role === 'ADMINISTRATOR';
  return prisma.designChatbotSession.findMany({
    where: isAdmin ? { organisationId: user.organisationId } : { userId: user.id },
    include: {
      user: { select: { firstName: true, lastName: true } },
      source: { select: { id: true, title: true } },
    },
    orderBy: { startedAt: 'desc' },
  });
}

export async function getChatbotSession(id: string) {
  const user = await requireAppUser();
  const isAdmin = user.role === 'DIRECTOR' || user.role === 'ADMINISTRATOR';
  const session = await prisma.designChatbotSession.findUniqueOrThrow({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      user: { select: { firstName: true, lastName: true } },
      source: { select: { id: true, title: true } },
    },
  });
  if (!isAdmin && session.userId !== user.id) throw new Error('Unauthorized');
  return session;
}

export async function createChatbotSession() {
  const user = await requireAppUser();
  const session = await prisma.designChatbotSession.create({
    data: {
      organisationId: user.organisationId,
      userId: user.id,
    },
  });
  revalidatePath('/design/chatbot');
  return session.id;
}

export async function sendChatbotMessage(sessionId: string, content: string) {
  const user = await requireAppUser();
  const session = await prisma.designChatbotSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (session.userId !== user.id) throw new Error('Unauthorized');

  // Save user message
  await prisma.designChatbotMessage.create({
    data: { sessionId, role: 'USER', content },
  });

  // Build message history for Claude
  const history = session.messages.map((m) => ({
    role: m.role === 'USER' ? 'user' as const : 'assistant' as const,
    content: m.content,
  }));
  history.push({ role: 'user', content });

  const systemPrompt = `You are the Agero Design Studio AI assistant. You help the team at Agero Group, a commercial construction and fit-out company, build a proprietary knowledge base about office and commercial fit-out design.

Your role is to:
- Have structured, informative conversations about design principles, past projects, client briefs, and space planning
- Help document design preferences, space ratios, adjacency rules, and compliance requirements
- Ask clarifying questions to extract valuable knowledge
- Be concise but thorough — every response becomes part of the knowledge base

Always respond in a helpful, professional tone appropriate for a construction and design ERP system.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: history,
  });

  const assistantContent = response.content[0].type === 'text' ? response.content[0].text : '';

  // Save assistant message
  await prisma.designChatbotMessage.create({
    data: { sessionId, role: 'ASSISTANT', content: assistantContent },
  });

  revalidatePath(`/design/chatbot/${sessionId}`);
  return assistantContent;
}

export async function endChatbotSession(sessionId: string) {
  const user = await requireAppUser();
  const session = await prisma.designChatbotSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (session.userId !== user.id) throw new Error('Unauthorized');
  if (session.endedAt) return; // Already ended

  if (session.messages.length === 0) {
    await prisma.designChatbotSession.update({ where: { id: sessionId }, data: { endedAt: new Date() } });
    revalidatePath('/design/chatbot');
    return;
  }

  // Generate summary via Claude
  const transcript = session.messages
    .map((m) => `${m.role === 'USER' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const summaryResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Summarise this design knowledge conversation in 2-3 sentences, capturing the key design insights, decisions, or information discussed. This summary will be saved as a knowledge base entry.\n\n${transcript}`,
    }],
  });

  const summary = summaryResponse.content[0].type === 'text' ? summaryResponse.content[0].text : 'Session summary';
  const title = summary.split('.')[0].substring(0, 100) || 'Design Studio Chat Session';

  const config = await prisma.designExpiryConfig.findUnique({ where: { organisationId: user.organisationId } });
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + (config?.defaultExpiryMonths ?? 12));

  const source = await prisma.designSource.create({
    data: {
      organisationId: user.organisationId,
      title,
      type: 'NON_GLOBAL',
      category: 'CHATBOT_LEARNING',
      industryTag: 'ALL',
      fetchedContent: transcript,
      notes: summary,
      expiryDate,
      status: 'INDEXED',
      submittedById: user.id,
      approvedById: user.id,
      approvedAt: new Date(),
    },
  });

  await prisma.designChatbotSession.update({
    where: { id: sessionId },
    data: { endedAt: new Date(), summary, title, sourceId: source.id },
  });

  revalidatePath('/design/chatbot');
  revalidatePath(`/design/chatbot/${sessionId}`);
  revalidatePath('/design/sources');
}
