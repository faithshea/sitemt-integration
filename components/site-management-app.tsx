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
  latestSubmission,
  makeId,
  nextWeeklyItem,
  readableDate
} from "@/lib/site-logic";
import type {
  Account,
  AccountRole,
  Area,
  CleaningTask,
  ColdUnit,
  ColdUnitType,
  FireZone,
  FoodProduct,
  Shift,
  SiteState,
  StaffGuardRemote,
  Submission
} from "@/lib/site-types";

type Screen = "home" | "management" | "staff" | "settings";
type Flash = { tone: "success" | "warning"; text: string } | null;

const storageKey = "lol-site-management-state-v2";

export function SiteManagementApp({ screen }: { screen: Screen }) {
  const [state, setState] = useState<SiteState>(initialSiteState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) setState(JSON.parse(saved) as SiteState);
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [ready, state]);

  if (!ready) return <LoadingShell />;

  if (screen === "home") {
    return <HomeScreen />;
  }

  const requiredRole: AccountRole = screen === "staff" ? "staff" : "management";

  return (
    <PinGate accounts={state.accounts} requiredRole={requiredRole}>
      {(account) => {
        if (screen === "staff") {
          return <StaffPage account={account} state={state} setState={setState} />;
        }

        if (screen === "settings") {
          return <SettingsPage account={account} state={state} setState={setState} />;
        }

        return <ManagementPage account={account} state={state} />;
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
          <Link className="primary-link" href="/management">
            Management dashboard
          </Link>
          <Link className="secondary-link" href="/staff">
            Staff checks
          </Link>
        </div>
      </section>
    </main>
  );
}

function PinGate({
  accounts,
  requiredRole,
  children
}: {
  accounts: Account[];
  requiredRole: AccountRole;
  children: (account: Account) => React.ReactNode;
}) {
  const eligibleAccounts = accounts.filter(
    (account) => account.active && account.role === requiredRole
  );
  const [accountId, setAccountId] = useState(eligibleAccounts[0]?.id ?? "");
  const [pin, setPin] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const sessionKey = `lol-site-session-${requiredRole}`;

  useEffect(() => {
    const savedAccountId = window.sessionStorage.getItem(sessionKey);
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
    window.sessionStorage.setItem(sessionKey, selected.id);
    setAccount(selected);
  };

  if (account) {
    return <>{children(account)}</>;
  }

  return (
    <main className="auth-page">
      <section className="login-card">
        <BrandBlock />
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
          <button>Unlock {requiredRole === "staff" ? "staff checks" : "dashboard"}</button>
        </form>
      </section>
    </main>
  );
}

function ManagementPage({ account, state }: { account: Account; state: SiteState }) {
  const alerts = useMemo(() => buildAlerts(state), [state]);
  const nextFireZone = nextWeeklyItem(state.fireZones, state.submissions, "fire");
  const nextRemote = nextWeeklyItem(
    state.staffGuardRemotes,
    state.submissions,
    "staffguard"
  );
  const warningLogs = state.submissions.filter((submission) => submission.status === "warning");
  const stats = [
    { label: "Open alerts", value: alerts.length },
    { label: "Tasks due", value: countDueCleaning(state.cleaningTasks, state.submissions) },
    { label: "Warnings", value: warningLogs.length },
    { label: "Logs today", value: logsToday(state.submissions) }
  ];

  return (
    <AppFrame account={account} active="dashboard">
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
          <PanelTitle title="Live activity" detail={`${state.submissions.length} total logs`} />
          {state.submissions.length === 0 ? (
            <EmptyState title="No activity yet" text="Staff submissions will appear here as they are completed." />
          ) : (
            <div className="activity-list">
              {state.submissions.slice(0, 12).map((submission) => (
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
        <DueItem title="Fire alarm zone due" value={nextFireZone ? `${nextFireZone.name} - ${nextFireZone.location}` : "No zones set up"} />
        <DueItem title="StaffGuard remote due" value={nextRemote ? `${nextRemote.name} - ${nextRemote.location}` : "No remotes set up"} />
      </section>
    </AppFrame>
  );
}

function StaffPage({
  account,
  state,
  setState
}: {
  account: Account;
  state: SiteState;
  setState: React.Dispatch<React.SetStateAction<SiteState>>;
}) {
  const [cleaningPhoto, setCleaningPhoto] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<Flash>(null);
  const nextFireZone = nextWeeklyItem(state.fireZones, state.submissions, "fire");
  const nextRemote = nextWeeklyItem(
    state.staffGuardRemotes,
    state.submissions,
    "staffguard"
  );

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
          ? `Probe was ${value}C; minimum accepted temperature is ${product.minTemp}C.`
          : undefined
    });
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
    <AppFrame account={account} active="staff">
      <section className="staff-hero">
        <p className="eyebrow">Staff checks</p>
        <h1>What needs doing?</h1>
        {flash ? <p className={`flash ${flash.tone}`}>{flash.text}</p> : null}
      </section>

      <section className="staff-grid">
        <TaskSection title="Cleaning" detail="Photo required">
          {state.cleaningTasks.length === 0 ? (
            <EmptyState title="No cleaning tasks set" text="Management can add tasks in settings." />
          ) : (
            state.cleaningTasks.map((task) => {
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

        <TaskSection title="Weekly safety checks" detail="One due item at a time">
          <WeeklyCheck
            label="Fire alarm zone"
            item={nextFireZone}
            emptyText="No fire zones are set up."
            area="fire"
            staffName={account.name}
            addSubmission={addSubmission}
          />
          <WeeklyCheck
            label="StaffGuard remote"
            item={nextRemote}
            emptyText="No StaffGuard remotes are set up."
            area="staffguard"
            staffName={account.name}
            addSubmission={addSubmission}
          />
        </TaskSection>

        <TaskSection title="Food temperature" detail="Probe sold products">
          <form className="simple-form" onSubmit={submitFood}>
            <select name="product" required>
              <option value="">Choose product</option>
              {state.foodProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - min {product.minTemp}C
                </option>
              ))}
            </select>
            <input name="temperature" type="number" step="0.1" placeholder="Temperature C" required />
            <button disabled={state.foodProducts.length === 0}>Submit</button>
          </form>
        </TaskSection>

        <TaskSection title="Fridge and freezer" detail="Morning and evening">
          <form className="simple-form" onSubmit={submitCold}>
            <select name="unit" required>
              <option value="">Choose fridge/freezer</option>
              {state.coldUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name} - {unit.type}
                </option>
              ))}
            </select>
            <select name="shift" defaultValue="morning">
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
            </select>
            <input name="temperature" type="number" step="0.1" placeholder="Temperature C" required />
            <button disabled={state.coldUnits.length === 0}>Submit</button>
          </form>
        </TaskSection>
      </section>
    </AppFrame>
  );
}

function SettingsPage({
  account,
  state,
  setState
}: {
  account: Account;
  state: SiteState;
  setState: React.Dispatch<React.SetStateAction<SiteState>>;
}) {
  const [flash, setFlash] = useState<Flash>(null);

  const addCleaningTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const task: CleaningTask = {
      id: makeId("clean"),
      name: String(form.get("name")),
      area: String(form.get("area")),
      frequency: form.get("frequency") as CleaningTask["frequency"],
      requiresPhoto: true
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
      location: String(form.get("location"))
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
      location: String(form.get("location"))
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
      targetTemp: Number(form.get("targetTemp"))
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
      maxTemp: Number(form.get("maxTemp"))
    };
    setState((current) => ({ ...current, coldUnits: [...current.coldUnits, unit] }));
    setFlash({ tone: "success", text: "Fridge/freezer added." });
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
          active: true
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

  return (
    <AppFrame account={account} active="settings">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Management setup</p>
          <h1>Settings</h1>
        </div>
        {flash ? <p className={`flash ${flash.tone}`}>{flash.text}</p> : null}
      </section>

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
          <input name="location" placeholder="Location covered" required />
        </SettingsForm>

        <SettingsForm title="StaffGuard remote" onSubmit={addRemote}>
          <input name="name" placeholder="Remote name" required />
          <input name="location" placeholder="Kept at" required />
        </SettingsForm>

        <SettingsForm title="Food product" onSubmit={addFood}>
          <input name="name" placeholder="Product name" required />
          <input name="minTemp" type="number" placeholder="Minimum C" defaultValue={75} required />
          <input name="targetTemp" type="number" placeholder="Target C" defaultValue={82} required />
        </SettingsForm>

        <SettingsForm title="Staff or management account" onSubmit={addAccount}>
          <input name="name" placeholder="Full name" required />
          <select name="role" defaultValue="staff">
            <option value="staff">Staff</option>
            <option value="management">Management</option>
          </select>
          <input name="pin" inputMode="numeric" maxLength={6} placeholder="PIN, default 123456" />
        </SettingsForm>
      </section>

      <section className="account-panel">
        <PanelTitle title="Accounts and PINs" detail="Management only" />
        <div className="account-list">
          {state.accounts.map((item) => (
            <article className="account-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <p>{item.role} - current PIN {item.pin}</p>
              </div>
              <button type="button" onClick={() => regeneratePin(item.id)}>
                Generate PIN
              </button>
            </article>
          ))}
        </div>
      </section>
    </AppFrame>
  );
}

function AppFrame({
  account,
  active,
  children
}: {
  account: Account;
  active: "dashboard" | "staff" | "settings";
  children: React.ReactNode;
}) {
  return (
    <main className="app-shell">
      <nav className="app-nav">
        <Link className="brand-link" href="/">
          <Image alt="LOL Bingo logo" height={74} priority src="/lol-bingo-logo.webp" width={98} />
          <span>LOL Bingo & Slots Southport</span>
        </Link>
        <div className="nav-links">
          {account.role === "management" ? (
            <>
              <Link className={active === "dashboard" ? "active" : ""} href="/management">
                Dashboard
              </Link>
              <Link className={active === "settings" ? "active" : ""} href="/management/settings">
                Settings
              </Link>
            </>
          ) : (
            <Link className={active === "staff" ? "active" : ""} href="/staff">
              Staff checks
            </Link>
          )}
        </div>
        <div className="user-chip">{account.name}</div>
      </nav>
      {children}
    </main>
  );
}

function BrandBlock() {
  return (
    <div className="brand-block">
      <Image alt="LOL Bingo logo" height={122} priority src="/lol-bingo-logo.webp" width={162} />
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
        <p>{item ? `${item.name} - ${item.location}` : emptyText}</p>
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
