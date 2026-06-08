import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const { label, question } = (await request.json()) as {
    label: string;
    question: string;
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("AI guidance not configured.", { status: 503 });
  }

  const systemPrompt = `You are an experienced Victorian construction safety advisor with deep knowledge of the Occupational Health and Safety Regulations 2017 (Vic), specifically Schedule 1 — High Risk Construction Work (HRCW).

Your role is to help a Project Manager or Safety Manager write specific, effective control measures for a flagged HRCW item on a Pre-Start Risk Assessment.

Guidelines:
- Reference specific regulations or codes of practice where relevant (e.g. "OHS Regs 2017 r.5.1.14", "Code of Practice: Safe Work on Roofs")
- Suggest concrete, site-specific controls using the hierarchy of controls
- Cover Safe Work Method Statement (SWMS) requirements (mandatory for HRCW under reg. 5.1.16)
- Be practical and specific — avoid generic statements
- Format as 3–5 bullet points, concise and actionable
- Keep total response under 250 words`;

  const userMessage = `I am completing a Pre-Start Risk Assessment and have flagged this High Risk Work classification as applicable:

**${label}**
Assessment question: "${question}"

Provide specific, actionable guidance on:
1. Key control measures to document
2. SWMS and licensing requirements
3. Any specific Victorian regulatory obligations for this HRW type`;

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
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
        console.error("[ai-guidance/hrw]", e);
        controller.enqueue(encoder.encode("Unable to generate guidance right now. Please consult your Safety Manager."));
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
