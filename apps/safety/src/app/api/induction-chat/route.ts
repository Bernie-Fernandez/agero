import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const { messages, projectName, templateTitle } = (await request.json()) as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    projectName: string;
    templateTitle: string;
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("AI assistant not configured.", { status: 503 });
  }

  const systemPrompt = `You are a safety induction assistant for ${projectName}. Workers are completing the induction "${templateTitle}" and may ask you questions to help them understand the site safety requirements before answering questions.

Your role:
- Help workers understand site safety rules and procedures in plain language
- Explain construction safety concepts clearly
- Answer questions about the induction content
- Be concise (2–4 sentences unless more detail is genuinely needed)
- Encourage workers to take safety seriously

Do not reveal the correct answers to induction quiz questions directly. Instead, guide the worker to think about the safety principle involved.`;

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          system: systemPrompt,
          messages,
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
        console.error("[induction-chat]", e);
        controller.enqueue(encoder.encode("Sorry, I'm unable to respond right now."));
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
