import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ExpiryExtractionResult = {
  expiry_date: string | null;
  confidence: "high" | "medium" | "low";
  found: boolean;
};

export type SwmsCriterionResult = {
  result: "pass" | "fail" | "na";
  comment: string;
};

export type SwmsReviewResult = {
  criteria: {
    site_specific_details: SwmsCriterionResult;
    contractor_details: SwmsCriterionResult;
    responsible_person: SwmsCriterionResult;
    scope_of_work: SwmsCriterionResult;
    competencies_training: SwmsCriterionResult;
    steps_tasks: SwmsCriterionResult;
    hazards_risks: SwmsCriterionResult;
    control_measures: SwmsCriterionResult;
    legislation_references: SwmsCriterionResult;
    emergency_procedures: SwmsCriterionResult;
    plant_equipment: SwmsCriterionResult;
    ppe_requirements: SwmsCriterionResult;
    chemicals_msds: SwmsCriterionResult;
    worker_signatures: SwmsCriterionResult;
  };
  overall_recommendation: "approve" | "reject";
  summary_comments: string;
  pass_count: number;
  fail_count: number;
  na_count: number;
};

/**
 * Extract expiry date from an insurance/compliance document.
 * fileBase64 should be the raw base64 string (no data: prefix).
 * mediaType is the MIME type of the file.
 */
export async function extractExpiryDate(
  fileBase64: string,
  mediaType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp",
): Promise<ExpiryExtractionResult> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: mediaType,
              data: fileBase64,
            },
          } as Anthropic.DocumentBlockParam,
          {
            type: "text",
            text: 'This is an insurance certificate or compliance document. Extract the expiry date or period of insurance end date. Return ONLY a JSON object: {"expiry_date": "DD/MM/YYYY", "confidence": "high|medium|low", "found": true|false}. If no expiry date is found, return {"expiry_date": null, "confidence": "low", "found": false}.',
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { expiry_date: null, confidence: "low", found: false };
    return JSON.parse(jsonMatch[0]) as ExpiryExtractionResult;
  } catch {
    return { expiry_date: null, confidence: "low", found: false };
  }
}

/**
 * Extract the total insured/coverage amount from an insurance certificate.
 * Returns { found, amount } — amount is a human-readable string like "$10,000,000".
 */
export async function extractCoverageAmount(
  fileBase64: string,
  mediaType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp",
): Promise<{ found: boolean; amount: string | null }> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 128,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: mediaType, data: fileBase64 },
          } as Anthropic.DocumentBlockParam,
          {
            type: "text",
            text: 'This is an insurance certificate. Find the total sum insured or coverage limit (e.g. "$10,000,000", "$20M", "20,000,000"). Return ONLY JSON: {"found": true, "amount": "$X,XXX,XXX"} or {"found": false, "amount": null}.',
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return { found: false, amount: null };
    return JSON.parse(match[0]) as { found: boolean; amount: string | null };
  } catch {
    return { found: false, amount: null };
  }
}

/** Extract all digit-sequences that look like Australian phone numbers from a string. */
function extractPhoneDigits(text: string): string[] {
  // Match 04xxxxxxxx, +614xxxxxxxx, or any run of 8-10 digits
  const matches = text.match(/(?:\+?61\s*)?0?4[\d\s\-]{7,11}|\b\d[\d\s\-]{7,9}\d\b/g) ?? [];
  return matches.map((m) => m.replace(/\D/g, "")).filter((m) => m.length >= 8);
}

/**
 * AI-mark a short-answer induction question.
 * Returns passed: true if the answer demonstrates sufficient understanding.
 * Fails gracefully — if AI is unavailable, caller should fall back to auto-accept.
 *
 * Special rule: if the expected answer context contains a phone number AND the
 * worker's answer contains a phone number, the digits must match exactly —
 * a wrong phone number always fails regardless of name accuracy.
 */
export async function markShortAnswer(
  question: string,
  expectedAnswerContext: string,
  workerAnswer: string,
): Promise<{ passed: boolean }> {
  // ── Phone number exact-match pre-check ────────────────────────────────────
  const expectedPhones = extractPhoneDigits(expectedAnswerContext);
  const workerPhones = extractPhoneDigits(workerAnswer);

  let phoneRuleClause = "";
  if (expectedPhones.length > 0) {
    if (workerPhones.length > 0) {
      // Worker gave a number — it must exactly match one in the expected context
      const phoneMatches = workerPhones.some((wp) =>
        expectedPhones.some((ep) => ep === wp || ep.endsWith(wp) || wp.endsWith(ep)),
      );
      if (!phoneMatches) {
        return { passed: false };
      }
    }
    // Regardless of pre-check outcome, tell the AI about the strict phone rule
    phoneRuleClause = `\n\nIMPORTANT — PHONE NUMBER RULE: The correct answer contains the phone number(s): ${expectedPhones.join(", ")}. If the worker's answer includes ANY phone number that does not exactly match one of these, mark it FAILED. The name can be an approximate or phonetic match, but the phone number must be exact.`;
  }

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 64,
    messages: [
      {
        role: "user",
        content: `You are marking a construction site safety induction question. Be lenient on names and spelling — the worker just needs to demonstrate basic awareness. Typos and casual language are fine.${phoneRuleClause}

Question: ${question}
Expected answer context (for your reference only): ${expectedAnswerContext}
Worker's answer: ${workerAnswer}

Does this answer demonstrate that the worker has basic awareness of the topic? Reply with ONLY valid JSON: {"passed": true} or {"passed": false}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return { passed: true }; // fallback: accept
    const parsed = JSON.parse(match[0]) as { passed: boolean };
    return { passed: Boolean(parsed.passed) };
  } catch {
    return { passed: true }; // fallback: accept
  }
}

/**
 * Generate 3–5 induction questions from an approved SWMS PDF.
 * Returns an array of { question, expectedAnswerContext } objects.
 */
export async function generateSwmsInductionQuestions(
  pdfBase64: string,
  projectName: string,
  orgName: string,
): Promise<Array<{ question: string; expectedAnswerContext: string }>> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
          } as Anthropic.DocumentBlockParam,
          {
            type: "text",
            text: `This is a Safe Work Method Statement (SWMS) submitted by ${orgName} for work on ${projectName}.

Generate 3 to 5 short-answer induction questions that test whether a worker has read and understood this specific SWMS. Questions should cover the specific hazards, control measures, PPE, and emergency procedures described in this document.

Return ONLY valid JSON in this exact format (no other text):
[
  {
    "question": "Question text — specific to this SWMS",
    "expectedAnswerContext": "What an acceptable answer should mention — for AI marker use only, not shown to workers"
  }
]`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as Array<{ question: string; expectedAnswerContext: string }>;
    return parsed.filter(
      (q) => typeof q.question === "string" && typeof q.expectedAnswerContext === "string",
    );
  } catch {
    return [];
  }
}

/**
 * Review a SWMS PDF against the Agero 14-criteria checklist.
 * pdfBase64 should be the raw base64 string of the PDF.
 */
export async function reviewSwms(pdfBase64: string): Promise<SwmsReviewResult> {
  const systemPrompt = `You are a construction safety expert reviewing a Safe Work Method Statement (SWMS) against the Agero SWMS Review Checklist. Review the uploaded document and assess each of the following 14 criteria. For each criterion respond with: pass, fail, or na (not applicable). Then provide specific comments for any criteria marked fail. Return ONLY valid JSON in the exact format specified.`;

  const userPrompt = `Review this SWMS and return ONLY this JSON structure (no other text):
{
  "criteria": {
    "site_specific_details": {"result": "pass|fail|na", "comment": ""},
    "contractor_details": {"result": "pass|fail|na", "comment": ""},
    "responsible_person": {"result": "pass|fail|na", "comment": ""},
    "scope_of_work": {"result": "pass|fail|na", "comment": ""},
    "competencies_training": {"result": "pass|fail|na", "comment": ""},
    "steps_tasks": {"result": "pass|fail|na", "comment": ""},
    "hazards_risks": {"result": "pass|fail|na", "comment": ""},
    "control_measures": {"result": "pass|fail|na", "comment": ""},
    "legislation_references": {"result": "pass|fail|na", "comment": ""},
    "emergency_procedures": {"result": "pass|fail|na", "comment": ""},
    "plant_equipment": {"result": "pass|fail|na", "comment": ""},
    "ppe_requirements": {"result": "pass|fail|na", "comment": ""},
    "chemicals_msds": {"result": "pass|fail|na", "comment": ""},
    "worker_signatures": {"result": "pass|fail|na", "comment": ""}
  },
  "overall_recommendation": "approve|reject",
  "summary_comments": "Overall summary for safety manager",
  "pass_count": 0,
  "fail_count": 0,
  "na_count": 0
}

Criteria definitions:
1. site_specific_details — Includes project name, address and site-specific details
2. contractor_details — Contractor company name, ABN/ACN, address, contact person, principal contractor details
3. responsible_person — Person responsible for implementing, monitoring, reviewing and ensuring SWMS compliance
4. scope_of_work — Description of activity/scope of work, addresses high-risk construction work if applicable
5. competencies_training — Site-specific competencies, training, inductions, licences, qualifications required
6. steps_tasks — SWMS breaks down steps/tasks required to complete the work activity
7. hazards_risks — Hazards identified and risks assessed for each step/task
8. control_measures — Control measures documented for hazards using elimination, substitution, minimisation
9. legislation_references — Relevant legislation, codes of practice, Australian Standards referenced
10. emergency_procedures — Task-specific emergency/rescue procedures e.g. arrested falls, confined space
11. plant_equipment — Plant and equipment listed with maintenance, certification and inspection records
12. ppe_requirements — PPE requirements identified and type of PPE listed
13. chemicals_msds — Chemicals listed with MSDS/SDS available
14. worker_signatures — Names and signatures of workers trained in SWMS provided`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          } as Anthropic.DocumentBlockParam,
          { type: "text", text: userPrompt },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const result = JSON.parse(jsonMatch[0]) as SwmsReviewResult;
    // Recalculate counts from criteria to ensure accuracy
    const counts = Object.values(result.criteria).reduce(
      (acc, c) => {
        if (c.result === "pass") acc.pass_count++;
        else if (c.result === "fail") acc.fail_count++;
        else acc.na_count++;
        return acc;
      },
      { pass_count: 0, fail_count: 0, na_count: 0 },
    );
    return { ...result, ...counts };
  } catch {
    throw new Error("Failed to parse SWMS review response from Claude");
  }
}
