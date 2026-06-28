import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { accountFromRow } from "@/lib/supabase-site";

export async function GET() {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ accounts: [], enabled: false }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("site_accounts")
    .select("id, display_name, role, permissions, active")
    .order("display_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    accounts: (data ?? []).map(accountFromRow),
    enabled: true
  });
}
