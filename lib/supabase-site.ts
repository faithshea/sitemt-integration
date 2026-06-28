import type {
  Account,
  AccountPermissions,
  AccountRole,
  AuditLog,
  CleaningTask,
  ColdUnit,
  FireZone,
  FoodProduct,
  Handover,
  Issue,
  RoutineTask,
  SiteState,
  StaffGuardRemote,
  Submission
} from "./site-types";

export type SiteSessionAccount = Account;

export function accountFromRow(row: {
  id: string;
  display_name: string;
  role: AccountRole;
  permissions: AccountPermissions;
  active?: boolean;
}): Account {
  return {
    id: row.id,
    name: row.display_name,
    role: row.role,
    pin: "",
    active: row.active ?? true,
    permissions: row.permissions
  };
}

export function sessionAccountFromRow(row: {
  account_id: string;
  display_name: string;
  role: AccountRole;
  permissions: AccountPermissions;
}): SiteSessionAccount {
  return {
    id: row.account_id,
    name: row.display_name,
    role: row.role,
    pin: "",
    active: true,
    permissions: row.permissions
  };
}

export function cleaningTaskFromRow(row: any): CleaningTask {
  return {
    id: row.id,
    name: row.name,
    area: row.area,
    frequency: row.frequency,
    requiresPhoto: row.requires_photo,
    active: row.active
  };
}

export function fireZoneFromRow(row: any): FireZone {
  return {
    id: row.id,
    name: row.name,
    callPoint: row.call_point,
    description: row.description,
    active: row.active
  };
}

export function staffGuardRemoteFromRow(row: any): StaffGuardRemote {
  return {
    id: row.id,
    name: row.name,
    active: row.active
  };
}

export function foodProductFromRow(row: any): FoodProduct {
  return {
    id: row.id,
    name: row.name,
    minTemp: Number(row.min_temp),
    maxTemp: Number(row.max_temp),
    active: row.active
  };
}

export function coldUnitFromRow(row: any): ColdUnit {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    minTemp: Number(row.min_temp),
    maxTemp: Number(row.max_temp),
    active: row.active
  };
}

export function routineTaskFromRow(row: any): RoutineTask {
  return {
    id: row.id,
    area: row.area,
    name: row.name,
    description: row.description,
    frequency: row.frequency,
    active: row.active
  };
}

export function submissionFromRow(row: any): Submission {
  return {
    id: row.id,
    area: row.area,
    itemId: row.item_id,
    itemName: row.item_name,
    staffName: row.staff_name,
    submittedAt: row.submitted_at,
    value: row.measured_value === null ? undefined : Number(row.measured_value),
    shift: row.shift ?? undefined,
    photoName: row.photo_path ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    notes: row.notes ?? undefined,
    status: row.status,
    missedReason: row.missed_reason ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    reviewedBy: row.reviewed_by_name ?? undefined,
    correctiveAction: row.corrective_action ?? undefined
  };
}

export function issueFromRow(row: any): Issue {
  return {
    id: row.id,
    title: row.title,
    detail: row.detail,
    priority: row.priority,
    status: row.status,
    reportedBy: row.reported_by_name,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
    resolution: row.resolution ?? undefined
  };
}

export function handoverFromRow(row: any): Handover {
  return {
    id: row.id,
    managerName: row.manager_name,
    summary: row.summary,
    unresolvedNotes: row.unresolved_notes ?? "",
    createdAt: row.created_at
  };
}

export function auditLogFromRow(row: any): AuditLog {
  return {
    id: row.id,
    actorName: row.actor_name,
    action: row.action,
    detail: row.detail,
    createdAt: row.created_at
  };
}

export function accountToRow(account: Account) {
  return {
    id: account.id,
    display_name: account.name,
    role: account.role,
    permissions: account.permissions,
    active: account.active
  };
}

export function cleaningTaskToRow(task: CleaningTask) {
  return {
    id: task.id,
    name: task.name,
    area: task.area,
    frequency: task.frequency,
    requires_photo: task.requiresPhoto,
    active: task.active
  };
}

export function fireZoneToRow(zone: FireZone, sortOrder: number) {
  return {
    id: zone.id,
    name: zone.name,
    call_point: zone.callPoint,
    description: zone.description,
    sort_order: sortOrder,
    active: zone.active
  };
}

export function staffGuardRemoteToRow(remote: StaffGuardRemote, sortOrder: number) {
  return {
    id: remote.id,
    name: remote.name,
    sort_order: sortOrder,
    active: remote.active
  };
}

export function foodProductToRow(product: FoodProduct) {
  return {
    id: product.id,
    name: product.name,
    min_temp: product.minTemp,
    max_temp: product.maxTemp,
    active: product.active
  };
}

export function coldUnitToRow(unit: ColdUnit) {
  return {
    id: unit.id,
    name: unit.name,
    type: unit.type,
    min_temp: unit.minTemp,
    max_temp: unit.maxTemp,
    active: unit.active
  };
}

export function routineTaskToRow(task: RoutineTask) {
  return {
    id: task.id,
    area: task.area,
    name: task.name,
    description: task.description,
    frequency: task.frequency,
    active: task.active
  };
}

export function submissionToRow(submission: Submission, accounts: Account[]) {
  const staffAccount = accounts.find((account) => account.name === submission.staffName);
  const reviewer = accounts.find((account) => account.name === submission.reviewedBy);

  return {
    id: submission.id,
    area: submission.area,
    item_id: submission.itemId,
    item_name: submission.itemName,
    staff_account_id: staffAccount?.id ?? null,
    staff_name: submission.staffName,
    submitted_at: submission.submittedAt,
    measured_value: submission.value ?? null,
    shift: submission.shift ?? null,
    photo_path: submission.photoName ?? null,
    notes: submission.notes ?? null,
    missed_reason: submission.missedReason ?? null,
    status: submission.status,
    reviewed_at: submission.reviewedAt ?? null,
    reviewed_by_account_id: reviewer?.id ?? null,
    reviewed_by_name: submission.reviewedBy ?? null,
    corrective_action: submission.correctiveAction ?? null
  };
}

export function issueToRow(issue: Issue, accounts: Account[]) {
  const reporter = accounts.find((account) => account.name === issue.reportedBy);

  return {
    id: issue.id,
    title: issue.title,
    detail: issue.detail,
    priority: issue.priority,
    status: issue.status,
    reported_by_account_id: reporter?.id ?? null,
    reported_by_name: issue.reportedBy,
    created_at: issue.createdAt,
    resolved_at: issue.resolvedAt ?? null,
    resolution: issue.resolution ?? null
  };
}

export function handoverToRow(handover: Handover, accounts: Account[]) {
  const manager = accounts.find((account) => account.name === handover.managerName);

  return {
    id: handover.id,
    manager_account_id: manager?.id ?? null,
    manager_name: handover.managerName,
    summary: handover.summary,
    unresolved_notes: handover.unresolvedNotes,
    created_at: handover.createdAt
  };
}

export function auditLogToRow(log: AuditLog, accounts: Account[]) {
  const actor = accounts.find((account) => account.name === log.actorName);

  return {
    id: log.id,
    actor_account_id: actor?.id ?? null,
    actor_name: log.actorName,
    action: log.action,
    detail: log.detail,
    created_at: log.createdAt
  };
}

export function emptySiteState(accounts: Account[] = []): SiteState {
  return {
    accounts,
    cleaningTasks: [],
    fireZones: [],
    staffGuardRemotes: [],
    foodProducts: [],
    coldUnits: [],
    routineTasks: [],
    submissions: [],
    issues: [],
    handovers: [],
    auditLogs: []
  };
}
