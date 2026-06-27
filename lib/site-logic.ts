import type {
  Area,
  CleaningTask,
  ColdUnit,
  FireZone,
  FoodProduct,
  Shift,
  SiteState,
  StaffGuardRemote,
  Submission
} from "./site-types";

export const areaLabels: Record<Area, string> = {
  cleaning: "Cleaning",
  fire: "Fire alarm",
  staffguard: "StaffGuard",
  food: "Food temperature",
  cold: "Fridge / freezer"
};

export function startOfWeek(date = new Date()) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() - day + (day === 0 ? -6 : 1);
  result.setDate(diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function latestSubmission(
  submissions: Submission[],
  area: Area,
  itemId: string
) {
  return submissions
    .filter((submission) => submission.area === area && submission.itemId === itemId)
    .sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    )[0];
}

export function hasSubmissionSince(
  submissions: Submission[],
  area: Area,
  itemId: string,
  since: Date
) {
  return submissions.some(
    (submission) =>
      submission.area === area &&
      submission.itemId === itemId &&
      new Date(submission.submittedAt) >= since
  );
}

export function hasColdShiftToday(
  submissions: Submission[],
  itemId: string,
  shift: Shift
) {
  const today = new Date();
  return submissions.some(
    (submission) =>
      submission.area === "cold" &&
      submission.itemId === itemId &&
      submission.shift === shift &&
      isSameDay(new Date(submission.submittedAt), today)
  );
}

export function nextWeeklyItem<T extends FireZone | StaffGuardRemote>(
  items: T[],
  submissions: Submission[],
  area: "fire" | "staffguard"
) {
  const weekStart = startOfWeek();
  const completedThisWeek = new Set(
    submissions
      .filter(
        (submission) =>
          submission.area === area &&
          new Date(submission.submittedAt) >= weekStart
      )
      .map((submission) => submission.itemId)
  );

  return items.find((item) => !completedThisWeek.has(item.id)) ?? null;
}

export function coldUnitStatus(unit: ColdUnit, value: number) {
  return value >= unit.minTemp && value <= unit.maxTemp ? "ok" : "warning";
}

export function foodStatus(product: FoodProduct, value: number) {
  return value >= product.minTemp ? "ok" : "warning";
}

export function buildAlerts(state: SiteState) {
  const alerts: { title: string; detail: string; severity: "high" | "medium" | "low" }[] = [];
  const weekStart = startOfWeek();
  const monthStart = startOfMonth();

  state.cleaningTasks.forEach((task) => {
    const since = task.frequency === "monthly" ? monthStart : task.frequency === "weekly" ? weekStart : new Date(new Date().setHours(0, 0, 0, 0));
    if (!hasSubmissionSince(state.submissions, "cleaning", task.id, since)) {
      alerts.push({
        title: `${task.name} not completed`,
        detail: `${task.frequency[0].toUpperCase()}${task.frequency.slice(1)} cleaning task is outstanding.`,
        severity: task.frequency === "daily" ? "high" : "medium"
      });
    }
  });

  const nextFire = nextWeeklyItem(state.fireZones, state.submissions, "fire");
  if (nextFire) {
    alerts.push({
      title: "Fire alarm weekly zone due",
      detail: `${nextFire.name} - ${nextFire.location} is available for this week's check.`,
      severity: "medium"
    });
  }

  const nextRemote = nextWeeklyItem(
    state.staffGuardRemotes,
    state.submissions,
    "staffguard"
  );
  if (nextRemote) {
    alerts.push({
      title: "StaffGuard weekly remote due",
      detail: `${nextRemote.name} at ${nextRemote.location} is available for this week's check.`,
      severity: "medium"
    });
  }

  state.coldUnits.forEach((unit) => {
    (["morning", "evening"] as Shift[]).forEach((shift) => {
      if (!hasColdShiftToday(state.submissions, unit.id, shift)) {
        alerts.push({
          title: `${unit.name} ${shift} temperature missing`,
          detail: "Fridges and freezers need two recorded checks every day.",
          severity: "high"
        });
      }
    });
  });

  state.submissions
    .filter((submission) => submission.status === "warning")
    .slice(0, 6)
    .forEach((submission) => {
      alerts.push({
        title: `${submission.itemName} anomaly`,
        detail:
          submission.notes ??
          `${areaLabels[submission.area]} log needs management review.`,
        severity: "high"
      });
    });

  return alerts;
}

export function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function readableDate(value?: string) {
  if (!value) return "No log yet";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function countDueCleaning(tasks: CleaningTask[], submissions: Submission[]) {
  return tasks.filter((task) => {
    const since =
      task.frequency === "monthly"
        ? startOfMonth()
        : task.frequency === "weekly"
          ? startOfWeek()
          : new Date(new Date().setHours(0, 0, 0, 0));
    return !hasSubmissionSince(submissions, "cleaning", task.id, since);
  }).length;
}
