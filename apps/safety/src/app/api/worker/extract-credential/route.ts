import { NextResponse } from "next/server";
import { getWorkerSession } from "@/lib/worker-auth";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { extractCredentialData } from "@/lib/claude";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMime = (typeof ALLOWED_TYPES)[number];

const TYPE_LABELS: Record<string, string> = {
  driver_licence: "Driver Licence",
  passport: "Passport",
  government_id: "Government ID",
  white_card: "White Card",
  hrwl_scaffold: "HRWL Scaffolding licence",
  hrwl_crane: "HRWL Crane licence",
  hrwl_forklift: "HRWL Forklift licence",
  hrwl_ewp: "HRWL EWP licence",
  hrwl_dogging: "HRWL Dogging licence",
  hrwl_rigging: "HRWL Rigging licence",
  hrwl_confined_space: "HRWL Confined Space licence",
  hrwl_explosive: "HRWL Explosive Powered Tools licence",
  hrwl_other: "HRWL licence",
  trade_licence: "Trade Licence",
  trade_certificate: "Trade Certificate",
  first_aid: "First Aid Certificate",
  asbestos_awareness: "Asbestos Awareness Certificate",
  training_certificate: "Training Certificate",
  other: "Certificate",
};

export async function POST(request: Request) {
  const session = await getWorkerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("photo");
  const docType = (form.get("docType") as string) ?? "other";

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No photo." }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File must be under 10 MB." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type as AllowedMime)) {
    return NextResponse.json({ error: "Must be JPEG, PNG, or WebP." }, { status: 400 });
  }

  const mediaType = file.type as AllowedMime;
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg";
  const path = `workers/${session.workerAccountId}/credentials/${docType}-${Date.now()}.${ext}`;

  const storage = createStorageAdminClient();
  const { error: uploadError } = await storage
    .from("documents")
    .upload(path, buffer, { contentType: mediaType, upsert: false });

  if (uploadError) {
    console.error("[worker/extract-credential]", uploadError);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  const { data: urlData } = storage.from("documents").getPublicUrl(path);
  const photoUrl = urlData.publicUrl;

  const label = TYPE_LABELS[docType] ?? "Certificate";
  const base64 = buffer.toString("base64");
  const extraction = await extractCredentialData(base64, mediaType, label);

  return NextResponse.json({ photoUrl, extraction });
}
