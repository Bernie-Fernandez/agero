import { NextRequest, NextResponse } from 'next/server';
import { getAppUser } from '@/lib/auth';
import { HELP_SYSTEM_PROMPT } from '@/lib/help-system-prompt';

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ reply: 'Help assistant coming soon — not yet configured.' });
  }

  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { messages?: Array<{ role: string; content: string }> };
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 });
  }

  const systemWithUser = `${HELP_SYSTEM_PROMPT}\n\nYou are currently talking to ${user.firstName} ${user.lastName} (${user.role}).`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemWithUser,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[help] Anthropic error:', err);
      return NextResponse.json({ reply: 'Help assistant is temporarily unavailable. Please try again.' });
    }

    const data = await resp.json() as { content?: Array<{ text?: string }> };
    const reply = data.content?.[0]?.text ?? 'No response received.';
    return NextResponse.json({ reply });
  } catch (e) {
    console.error('[help] fetch error:', e);
    return NextResponse.json({ reply: 'Help assistant is temporarily unavailable. Please try again.' });
  }
}
