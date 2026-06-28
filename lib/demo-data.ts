import type { SiteState } from "./site-types";

export const initialSiteState: SiteState = {
  accounts: [
    {
      id: "acct-dashboard-display",
      name: "LOLSPTDashboard",
      role: "dashboard",
      pin: "654321",
      active: true,
      permissions: {
        canAccessDashboard: true,
        canManageSettings: false,
        canCompleteCleaning: false,
        canCompleteFood: false,
        canCompleteCold: false,
        canCompleteFire: false,
        canCompleteStaffGuard: false,
        canCompleteOpening: false,
        canCompleteClosing: false,
        canCompleteSafe: false
      }
    },
    {
      id: "acct-faith-shea",
      name: "Faith Shea",
      role: "management",
      pin: "123456",
      active: true,
      permissions: {
        canAccessDashboard: true,
        canManageSettings: true,
        canCompleteCleaning: true,
        canCompleteFood: true,
        canCompleteCold: true,
        canCompleteFire: true,
        canCompleteStaffGuard: true,
        canCompleteOpening: true,
        canCompleteClosing: true,
        canCompleteSafe: true
      }
    },
    {
      id: "acct-alyssa-stoker",
      name: "Alyssa Stoker",
      role: "staff",
      pin: "123456",
      active: true,
      permissions: {
        canAccessDashboard: false,
        canManageSettings: false,
        canCompleteCleaning: true,
        canCompleteFood: true,
        canCompleteCold: true,
        canCompleteFire: false,
        canCompleteStaffGuard: false,
        canCompleteOpening: true,
        canCompleteClosing: true,
        canCompleteSafe: false
      }
    }
  ],
  cleaningTasks: [],
  fireZones: [],
  staffGuardRemotes: [],
  foodProducts: [],
  coldUnits: [],
  routineTasks: [],
  submissions: [],
  issues: [],
  handovers: []
};
