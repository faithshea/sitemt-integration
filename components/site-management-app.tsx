"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { initialSiteState } from "@/lib/demo-data";
import {
  areaLabels,
  buildAlerts,
  coldUnitStatus,
  countDueCleaning,
  foodStatus,
  hasSubmissionSince,
  latestSubmission,
  makeId,
  nextWeeklyItem,
  readableDate,
  startOfMonth,
  startOfWeek
} from "@/lib/site-logic";
import type {
  Account,
  AccountPermissions,
  AccountRole,
  Area,
  CleaningTask,
  ColdUnit,
  ColdUnitType,
  FireZone,
  FoodProduct,
  Issue,
  RoutineTask,
  Shift,
  SiteState,
  StaffGuardRemote,
  Submission
} from "@/lib/site-types";

type Screen = "home" | "dashboard" | "management" | "staff" | "settings";
type StaffSection =
  | "home"
  | "cleaning"
  | "weekly"
  | "food"
  | "cold"
  | "opening"
  | "closing"
  | "safe"
  | "missed"
  | "issue";
type Flash = { tone: "success" | "warning"; text: string } | null;
type DashboardFilter = "today" | "week" | "warnings" | "missed" | "unreviewed";
type SettingsTab = "setup" | "accounts" | "active" | "reports";

const storageKey = "lol-site-management-state-v2";

export function SiteManagementApp({ screen }: { screen: Screen }) {
  const [state, setState] = useState<SiteState>(initialSiteState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) setState(normalizeSiteState(JSON.parse(saved) as SiteState));
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [ready, state]);

  if (!ready) return <LoadingShell />;

  if (screen === "home") {
    return <HomeScreen />;
  }

  return (
    <PinGate accounts={state.accounts} screen={screen}>
      {(account, logout) => {
        if (screen === "staff") {
          return <StaffPage account={account} state={state} setState={setState} logout={logout} />;
        }

        if (screen === "settings") {
          return <SettingsPage account={account} state={state} setState={setState} logout={logout} />;
        }

        return <ManagementPage account={account} state={state} setState={setState} logout={logout} />;
      }}
    </PinGate>
  );
}

function HomeScreen() {
  return (
    <main className="auth-page">
      <section className="login-card">
        <BrandBlock />
        <div className="home-actions">
          <Link className="primary-link" href="/dashboard">
            Dashboard
          </Link>
          <Link className="primary-link" href="/management">
            Management
          </Link>
          <Link className="secondary-link" href="/staff">
            Staff
          </Link>
        </div>
      </section>
    </main>
  );
}

function PinGate({
  accounts,
  screen,
  children
}: {
  accounts: Account[];
  screen: Exclude<Screen, "home">;
  children: (account: Account, logout: () => void) => React.ReactNode;
}) {
  const eligibleAccounts = accounts.filter((account) => accountIsEligible(account, screen));
  const [accountId, setAccountId] = useState(eligibleAccounts[0]?.id ?? "");
  const [pin, setPin] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const sessionKey = `lol-site-session-${screen === "staff" ? "checks" : screen === "dashboard" ? "dashboard" : "management"}`;
  const currentAccountKey = "lol-site-current-account";

  useEffect(() => {
    const currentAccountId = window.localStorage.getItem(currentAccountKey);
    const savedAccountId =
      (currentAccountId && eligibleAccounts.some((item) => item.id === currentAccountId)
        ? currentAccountId
        : null) ??
      window.localStorage.getItem(sessionKey) ??
      window.sessionStorage.getItem(sessionKey);
    const savedAccount = eligibleAccounts.find((item) => item.id === savedAccountId);
    if (savedAccount) setAccount(savedAccount);
  }, [eligibleAccounts, sessionKey]);

  const submitPin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selected = eligibleAccounts.find((item) => item.id === accountId);
    if (!selected || selected.pin !== pin) {
      setError("That PIN does not match this account.");
      setPin("");
      return;
    }
    window.localStorage.setItem(sessionKey, selected.id);
    window.sessionStorage.setItem(sessionKey, selected.id);
    window.localStorage.setItem(currentAccountKey, selected.id);
    setAccount(selected);
  };

  const logout = () => {
    window.localStorage.removeItem(sessionKey);
    window.sessionStorage.removeItem(sessionKey);
    window.localStorage.removeItem(currentAccountKey);
    setPin("");
    setAccount(null);
  };

  if (account) {
    return <>{children(account, logout)}</>;
  }

  return (
    <main className="auth-page">
      <section className="login-card">
        <BrandBlock />
        <Link className="back-link" href="/">
          Back
        </Link>
        <form className="pin-form" onSubmit={submitPin}>
          <label>
            Account
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              required
            >
              {eligibleAccounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            PIN
            <input
              inputMode="numeric"
              maxLength={6}
              minLength={6}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              type="password"
              value={pin}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button>Unlock {screen === "staff" ? "staff checks" : screen === "dashboard" ? "dashboard display" : "dashboard"}</button>
        </form>
      </section>
    </main>
  );
}

function ManagementPage({
  account,
  state,
  setState,
  logout
}: {
  account: Account;
  state: SiteState;
  setState: React.Dispatch<React.SetStateAction<SiteState>>;
  logout: () => void;
}) {
  const [filter, setFilter] = useState<DashboardFilter>("today");
  const alerts = useMemo(() => buildAlerts(state), [state]);
  const nextFireZone = nextWeeklyItem(state.fireZones, state.submissions, "fire");
  const nextRemote = nextWeeklyItem(
    state.staffGuardRemotes,
    state.submissions,
    "staffguard"
  );
  const warningLogs = state.submissions.filter(
    (submission) => submission.status === "warning" && !submission.reviewedAt
  );
  const openIssues = state.issues.filter((issue) => issue.status === "open");
  const latestHandover = state.handovers[0];
  const stats = [
    { label: "Open alerts", value: alerts.length },
    { label: "Tasks due", value: countDueCleaning(state.cleaningTasks, state.submissions) },
    { label: "Awaiting review", value: warningLogs.length },
    { label: "Logs today", value: logsToday(state.submissions) }
  ];
  const filteredSubmissions = filterSubmissions(state.submissions, filter);

  const reviewSubmission = (event: FormEvent<HTMLFormElement>, submissionId: string) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState((current) => ({
      ...current,
      submissions: current.submissions.map((submission) =>
        submission.id === submissionId
          ? {
              ...submission,
              reviewedAt: new Date().toISOString(),
              reviewedBy: account.name,
              correctiveAction: String(form.get("correctiveAction"))
            }
          : submission
      )
    }));
    event.currentTarget.reset();
  };

  const addHandover = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState((current) => ({
      ...current,
      handovers: [
        {
          id: makeId("handover"),
          managerName: account.name,
          summary: String(form.get("summary")),
          unresolvedNotes: String(form.get("unresolvedNotes")),
          createdAt: new Date().toISOString()
        },
        ...current.handovers
      ]
    }));
    event.currentTarget.reset();
  };

  const resolveIssue = (event: FormEvent<HTMLFormElement>, issueId: string) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState((current) => ({
      ...current,
      issues: current.issues.map((issue) =>
        issue.id === issueId
          ? {
              ...issue,
              status: "resolved",
              resolvedAt: new Date().toISOString(),
              resolution: String(form.get("resolution"))
            }
          : issue
      )
    }));
  };

  return (
    <AppFrame account={account} active="dashboard" logout={logout}>
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Live site overview</p>
          <h1>Management dashboard</h1>
        </div>
        <Link className="secondary-link compact" href="/management/settings">
          Settings
        </Link>
      </section>

      <section className="metric-strip" aria-label="Current site summary">
        {stats.map((stat) => (
          <div className="metric" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </section>

      <section className="management-layout">
        <div className="live-panel">
          <PanelTitle title="Live activity" detail={`${filteredSubmissions.length} shown`} />
          <div className="filter-bar" aria-label="Activity filters">
            {dashboardFilters.map((item) => (
              <button
                className={filter === item.key ? "filter-active" : "secondary-action"}
                key={item.key}
                onClick={() => setFilter(item.key)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          {filteredSubmissions.length === 0 ? (
            <EmptyState title="No activity yet" text="Staff submissions will appear here as they are completed." />
          ) : (
            <div className="activity-list">
              {filteredSubmissions.slice(0, 12).map((submission) => (
                <article className="activity-item" key={submission.id}>
                  <div>
                    <span>{areaLabels[submission.area]}</span>
                    <strong>{submission.itemName}</strong>
                    <p>{submission.staffName} - {readableDate(submission.submittedAt)}</p>
                  </div>
                  <span className={`pill ${submission.status}`}>{submission.status}</span>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="alert-box">
          <PanelTitle title="Alerts" detail={`${alerts.length} active`} />
          {alerts.length === 0 ? (
            <EmptyState title="All clear" text="No missed checks or anomalies are currently showing." />
          ) : (
            <div className="alert-list">
              {alerts.slice(0, 8).map((alert, index) => (
                <article className={`alert ${alert.severity}`} key={`${alert.title}-${index}`}>
                  <strong>{alert.title}</strong>
                  <p>{alert.detail}</p>
                </article>
              ))}
            </div>
          )}
        </aside>
      </section>

      <section className="due-band">
        <DueItem title="Fire alarm zone due" value={nextFireZone ? `${nextFireZone.name} - ${nextFireZone.callPoint}` : "No zones set up"} />
        <DueItem title="StaffGuard remote due" value={nextRemote ? nextRemote.name : "No remotes set up"} />
        <DueItem title="Open issues" value={String(openIssues.length)} />
        <DueItem title="Latest handover" value={latestHandover ? readableDate(latestHandover.createdAt) : "No handover yet"} />
      </section>

      <section className="management-layout secondary-layout">
        <div className="live-panel">
          <PanelTitle title="Corrective actions" detail={`${warningLogs.length} awaiting review`} />
          {warningLogs.length === 0 ? (
            <EmptyState title="No reviews needed" text="Temperature warnings and missed checks will appear here." />
          ) : (
            <div className="activity-list">
              {warningLogs.map((submission) => (
                <article className="review-card" key={submission.id}>
                  <div>
                    <strong>{submission.itemName}</strong>
                    <p>{submission.notes ?? "Review needed"} - {submission.staffName}</p>
                  </div>
                  <form className="inline-form" onSubmit={(event) => reviewSubmission(event, submission.id)}>
                    <input name="correctiveAction" placeholder="Corrective action taken" required />
                    <button>Sign off</button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="alert-box">
          <PanelTitle title="Issue log" detail={`${openIssues.length} open`} />
          {openIssues.length === 0 ? (
            <EmptyState title="No open issues" text="Staff-reported faults and hazards will appear here." />
          ) : (
            <div className="activity-list">
              {openIssues.map((issue) => (
                <article className="review-card" key={issue.id}>
                  <div>
                    <strong>{issue.title}</strong>
                    <p>{issue.detail}</p>
                  </div>
                  <form className="inline-form" onSubmit={(event) => resolveIssue(event, issue.id)}>
                    <input name="resolution" placeholder="Resolution notes" required />
                    <button>Resolve</button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </aside>
      </section>

      <section className="account-panel">
        <PanelTitle title="Manager handover" detail={latestHandover ? `${latestHandover.managerName} - ${readableDate(latestHandover.createdAt)}` : "No handover yet"} />
        <form className="handover-form" onSubmit={addHandover}>
          <textarea name="summary" placeholder="Shift summary" required />
          <textarea name="unresolvedNotes" placeholder="Unresolved checks, issues, or notes for the next manager" />
          <button>Add handover</button>
        </form>
        {latestHandover ? (
          <article className="handover-preview">
            <strong>{latestHandover.summary}</strong>
            <p>{latestHandover.unresolvedNotes || "No unresolved notes."}</p>
          </article>
        ) : null}
      </section>

      <section className="account-panel">
        <PanelTitle title="Reports" detail="CSV export" />
        <div className="report-actions">
          <button type="button" onClick={() => exportSubmissions(state)}>
            Export check logs
          </button>
          <button type="button" onClick={() => exportIssues(state)}>
            Export issue log
          </button>
        </div>
      </section>
    </AppFrame>
  );
}

function StaffPage({
  account,
  state,
  setState,
  logout
}: {
  account: Account;
  state: SiteState;
  setState: React.Dispatch<React.SetStateAction<SiteState>>;
  logout: () => void;
}) {
  const [cleaningPhoto, setCleaningPhoto] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<Flash>(null);
  const [section, setSection] = useState<StaffSection>("home");
  const nextFireZone = nextWeeklyItem(state.fireZones, state.submissions, "fire");
  const nextRemote = nextWeeklyItem(
    state.staffGuardRemotes,
    state.submissions,
    "staffguard"
  );
  const dueCleaningTasks = dueCleaningForAccount(state, account);
  const dueColdEntries = dueColdForAccount(state, account);
  const openingTasks = dueRoutineForAccount(state, account, "opening");
  const closingTasks = dueRoutineForAccount(state, account, "closing");
  const safeTasks = dueRoutineForAccount(state, account, "safe");
  const todayCount =
    dueCleaningTasks.length +
    dueColdEntries.length +
    openingTasks.length +
    closingTasks.length +
    safeTasks.length +
    Number(Boolean(nextFireZone && account.permissions.canCompleteFire)) +
    Number(Boolean(nextRemote && account.permissions.canCompleteStaffGuard));

  const addSubmission = (submission: Omit<Submission, "id" | "submittedAt">) => {
    setState((current) => ({
      ...current,
      submissions: [
        {
          ...submission,
          id: makeId("log"),
          submittedAt: new Date().toISOString()
        },
        ...current.submissions
      ]
    }));
    setFlash({ tone: submission.status === "ok" ? "success" : "warning", text: "Submission saved." });
  };

  const submitFood = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const product = state.foodProducts.find((item) => item.id === form.get("product"));
    const value = Number(form.get("temperature"));
    if (!product) return;
    const status = foodStatus(product, value);
    addSubmission({
      area: "food",
      itemId: product.id,
      itemName: product.name,
      staffName: account.name,
      value,
      status,
      notes:
        status === "warning"
          ? `Probe was ${value}C; expected range is ${product.minTemp}C to ${product.maxTemp}C.`
          : undefined
    });
    event.currentTarget.reset();
  };

  const submitRoutineTask = (task: RoutineTask) => {
    addSubmission({
      area: task.area,
      itemId: task.id,
      itemName: task.name,
      staffName: account.name,
      status: "ok"
    });
  };

  const markMissed = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selected = String(form.get("item")).split("|");
    const area = selected[0] as Area;
    const itemId = selected[1];
    const itemName = selected[2];
    addSubmission({
      area,
      itemId,
      itemName,
      staffName: account.name,
      status: "missed",
      missedReason: String(form.get("reason")),
      notes: String(form.get("reason"))
    });
    event.currentTarget.reset();
  };

  const reportIssue = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState((current) => ({
      ...current,
      issues: [
        {
          id: makeId("issue"),
          title: String(form.get("title")),
          detail: String(form.get("detail")),
          priority: form.get("priority") as Issue["priority"],
          status: "open",
          reportedBy: account.name,
          createdAt: new Date().toISOString()
        },
        ...current.issues
      ]
    }));
    setFlash({ tone: "success", text: "Issue reported." });
    event.currentTarget.reset();
  };

  const submitCold = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const unit = state.coldUnits.find((item) => item.id === form.get("unit"));
    const value = Number(form.get("temperature"));
    const shift = form.get("shift") as Shift;
    if (!unit) return;
    const status = coldUnitStatus(unit, value);
    addSubmission({
      area: "cold",
      itemId: unit.id,
      itemName: unit.name,
      staffName: account.name,
      value,
      shift,
      status,
      notes:
        status === "warning"
          ? `${unit.name} logged ${value}C; expected range is ${unit.minTemp}C to ${unit.maxTemp}C.`
          : undefined
    });
    event.currentTarget.reset();
  };

  return (
    <AppFrame account={account} active="staff" logout={logout}>
      <section className="staff-hero">
        <p className="eyebrow">Staff checks</p>
        <h1>{section === "home" ? "Today" : staffSectionTitle(section)}</h1>
        {section === "home" ? <p className="hero-note">{todayCount} due now</p> : null}
        {flash ? <p className={`flash ${flash.tone}`}>{flash.text}</p> : null}
      </section>

      {section === "home" ? (
        <section className="staff-card-grid">
          {staffCards({
            account,
            state,
            dueCleaningTasks,
            dueColdEntries,
            nextFireZone,
            nextRemote,
            openingTasks,
            closingTasks,
            safeTasks
          }).map((card) => (
            <button className="staff-home-card" key={card.section} type="button" onClick={() => setSection(card.section)}>
              <span>{card.title}</span>
              <strong>{card.count}</strong>
              <small>{card.detail}</small>
            </button>
          ))}
        </section>
      ) : (
        <>
          <section className="staff-actions">
            <button className="secondary-action" type="button" onClick={() => setSection("home")}>
              Back
            </button>
            <button className="secondary-action" type="button" onClick={() => setSection("home")}>
              Home
            </button>
          </section>

          <section className="staff-grid">
        {section === "cleaning" && account.permissions.canCompleteCleaning ? (
        <TaskSection title="Cleaning" detail="Photo required">
          {dueCleaningTasks.length === 0 ? (
            <EmptyState title="No cleaning due" text="Completed weekly and monthly checks will return when they are due again." />
          ) : (
            dueCleaningTasks.map((task) => {
              const latest = latestSubmission(state.submissions, "cleaning", task.id);
              return (
                <article className="staff-task" key={task.id}>
                  <div>
                    <strong>{task.name}</strong>
                    <p>{task.area} - last log: {readableDate(latest?.submittedAt)}</p>
                  </div>
                  <input
                    accept="image/*"
                    aria-label={`Photo evidence for ${task.name}`}
                    capture="environment"
                    type="file"
                    onChange={(event) =>
                      setCleaningPhoto({
                        ...cleaningPhoto,
                        [task.id]: event.target.files?.[0]?.name ?? ""
                      })
                    }
                  />
                  {cleaningPhoto[task.id] ? (
                    <p className="photo-preview">Photo attached: {cleaningPhoto[task.id]}</p>
                  ) : null}
                  <button
                    disabled={!cleaningPhoto[task.id]}
                    onClick={() =>
                      addSubmission({
                        area: "cleaning",
                        itemId: task.id,
                        itemName: task.name,
                        staffName: account.name,
                        photoName: cleaningPhoto[task.id],
                        status: "ok"
                      })
                    }
                    type="button"
                  >
                    Done
                  </button>
                </article>
              );
            })
          )}
        </TaskSection>
        ) : null}

        {section === "weekly" && (account.permissions.canCompleteFire || account.permissions.canCompleteStaffGuard) ? (
        <TaskSection title="Weekly safety checks" detail="One due item at a time">
          {account.permissions.canCompleteFire ? (
          <WeeklyCheck
            label="Fire alarm zone"
            item={nextFireZone}
            emptyText="No fire zones are set up."
            area="fire"
            staffName={account.name}
            addSubmission={addSubmission}
          />
          ) : null}
          {account.permissions.canCompleteStaffGuard ? (
          <WeeklyCheck
            label="StaffGuard remote"
            item={nextRemote}
            emptyText="No StaffGuard remotes are set up."
            area="staffguard"
            staffName={account.name}
            addSubmission={addSubmission}
          />
          ) : null}
        </TaskSection>
        ) : null}

        {section === "food" && account.permissions.canCompleteFood ? (
        <TaskSection title="Food temperature" detail="Probe sold products">
          <form className="simple-form" onSubmit={submitFood}>
            <select name="product" required>
              <option value="">Choose product</option>
              {state.foodProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - {product.minTemp}C to {product.maxTemp}C
                </option>
              ))}
            </select>
            <input name="temperature" type="number" step="0.1" placeholder="Temperature C" required />
            <button disabled={state.foodProducts.length === 0}>Submit</button>
          </form>
        </TaskSection>
        ) : null}

        {section === "cold" && account.permissions.canCompleteCold ? (
        <TaskSection title="Fridge and freezer" detail="Morning and evening">
          <form className="simple-form" onSubmit={submitCold}>
            <select name="unit" required>
              <option value="">Choose fridge/freezer</option>
              {uniqueDueColdUnits(dueColdEntries).map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name} - {unit.type}
                </option>
              ))}
            </select>
            <select name="shift" defaultValue="morning">
              {dueColdEntries.some((entry) => entry.shift === "morning") ? <option value="morning">Morning</option> : null}
              {dueColdEntries.some((entry) => entry.shift === "evening") ? <option value="evening">Evening</option> : null}
            </select>
            <input name="temperature" type="number" step="0.1" placeholder="Temperature C" required />
            <button disabled={dueColdEntries.length === 0}>Submit</button>
          </form>
          {dueColdEntries.length === 0 ? (
            <EmptyState title="Cold checks complete" text="Morning and evening checks will return when due." />
          ) : null}
        </TaskSection>
        ) : null}

        {section === "opening" && account.permissions.canCompleteOpening ? (
          <RoutineTaskSection title="Opening checks" tasks={openingTasks} empty="No opening checks set." onComplete={submitRoutineTask} />
        ) : null}

        {section === "closing" && account.permissions.canCompleteClosing ? (
          <RoutineTaskSection title="Closing checks" tasks={closingTasks} empty="No closing checks set." onComplete={submitRoutineTask} />
        ) : null}

        {section === "safe" && account.permissions.canCompleteSafe ? (
          <RoutineTaskSection title="Safe checks" tasks={safeTasks} empty="No safe checks set." onComplete={submitRoutineTask} />
        ) : null}

        {section === "missed" ? (
        <TaskSection title="Missed check reason" detail="Use when something cannot be completed">
          <form className="simple-form" onSubmit={markMissed}>
            <select name="item" required>
              <option value="">Choose check</option>
              {availableMissableItems(state, account).map((item) => (
                <option key={`${item.area}-${item.id}`} value={`${item.area}|${item.id}|${item.name}`}>
                  {areaLabels[item.area]} - {item.name}
                </option>
              ))}
            </select>
            <textarea name="reason" placeholder="Why could this not be completed?" required />
            <button>Record missed check</button>
          </form>
        </TaskSection>
        ) : null}

        {section === "issue" ? (
        <TaskSection title="Report an issue" detail="Faults, hazards, or equipment problems">
          <form className="simple-form" onSubmit={reportIssue}>
            <input name="title" placeholder="Issue title" required />
            <textarea name="detail" placeholder="What happened and where?" required />
            <select name="priority" defaultValue="medium">
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
            </select>
            <button>Report issue</button>
          </form>
        </TaskSection>
        ) : null}
          </section>
        </>
      )}
    </AppFrame>
  );
}

function SettingsPage({
  account,
  state,
  setState,
  logout
}: {
  account: Account;
  state: SiteState;
  setState: React.Dispatch<React.SetStateAction<SiteState>>;
  logout: () => void;
}) {
  const [flash, setFlash] = useState<Flash>(null);
  const [tab, setTab] = useState<SettingsTab>("setup");

  const addCleaningTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const task: CleaningTask = {
      id: makeId("clean"),
      name: String(form.get("name")),
      area: String(form.get("area")),
      frequency: form.get("frequency") as CleaningTask["frequency"],
      requiresPhoto: true,
      active: true
    };
    setState((current) => ({ ...current, cleaningTasks: [...current.cleaningTasks, task] }));
    setFlash({ tone: "success", text: "Cleaning task added." });
    event.currentTarget.reset();
  };

  const addFireZone = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const zone: FireZone = {
      id: makeId("fire"),
      name: String(form.get("name")),
      callPoint: String(form.get("callPoint")),
      description: String(form.get("description")),
      active: true
    };
    setState((current) => ({ ...current, fireZones: [...current.fireZones, zone] }));
    setFlash({ tone: "success", text: "Fire zone added." });
    event.currentTarget.reset();
  };

  const addRemote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const remote: StaffGuardRemote = {
      id: makeId("remote"),
      name: String(form.get("name")),
      active: true
    };
    setState((current) => ({
      ...current,
      staffGuardRemotes: [...current.staffGuardRemotes, remote]
    }));
    setFlash({ tone: "success", text: "StaffGuard remote added." });
    event.currentTarget.reset();
  };

  const addFood = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const product: FoodProduct = {
      id: makeId("food"),
      name: String(form.get("name")),
      minTemp: Number(form.get("minTemp")),
      maxTemp: Number(form.get("maxTemp")),
      active: true
    };
    setState((current) => ({ ...current, foodProducts: [...current.foodProducts, product] }));
    setFlash({ tone: "success", text: "Food product added." });
    event.currentTarget.reset();
  };

  const addColdUnit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const unit: ColdUnit = {
      id: makeId("cold"),
      name: String(form.get("name")),
      type: form.get("type") as ColdUnitType,
      minTemp: Number(form.get("minTemp")),
      maxTemp: Number(form.get("maxTemp")),
      active: true
    };
    setState((current) => ({ ...current, coldUnits: [...current.coldUnits, unit] }));
    setFlash({ tone: "success", text: "Fridge/freezer added." });
    event.currentTarget.reset();
  };

  const addRoutineTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const task: RoutineTask = {
      id: makeId("routine"),
      area: form.get("area") as RoutineTask["area"],
      name: String(form.get("name")),
      description: String(form.get("description")),
      frequency: form.get("frequency") as RoutineTask["frequency"],
      active: true
    };
    setState((current) => ({ ...current, routineTasks: [...current.routineTasks, task] }));
    setFlash({ tone: "success", text: "Check task added." });
    event.currentTarget.reset();
  };

  const addAccount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const accountName = String(form.get("name"));
    const role = form.get("role") as AccountRole;
    setState((current) => ({
      ...current,
      accounts: [
        ...current.accounts,
        {
          id: makeId("acct"),
          name: accountName,
          role,
          pin: String(form.get("pin") || "123456"),
          active: true,
          permissions: permissionsForRole(role)
        }
      ]
    }));
    setFlash({ tone: "success", text: "Account created." });
    event.currentTarget.reset();
  };

  const regeneratePin = (accountId: string) => {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    setState((current) => ({
      ...current,
      accounts: current.accounts.map((item) =>
        item.id === accountId ? { ...item, pin } : item
      )
    }));
    setFlash({ tone: "success", text: `New PIN generated: ${pin}` });
  };

  const toggleAccountActive = (accountId: string) => {
    setState((current) => ({
      ...current,
      accounts: current.accounts.map((item) =>
        item.id === accountId ? { ...item, active: !item.active } : item
      )
    }));
  };

  const toggleAccountPermission = (
    accountId: string,
    permission: keyof AccountPermissions
  ) => {
    setState((current) => ({
      ...current,
      accounts: current.accounts.map((item) =>
        item.id === accountId
          ? {
              ...item,
              permissions: {
                ...item.permissions,
                [permission]: !item.permissions[permission]
              }
            }
          : item
      )
    }));
  };

  const toggleSetupActive = (
    collection: "cleaningTasks" | "fireZones" | "staffGuardRemotes" | "foodProducts" | "coldUnits" | "routineTasks",
    itemId: string
  ) => {
    setState((current) => ({
      ...current,
      [collection]: current[collection].map((item) =>
        item.id === itemId ? { ...item, active: !item.active } : item
      )
    }));
  };

  return (
    <AppFrame account={account} active="settings" logout={logout}>
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Management setup</p>
          <h1>Settings</h1>
        </div>
        {flash ? <p className={`flash ${flash.tone}`}>{flash.text}</p> : null}
      </section>

      <section className="settings-tabs" aria-label="Settings sections">
        {settingsTabs.map((item) => (
          <button
            className={tab === item.key ? "filter-active" : "secondary-action"}
            key={item.key}
            onClick={() => setTab(item.key)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </section>

      {tab === "setup" ? (
      <section className="settings-grid">
        <SettingsForm title="Cleaning task" onSubmit={addCleaningTask}>
          <input name="name" placeholder="Task name" required />
          <input name="area" placeholder="Area" required />
          <select name="frequency" defaultValue="daily">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </SettingsForm>

        <SettingsForm title="Fridge / freezer" onSubmit={addColdUnit}>
          <input name="name" placeholder="Name or location" required />
          <select name="type" defaultValue="fridge">
            <option value="fridge">Fridge</option>
            <option value="freezer">Freezer</option>
          </select>
          <input name="minTemp" type="number" placeholder="Min C" required />
          <input name="maxTemp" type="number" placeholder="Max C" required />
        </SettingsForm>

        <SettingsForm title="Fire alarm zone" onSubmit={addFireZone}>
          <input name="name" placeholder="Zone name" required />
          <input name="callPoint" placeholder="Call Point 1" required />
          <textarea name="description" placeholder="Where is this call point located?" required />
        </SettingsForm>

        <SettingsForm title="StaffGuard remote" onSubmit={addRemote}>
          <input name="name" placeholder="Remote name" required />
        </SettingsForm>

        <SettingsForm title="Food product" onSubmit={addFood}>
          <input name="name" placeholder="Product name" required />
          <input name="minTemp" type="number" step="0.1" placeholder="Minimum safe C" required />
          <input name="maxTemp" type="number" step="0.1" placeholder="Maximum safe C" required />
          <p className="helper-text">
            Common UK limits: chilled foods are normally 8C or below, and hot-held foods are normally 63C or above.
          </p>
        </SettingsForm>

        <SettingsForm title="Opening, closing or safe check" onSubmit={addRoutineTask}>
          <input name="name" placeholder="Check name" required />
          <select name="area" defaultValue="opening">
            <option value="opening">Opening</option>
            <option value="closing">Closing</option>
            <option value="safe">Safe</option>
          </select>
          <select name="frequency" defaultValue="daily">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <textarea name="description" placeholder="What should staff check?" required />
        </SettingsForm>

        <SettingsForm title="Staff or management account" onSubmit={addAccount}>
          <input name="name" placeholder="Full name" required />
          <select name="role" defaultValue="staff">
            <option value="dashboard">Dashboard display</option>
            <option value="staff">Staff</option>
            <option value="management">Management</option>
          </select>
          <input name="pin" inputMode="numeric" maxLength={6} placeholder="PIN, default 123456" />
        </SettingsForm>
      </section>
      ) : null}

      {tab === "accounts" ? (
      <section className="account-panel">
        <PanelTitle title="Accounts and PINs" detail="Management only" />
        <div className="account-list">
          {state.accounts.map((item) => (
            <article className="account-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <p>{item.role} - current PIN {item.pin} - {item.active ? "active" : "inactive"}</p>
                <div className="permission-grid">
                  {permissionOptions.map((permission) => (
                    <label key={permission.key}>
                      <input
                        checked={item.permissions[permission.key]}
                        onChange={() => toggleAccountPermission(item.id, permission.key)}
                        type="checkbox"
                      />
                      {permission.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="row-actions">
                <button type="button" onClick={() => regeneratePin(item.id)}>
                  Generate PIN
                </button>
                <button className="secondary-action" type="button" onClick={() => toggleAccountActive(item.id)}>
                  {item.active ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      ) : null}

      {tab === "active" ? (
      <section className="account-panel">
        <PanelTitle title="Active setup items" detail="Deactivate without deleting history" />
        <SetupList title="Cleaning" items={state.cleaningTasks} onToggle={(id) => toggleSetupActive("cleaningTasks", id)} />
        <SetupList title="Fire zones" items={state.fireZones} onToggle={(id) => toggleSetupActive("fireZones", id)} />
        <SetupList title="StaffGuard" items={state.staffGuardRemotes} onToggle={(id) => toggleSetupActive("staffGuardRemotes", id)} />
        <SetupList title="Food products" items={state.foodProducts} onToggle={(id) => toggleSetupActive("foodProducts", id)} />
        <SetupList title="Fridges / freezers" items={state.coldUnits} onToggle={(id) => toggleSetupActive("coldUnits", id)} />
        <SetupList title="Opening / closing / safe" items={state.routineTasks} onToggle={(id) => toggleSetupActive("routineTasks", id)} />
      </section>
      ) : null}

      {tab === "reports" ? (
        <section className="account-panel">
          <PanelTitle title="Reports" detail="CSV export" />
          <div className="report-actions">
            <button type="button" onClick={() => exportSubmissions(state)}>
              Export check logs
            </button>
            <button type="button" onClick={() => exportIssues(state)}>
              Export issue log
            </button>
          </div>
        </section>
      ) : null}
    </AppFrame>
  );
}

function AppFrame({
  account,
  active,
  logout,
  children
}: {
  account: Account;
  active: "dashboard" | "staff" | "settings";
  logout: () => void;
  children: React.ReactNode;
}) {
  return (
    <main className="app-shell">
      <nav className="app-nav">
        <Link className="brand-link" href="/">
          <Image alt="LOL Bingo logo" height={44} priority src="/lol-bingo-logo.webp" width={58} />
          <span>LOL Bingo & Slots Southport</span>
        </Link>
        <div className="nav-links">
          {account.permissions.canAccessDashboard ? (
              <Link className={active === "dashboard" ? "active" : ""} href={account.role === "dashboard" ? "/dashboard" : "/management"}>
                Dashboard
              </Link>
          ) : null}
          {account.permissions.canManageSettings ? (
            <Link className={active === "settings" ? "active" : ""} href="/management/settings">
                Settings
              </Link>
          ) : null}
          {accountIsEligible(account, "staff") ? (
            <Link className={active === "staff" ? "active" : ""} href="/staff">
              Staff checks
            </Link>
          ) : null}
        </div>
        <div className="user-area">
          <span className="user-chip">{account.name}</span>
          <button className="logout-button" type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </nav>
      {children}
    </main>
  );
}

function BrandBlock() {
  return (
    <div className="brand-block">
      <Image alt="LOL Bingo logo" height={100} priority src="/lol-bingo-logo.webp" width={132} />
      <div>
        <p className="eyebrow">LOL Bingo & Slots Southport</p>
        <h1>Site checks</h1>
      </div>
    </div>
  );
}

function SettingsForm({
  title,
  onSubmit,
  children
}: {
  title: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <form className="settings-card" onSubmit={onSubmit}>
      <h2>{title}</h2>
      {children}
      <button>Add</button>
    </form>
  );
}

function TaskSection({
  title,
  detail,
  children
}: {
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <section className="task-section">
      <PanelTitle title={title} detail={detail} />
      {children}
    </section>
  );
}

function WeeklyCheck({
  label,
  item,
  emptyText,
  area,
  staffName,
  addSubmission
}: {
  label: string;
  item: FireZone | StaffGuardRemote | null;
  emptyText: string;
  area: "fire" | "staffguard";
  staffName: string;
  addSubmission: (submission: Omit<Submission, "id" | "submittedAt">) => void;
}) {
  return (
    <article className="weekly-card">
      <div>
        <strong>{label}</strong>
        <p>{item ? describeWeeklyItem(item) : emptyText}</p>
      </div>
      <button
        disabled={!item}
        onClick={() =>
          item &&
          addSubmission({
            area,
            itemId: item.id,
            itemName: item.name,
            staffName,
            status: "ok"
          })
        }
        type="button"
      >
        Done
      </button>
    </article>
  );
}

function RoutineTaskSection({
  title,
  tasks,
  empty,
  onComplete
}: {
  title: string;
  tasks: RoutineTask[];
  empty: string;
  onComplete: (task: RoutineTask) => void;
}) {
  return (
    <TaskSection title={title} detail="Simple check-off">
      {tasks.length === 0 ? (
        <EmptyState title={empty} text="Management can add this in settings." />
      ) : (
        <div className="task-list">
          {tasks.map((task) => (
            <article className="weekly-card" key={task.id}>
              <div>
                <strong>{task.name}</strong>
                <p>{task.description}</p>
              </div>
              <button type="button" onClick={() => onComplete(task)}>
                Done
              </button>
            </article>
          ))}
        </div>
      )}
    </TaskSection>
  );
}

function SetupList({
  title,
  items,
  onToggle
}: {
  title: string;
  items: Array<{ id: string; name: string; active: boolean }>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="setup-list">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="muted-line">Nothing set up yet.</p>
      ) : (
        items.map((item) => (
          <article className="setup-row" key={item.id}>
            <span>{item.name}</span>
            <button className="secondary-action" type="button" onClick={() => onToggle(item.id)}>
              {item.active ? "Deactivate" : "Reactivate"}
            </button>
          </article>
        ))
      )}
    </div>
  );
}

function staffSectionTitle(section: StaffSection) {
  const titles: Record<StaffSection, string> = {
    home: "Today",
    cleaning: "Cleaning",
    weekly: "Weekly safety checks",
    food: "Food temperature",
    cold: "Fridge and freezer",
    opening: "Opening checks",
    closing: "Closing checks",
    safe: "Safe checks",
    missed: "Missed check reason",
    issue: "Report an issue"
  };
  return titles[section];
}

function staffCards({
  account,
  state,
  dueCleaningTasks,
  dueColdEntries,
  nextFireZone,
  nextRemote,
  openingTasks,
  closingTasks,
  safeTasks
}: {
  account: Account;
  state: SiteState;
  dueCleaningTasks: CleaningTask[];
  dueColdEntries: { unit: ColdUnit; shift: Shift }[];
  nextFireZone: FireZone | null;
  nextRemote: StaffGuardRemote | null;
  openingTasks: RoutineTask[];
  closingTasks: RoutineTask[];
  safeTasks: RoutineTask[];
}) {
  const cards: { section: StaffSection; title: string; count: string | number; detail: string }[] = [];

  if (account.permissions.canCompleteCleaning) {
    cards.push({
      section: "cleaning",
      title: "Cleaning",
      count: dueCleaningTasks.length,
      detail: "Photo evidence tasks"
    });
  }

  if (account.permissions.canCompleteFire || account.permissions.canCompleteStaffGuard) {
    const weeklyCount = Number(Boolean(nextFireZone && account.permissions.canCompleteFire)) + Number(Boolean(nextRemote && account.permissions.canCompleteStaffGuard));
    cards.push({
      section: "weekly",
      title: "Weekly safety",
      count: weeklyCount,
      detail: "Fire alarm and StaffGuard"
    });
  }

  if (account.permissions.canCompleteFood) {
    cards.push({
      section: "food",
      title: "Food temperatures",
      count: state.foodProducts.filter((product) => product.active).length,
      detail: "Probe sold products"
    });
  }

  if (account.permissions.canCompleteCold) {
    cards.push({
      section: "cold",
      title: "Fridge / freezer",
      count: dueColdEntries.length,
      detail: "Morning and evening"
    });
  }

  if (account.permissions.canCompleteOpening) {
    cards.push({ section: "opening", title: "Opening", count: openingTasks.length, detail: "Due opening checks" });
  }

  if (account.permissions.canCompleteClosing) {
    cards.push({ section: "closing", title: "Closing", count: closingTasks.length, detail: "Due closing checks" });
  }

  if (account.permissions.canCompleteSafe) {
    cards.push({ section: "safe", title: "Safe", count: safeTasks.length, detail: "Restricted checks" });
  }

  cards.push({ section: "missed", title: "Missed check", count: "!", detail: "Record why not completed" });
  cards.push({ section: "issue", title: "Report issue", count: "+", detail: "Faults or hazards" });

  return cards;
}

function PanelTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="panel-title">
      <h2>{title}</h2>
      <span>{detail}</span>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function DueItem({ title, value }: { title: string; value: string }) {
  return (
    <article>
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}

function LoadingShell() {
  return (
    <main className="auth-page">
      <section className="login-card">
        <BrandBlock />
      </section>
    </main>
  );
}

function logsToday(submissions: Submission[]) {
  const today = new Date();
  return submissions.filter((submission) => {
    const submittedAt = new Date(submission.submittedAt);
    return (
      submittedAt.getFullYear() === today.getFullYear() &&
      submittedAt.getMonth() === today.getMonth() &&
      submittedAt.getDate() === today.getDate()
    );
  }).length;
}

function describeWeeklyItem(item: FireZone | StaffGuardRemote) {
  if ("callPoint" in item) {
    return `${item.name} - ${item.callPoint}: ${item.description}`;
  }

  return item.name;
}

const permissionOptions: { key: keyof AccountPermissions; label: string }[] = [
  { key: "canAccessDashboard", label: "Dashboard" },
  { key: "canManageSettings", label: "Settings" },
  { key: "canCompleteCleaning", label: "Cleaning" },
  { key: "canCompleteFood", label: "Food" },
  { key: "canCompleteCold", label: "Fridge/freezer" },
  { key: "canCompleteFire", label: "Fire" },
  { key: "canCompleteStaffGuard", label: "StaffGuard" },
  { key: "canCompleteOpening", label: "Opening" },
  { key: "canCompleteClosing", label: "Closing" },
  { key: "canCompleteSafe", label: "Safe" }
];

const dashboardFilters: { key: DashboardFilter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "warnings", label: "Warnings" },
  { key: "missed", label: "Missed" },
  { key: "unreviewed", label: "Unreviewed" }
];

const settingsTabs: { key: SettingsTab; label: string }[] = [
  { key: "setup", label: "Setup" },
  { key: "accounts", label: "Accounts" },
  { key: "active", label: "Active items" },
  { key: "reports", label: "Reports" }
];

function filterSubmissions(submissions: Submission[], filter: DashboardFilter) {
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const week = startOfWeek();

  return submissions.filter((submission) => {
    const submittedAt = new Date(submission.submittedAt);
    if (filter === "today") return submittedAt >= today;
    if (filter === "week") return submittedAt >= week;
    if (filter === "warnings") return submission.status === "warning";
    if (filter === "missed") return submission.status === "missed";
    return (submission.status === "warning" || submission.status === "missed") && !submission.reviewedAt;
  });
}

function permissionsForRole(role: AccountRole): AccountPermissions {
  if (role === "management") {
    return {
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
    };
  }

  if (role === "dashboard") {
    return {
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
    };
  }

  return {
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
  };
}

function mergeAccounts(accounts: Account[]) {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  initialSiteState.accounts.forEach((account) => {
    if (!byId.has(account.id)) byId.set(account.id, account);
  });

  return Array.from(byId.values()).map((account) => ({
    ...account,
    name: account.id === "acct-dashboard-display" ? "LOLSPTDashboard" : account.name,
    pin: account.id === "acct-dashboard-display" && account.pin === "123456" ? "654321" : account.pin,
    permissions: account.permissions ?? permissionsForRole(account.role)
  }));
}

function accountIsEligible(account: Account, screen: Exclude<Screen, "home">) {
  if (!account.active) return false;
  if (screen === "dashboard") return account.role === "dashboard" && account.permissions.canAccessDashboard;
  if (screen === "management") return account.permissions.canAccessDashboard;
  if (screen === "settings") return account.permissions.canManageSettings;
  return Object.entries(account.permissions).some(
    ([key, value]) => key.startsWith("canComplete") && value
  );
}

function availableMissableItems(state: SiteState, account: Account) {
  const items: { area: Area; id: string; name: string }[] = [];

  if (account.permissions.canCompleteCleaning) {
    items.push(
      ...state.cleaningTasks
        .filter((task) => task.active)
        .map((task) => ({ area: "cleaning" as Area, id: task.id, name: task.name }))
    );
  }

  if (account.permissions.canCompleteFood) {
    items.push(
      ...state.foodProducts
        .filter((product) => product.active)
        .map((product) => ({ area: "food" as Area, id: product.id, name: product.name }))
    );
  }

  if (account.permissions.canCompleteCold) {
    items.push(
      ...state.coldUnits
        .filter((unit) => unit.active)
        .map((unit) => ({ area: "cold" as Area, id: unit.id, name: unit.name }))
    );
  }

  if (account.permissions.canCompleteFire) {
    items.push(
      ...state.fireZones
        .filter((zone) => zone.active)
        .map((zone) => ({ area: "fire" as Area, id: zone.id, name: zone.name }))
    );
  }

  if (account.permissions.canCompleteStaffGuard) {
    items.push(
      ...state.staffGuardRemotes
        .filter((remote) => remote.active)
        .map((remote) => ({ area: "staffguard" as Area, id: remote.id, name: remote.name }))
    );
  }

  state.routineTasks
    .filter((task) => task.active)
    .forEach((task) => {
      const allowed =
        (task.area === "opening" && account.permissions.canCompleteOpening) ||
        (task.area === "closing" && account.permissions.canCompleteClosing) ||
        (task.area === "safe" && account.permissions.canCompleteSafe);
      if (allowed) items.push({ area: task.area, id: task.id, name: task.name });
    });

  return items;
}

function dueCleaningForAccount(state: SiteState, account: Account) {
  if (!account.permissions.canCompleteCleaning) return [];
  return state.cleaningTasks
    .filter((task) => task.active)
    .filter((task) => !hasSubmissionSince(state.submissions, "cleaning", task.id, periodStart(task.frequency)));
}

function dueRoutineForAccount(
  state: SiteState,
  account: Account,
  area: RoutineTask["area"]
) {
  const permissionMap = {
    opening: account.permissions.canCompleteOpening,
    closing: account.permissions.canCompleteClosing,
    safe: account.permissions.canCompleteSafe
  };

  if (!permissionMap[area]) return [];

  return state.routineTasks
    .filter((task) => task.active && task.area === area)
    .filter((task) => !hasSubmissionSince(state.submissions, task.area, task.id, periodStart(task.frequency)));
}

function dueColdForAccount(state: SiteState, account: Account) {
  if (!account.permissions.canCompleteCold) return [];
  return state.coldUnits
    .filter((unit) => unit.active)
    .flatMap((unit) =>
      (["morning", "evening"] as Shift[])
        .filter(
          (shift) =>
            !state.submissions.some(
              (submission) =>
                submission.area === "cold" &&
                submission.itemId === unit.id &&
                submission.shift === shift &&
                new Date(submission.submittedAt) >= periodStart("daily")
            )
        )
        .map((shift) => ({ unit, shift }))
    );
}

function uniqueDueColdUnits(entries: { unit: ColdUnit; shift: Shift }[]) {
  return Array.from(new Map(entries.map((entry) => [entry.unit.id, entry.unit])).values());
}

function periodStart(frequency: "daily" | "weekly" | "monthly") {
  if (frequency === "weekly") return startOfWeek();
  if (frequency === "monthly") return startOfMonth();
  return new Date(new Date().setHours(0, 0, 0, 0));
}

function exportSubmissions(state: SiteState) {
  const rows = state.submissions.map((submission) => ({
    area: areaLabels[submission.area],
    item: submission.itemName,
    staff: submission.staffName,
    submittedAt: submission.submittedAt,
    value: submission.value ?? "",
    status: submission.status,
    notes: submission.notes ?? "",
    missedReason: submission.missedReason ?? "",
    reviewedBy: submission.reviewedBy ?? "",
    reviewedAt: submission.reviewedAt ?? "",
    correctiveAction: submission.correctiveAction ?? ""
  }));
  downloadCsv("lol-check-logs.csv", rows);
}

function exportIssues(state: SiteState) {
  const rows = state.issues.map((issue) => ({
    title: issue.title,
    detail: issue.detail,
    priority: issue.priority,
    status: issue.status,
    reportedBy: issue.reportedBy,
    createdAt: issue.createdAt,
    resolvedAt: issue.resolvedAt ?? "",
    resolution: issue.resolution ?? ""
  }));
  downloadCsv("lol-issue-log.csv", rows);
}

function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  if (rows.length === 0) {
    rows = [{ message: "No records yet" }];
  }

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row[header] ?? "").replaceAll('"', '""')}"`)
        .join(",")
    )
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeSiteState(state: SiteState): SiteState {
  return {
    ...initialSiteState,
    ...state,
    accounts: mergeAccounts(state.accounts ?? []),
    cleaningTasks: (state.cleaningTasks ?? []).map((task) => ({
      ...task,
      active: task.active ?? true
    })),
    fireZones: (state.fireZones ?? []).map((zone) => ({
      ...zone,
      callPoint:
        "callPoint" in zone && zone.callPoint
          ? zone.callPoint
          : "Call Point 1",
      description:
        "description" in zone && zone.description
          ? zone.description
          : "location" in zone
            ? String(zone.location)
            : "",
      active: zone.active ?? true
    })),
    staffGuardRemotes: (state.staffGuardRemotes ?? []).map((remote) => ({
      id: remote.id,
      name: remote.name,
      active: remote.active ?? true
    })),
    foodProducts: (state.foodProducts ?? []).map((product) => ({
      ...product,
      maxTemp:
        "maxTemp" in product && product.maxTemp !== undefined
          ? product.maxTemp
          : "targetTemp" in product
            ? Number(product.targetTemp)
            : product.minTemp,
      active: product.active ?? true
    })),
    coldUnits: (state.coldUnits ?? []).map((unit) => ({
      ...unit,
      active: unit.active ?? true
    })),
    routineTasks: (state.routineTasks ?? []).map((task) => ({
      ...task,
      active: task.active ?? true
    })),
    issues: state.issues ?? [],
    handovers: state.handovers ?? []
  };
}
