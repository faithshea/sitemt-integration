export type Area =
  | "cleaning"
  | "fire"
  | "staffguard"
  | "food"
  | "cold"
  | "opening"
  | "closing"
  | "safe"
  | "management";
export type ColdUnitType = "fridge" | "freezer";
export type Shift = "morning" | "evening";
export type AccountRole = "dashboard" | "management" | "staff";
export type CleaningFrequency = "daily" | "weekly" | "twice_weekly" | "four_weekly" | "monthly";

export type AccountPermissions = {
  canAccessDashboard: boolean;
  canManageSettings: boolean;
  canCompleteCleaning: boolean;
  canCompleteFood: boolean;
  canCompleteCold: boolean;
  canCompleteFire: boolean;
  canCompleteStaffGuard: boolean;
  canCompleteOpening: boolean;
  canCompleteClosing: boolean;
  canCompleteSafe: boolean;
};

export type Account = {
  id: string;
  name: string;
  role: AccountRole;
  pin: string;
  active: boolean;
  permissions: AccountPermissions;
};

export type CleaningTask = {
  id: string;
  name: string;
  area: string;
  frequency: CleaningFrequency;
  requiresPhoto: boolean;
  active: boolean;
};

export type FireZone = {
  id: string;
  name: string;
  callPoint: string;
  description: string;
  active: boolean;
};

export type StaffGuardRemote = {
  id: string;
  name: string;
  active: boolean;
};

export type FoodProduct = {
  id: string;
  name: string;
  minTemp: number;
  maxTemp: number;
  active: boolean;
};

export type ColdUnit = {
  id: string;
  name: string;
  type: ColdUnitType;
  minTemp: number;
  maxTemp: number;
  active: boolean;
};

export type RoutineTask = {
  id: string;
  area: "opening" | "closing" | "safe" | "management";
  name: string;
  description: string;
  frequency: "daily" | "weekly" | "monthly";
  active: boolean;
};

export type Submission = {
  id: string;
  area: Area;
  itemId: string;
  itemName: string;
  staffName: string;
  submittedAt: string;
  value?: number;
  shift?: Shift;
  photoName?: string;
  photoUrl?: string;
  notes?: string;
  status: "ok" | "warning" | "missed";
  missedReason?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  correctiveAction?: string;
};

export type Issue = {
  id: string;
  title: string;
  detail: string;
  priority: "low" | "medium" | "high";
  status: "open" | "resolved";
  reportedBy: string;
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
};

export type Handover = {
  id: string;
  managerName: string;
  summary: string;
  unresolvedNotes: string;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  actorName: string;
  action: string;
  detail: string;
  createdAt: string;
};

export type SiteState = {
  accounts: Account[];
  cleaningTasks: CleaningTask[];
  fireZones: FireZone[];
  staffGuardRemotes: StaffGuardRemote[];
  foodProducts: FoodProduct[];
  coldUnits: ColdUnit[];
  routineTasks: RoutineTask[];
  submissions: Submission[];
  issues: Issue[];
  handovers: Handover[];
  auditLogs: AuditLog[];
};
