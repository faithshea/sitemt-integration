import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sessionAccountFromRow } from "@/lib/supabase-site";

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const token = request.headers.get("x-site-session") ?? "";

  if (!token) {
    return NextResponse.json({ error: "Session required." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("session_account", {
    p_session_token: token
  });

  if (error || !data?.[0]) {
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  }

  return NextResponse.json({ account: sessionAccountFromRow(data[0]) });
}

export async function DELETE(request: Request) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ ok: true });
  }

  const token = request.headers.get("x-site-session") ?? "";

  if (token) {
    await supabase.rpc("end_site_session", {
      p_session_token: token
    });
  }

  return NextResponse.json({ ok: true });
}
