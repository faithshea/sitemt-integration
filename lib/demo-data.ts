import type { SiteState } from "./site-types";

export const initialSiteState: SiteState = {
  accounts: [
    {
      id: "acct-faith-shea",
      name: "Faith Shea",
      role: "management",
      pin: "123456",
      active: true
    },
    {
      id: "acct-alyssa-stoker",
      name: "Alyssa Stoker",
      role: "staff",
      pin: "123456",
      active: true
    }
  ],
  cleaningTasks: [],
  fireZones: [],
  staffGuardRemotes: [],
  foodProducts: [],
  coldUnits: [],
  submissions: []
};
