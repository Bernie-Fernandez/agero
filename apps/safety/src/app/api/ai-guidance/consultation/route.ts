import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const { role, hrwItems, psychItems } = (await request.json()) as {
    role: string;
    hrwItems: string[];
    psychItems: string[];
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("AI guidance not configured.", { status: 503 });
  }

  const hazardContext = [
    ...hrwItems.map((h) => `• HRW: ${h}`),
    ...psychItems.map((p) => `• Psychosocial: ${p}`),
  ].join("\n");

  const systemPrompt = `You are a Victorian construction safety advisor helping a Safety Manager document consultation records for a Pre-Start Risk Assessment under the OHS Act 2004 (Vic) Section 35 consultation obligations.

Your task is to suggest specific, relevant points that should be raised with a consultee — based on their role and the identified hazards on the project. Be concise and practical. Format as 3–4 bullet points.`;

  const userMessage = `I am consulting with: **${role || "a site representative"}**

The following hazards have been identified on this project:
${hazardContext || "• No specific hazards flagged yet"}

What specific issues, concerns, or matters should be raised with this person during consultation?`;

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 384,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        });
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (e) {
        console.error("[ai-guidance/consultation]", e);
        controller.enqueue(encoder.encode("Unable to generate suggestions right now."));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
