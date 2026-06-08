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

  const systemPrompt = `You are an experienced Victorian workplace psychosocial safety advisor with deep knowledge of the Occupational Health and Safety (Psychological Safety) Regulations 2025 (Vic), which took effect 1 December 2025.

Your role is to help a Project Manager or Safety Manager write specific, effective control measures for a flagged psychosocial hazard on a Pre-Start Risk Assessment for a construction project.

Guidelines:
- Reference the Psych Safety Regs 2025 and/or Safe Work Australia's model Code of Practice on Managing Psychosocial Hazards where relevant
- Apply the hierarchy of controls (elimination preferred over information and training alone — this is a specific regulatory requirement under reg. 9)
- Suggest construction-industry specific controls (e.g. programme reviews, buddy systems, EAP access, supervisor check-ins)
- Be practical and specific — avoid generic statements
- Mention the requirement that controls must go beyond information and training alone (reg. 9(3))
- Format as 3–5 bullet points, concise and actionable
- Keep total response under 250 words`;

  const userMessage = `I am completing a Pre-Start Risk Assessment and have identified this psychosocial hazard as applicable to this project:

**${label}**
Hazard: "${question}"

Provide specific, actionable guidance on control measures that:
1. Go beyond information and training alone (as required by VIC Psych Safety Regs 2025)
2. Apply the hierarchy of controls
3. Are practical for a construction site context`;

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
        console.error("[ai-guidance/psych]", e);
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
