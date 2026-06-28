import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const token = request.headers.get("x-site-session") ?? "";

  if (!token) {
    return NextResponse.json({ error: "Session required." }, { status: 401 });
  }

  const { data: sessionData, error: sessionError } = await supabase.rpc("session_account", {
    p_session_token: token
  });

  if (sessionError || !sessionData?.[0]) {
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Photo file is required." }, { status: 400 });
  }

  const accountId = sessionData[0].account_id;
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
  const path = `${accountId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from("cleaning-evidence")
    .upload(path, file, {
      contentType: file.type,
      upsert: false
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ path });
}
