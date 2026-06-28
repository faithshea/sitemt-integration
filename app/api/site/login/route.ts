import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sessionAccountFromRow } from "@/lib/supabase-site";

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body = await request.json();
  const accountId = String(body.accountId ?? "");
  const pin = String(body.pin ?? "");

  if (!accountId || !pin) {
    return NextResponse.json({ error: "Choose an account and enter a PIN." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("verify_account_pin", {
    p_account_id: accountId,
    p_pin: pin
  });

  if (error || !data?.[0]) {
    return NextResponse.json({ error: "That PIN does not match this account." }, { status: 401 });
  }

  const result = data[0];

  return NextResponse.json({
    account: sessionAccountFromRow(result),
    sessionToken: result.session_token,
    expiresAt: result.expires_at
  });
}
