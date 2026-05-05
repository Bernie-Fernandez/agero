import { NextRequest, NextResponse } from "next/server";
import { createProjectsClient, SEED_ORGANISATION_ID, SEED_USER_ID } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { first_name, last_name, email, specialty } = body as Record<string, string>;

  if (!first_name?.trim()) return NextResponse.json({ error: "First name is required" }, { status: 400 });
  if (!last_name?.trim()) return NextResponse.json({ error: "Last name is required" }, { status: 400 });
  if (!email?.trim()) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  if (!specialty?.trim()) return NextResponse.json({ error: "Specialty is required" }, { status: 400 });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const supabase = createProjectsClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("contacts").insert({
    organisation_id: SEED_ORGANISATION_ID,
    created_by_id: SEED_USER_ID,
    first_name: first_name.trim(),
    last_name: last_name.trim(),
    email: email.trim().toLowerCase(),
    job_title: specialty.trim(),
    contact_type: "MBED_GUIDE",
    data_source: "API",
    contact_category: "COMMERCIAL",
    created_at: now,
    updated_at: now,
  });

  if (error) {
    console.error("guide-notify insert error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
