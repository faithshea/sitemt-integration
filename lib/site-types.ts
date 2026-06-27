export type Area = "cleaning" | "fire" | "staffguard" | "food" | "cold";
export type ColdUnitType = "fridge" | "freezer";
export type Shift = "morning" | "evening";
export type AccountRole = "management" | "staff";

export type Account = {
  id: string;
  name: string;
  role: AccountRole;
  pin: string;
  active: boolean;
};

export type CleaningTask = {
  id: string;
  name: string;
  area: string;
  frequency: "daily" | "weekly" | "monthly";
  requiresPhoto: boolean;
};

export type FireZone = {
  id: string;
  name: string;
  location: string;
};

export type StaffGuardRemote = {
  id: string;
  name: string;
  location: string;
};

export type FoodProduct = {
  id: string;
  name: string;
  minTemp: number;
  targetTemp: number;
};

export type ColdUnit = {
  id: string;
  name: string;
  type: ColdUnitType;
  minTemp: number;
  maxTemp: number;
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
  notes?: string;
  status: "ok" | "warning";
};

export type SiteState = {
  accounts: Account[];
  cleaningTasks: CleaningTask[];
  fireZones: FireZone[];
  staffGuardRemotes: StaffGuardRemote[];
  foodProducts: FoodProduct[];
  coldUnits: ColdUnit[];
  submissions: Submission[];
};
