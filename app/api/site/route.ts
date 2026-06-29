import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  accountFromRow,
  accountToRow,
  auditLogFromRow,
  auditLogToRow,
  cleaningTaskFromRow,
  cleaningTaskToRow,
  coldUnitFromRow,
  coldUnitToRow,
  emptySiteState,
  fireZoneFromRow,
  fireZoneToRow,
  foodProductFromRow,
  foodProductToRow,
  handoverFromRow,
  handoverToRow,
  issueFromRow,
  issueToRow,
  routineTaskFromRow,
  routineTaskToRow,
  sessionAccountFromRow,
  staffGuardRemoteFromRow,
  staffGuardRemoteToRow,
  submissionFromRow,
  submissionToRow
} from "@/lib/supabase-site";
import type { Account, SiteState } from "@/lib/site-types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireSession(request: Request) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return { error: NextResponse.json({ error: "Supabase is not configured." }, { status: 503 }) };
  }

  const token = request.headers.get("x-site-session") ?? "";

  if (!token) {
    return { error: NextResponse.json({ error: "Session required." }, { status: 401 }) };
  }

  const { data, error } = await supabase.rpc("session_account", {
    p_session_token: token
  });

  if (error || !data?.[0]) {
    return { error: NextResponse.json({ error: "Session expired." }, { status: 401 }) };
  }

  return { supabase, account: sessionAccountFromRow(data[0]) };
}

export async function GET(request: Request) {
  const session = await requireSession(request);

  if ("error" in session) return session.error;

  const { supabase } = session;
  const [
    accounts,
    cleaningTasks,
    fireZones,
    staffGuardRemotes,
    foodProducts,
    coldUnits,
    routineTasks,
    submissions,
    issues,
    handovers
  ] = await Promise.all([
    supabase.from("site_accounts").select("id, display_name, role, permissions, active").order("display_name"),
    supabase.from("cleaning_tasks").select("*").order("created_at"),
    supabase.from("fire_zones").select("*").order("sort_order"),
    supabase.from("staffguard_remotes").select("*").order("sort_order"),
    supabase.from("food_products").select("*").order("created_at"),
    supabase.from("cold_units").select("*").order("created_at"),
    supabase.from("routine_tasks").select("*").order("created_at"),
    supabase.from("check_submissions").select("*").order("submitted_at", { ascending: false }),
    supabase.from("issues").select("*").order("created_at", { ascending: false }),
    supabase.from("handovers").select("*").order("created_at", { ascending: false })
  ]);

  const auditLogs = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const firstError = [
    accounts,
    cleaningTasks,
    fireZones,
    staffGuardRemotes,
    foodProducts,
    coldUnits,
    routineTasks,
    submissions,
    issues,
    handovers
  ].find((result) => result.error)?.error;

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const mappedSubmissions = await Promise.all(
    (submissions.data ?? []).map(async (row, index) => {
      const submission = submissionFromRow(row);
      if (!submission.photoName || index > 25) return submission;

      const { data } = await supabase.storage.from("cleaning-evidence").createSignedUrl(submission.photoName, 60 * 60);

      return {
        ...submission,
        photoUrl: data?.signedUrl
      };
    })
  );

  const state: SiteState = {
    accounts: (accounts.data ?? []).map(accountFromRow),
    cleaningTasks: (cleaningTasks.data ?? []).map(cleaningTaskFromRow),
    fireZones: (fireZones.data ?? []).map(fireZoneFromRow),
    staffGuardRemotes: (staffGuardRemotes.data ?? []).map(staffGuardRemoteFromRow),
    foodProducts: (foodProducts.data ?? []).map(foodProductFromRow),
    coldUnits: (coldUnits.data ?? []).map(coldUnitFromRow),
    routineTasks: (routineTasks.data ?? []).map(routineTaskFromRow),
    submissions: mappedSubmissions,
    issues: (issues.data ?? []).map(issueFromRow),
    handovers: (handovers.data ?? []).map(handoverFromRow),
    auditLogs: auditLogs.error ? [] : (auditLogs.data ?? []).map(auditLogFromRow)
  };

  return NextResponse.json({ state });
}

export async function PUT(request: Request) {
  try {
    const session = await requireSession(request);

    if ("error" in session) return session.error;

    const { supabase, account } = session;
    const body = await request.json();
    const state = (body.state ?? emptySiteState()) as SiteState;
    const isManagement = account.role === "management";

    const accounts = state.accounts ?? [];

    if (isManagement) {
      await saveManagementState(state);
    }

    await upsertRows(
      "check_submissions",
      state.submissions.map((submission) => submissionToRow(submission, accounts))
    );
    await upsertRows("issues", state.issues.map((issue) => issueToRow(issue, accounts)));

    if (isManagement) {
      await upsertRows("handovers", state.handovers.map((handover) => handoverToRow(handover, accounts)));
      await upsertOptionalRows("audit_logs", state.auditLogs.map((log) => auditLogToRow(log, accounts)));
    }

    return NextResponse.json({ ok: true });

    async function saveManagementState(nextState: SiteState) {
      await saveAccounts(nextState.accounts);
      await upsertRows("cleaning_tasks", nextState.cleaningTasks.map(cleaningTaskToRow));
      await deleteMissingRows("cleaning_tasks", nextState.cleaningTasks.map((task) => task.id));
      await upsertRows("fire_zones", nextState.fireZones.map(fireZoneToRow));
      await upsertRows("staffguard_remotes", nextState.staffGuardRemotes.map(staffGuardRemoteToRow));
      await upsertRows("food_products", nextState.foodProducts.map(foodProductToRow));
      await upsertRows("cold_units", nextState.coldUnits.map(coldUnitToRow));
      await upsertRows("routine_tasks", nextState.routineTasks.map(routineTaskToRow));
    }

    async function saveAccounts(nextAccounts: Account[]) {
      for (const item of nextAccounts.filter((accountItem) => uuidPattern.test(accountItem.id))) {
        const row = accountToRow(item);
        const { data: existing, error: existingError } = await supabase
          .from("site_accounts")
          .select("id")
          .eq("id", item.id)
          .maybeSingle();

        if (existingError) throw new Error(existingError.message);

        if (existing) {
          const { error } = await supabase.from("site_accounts").update(row).eq("id", item.id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.from("site_accounts").insert({
            ...row,
            pin_hash: "pending-pin-reset"
          });
          if (error) throw new Error(error.message);
        }

        if (item.pin) {
          const { error: pinError } = await supabase.rpc("management_reset_account_pin", {
            p_manager_session_token: request.headers.get("x-site-session") ?? "",
            p_account_id: item.id,
            p_new_pin: item.pin
          });

          if (pinError) throw new Error(pinError.message);
        }
      }
    }

    async function upsertRows(table: string, rows: Record<string, unknown>[]) {
      if (rows.length === 0) return;

      const { error } = await supabase.from(table).upsert(rows);

      if (error) throw new Error(error.message);
    }

    async function upsertOptionalRows(table: string, rows: Record<string, unknown>[]) {
      if (rows.length === 0) return;

      const { error } = await supabase.from(table).upsert(rows);

      if (error && !isMissingTableError(error)) throw new Error(error.message);
    }

    async function deleteMissingRows(table: string, idsToKeep: string[]) {
      const query =
        idsToKeep.length === 0
          ? supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000")
          : supabase.from(table).delete().not("id", "in", `(${idsToKeep.join(",")})`);
      const { error } = await query;

      if (error) throw new Error(error.message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save to Supabase.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isMissingTableError(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";

  return error.code === "42P01" || message.includes("does not exist") || message.includes("could not find the table");
}
