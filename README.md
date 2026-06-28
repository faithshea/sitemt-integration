# LOL Bingo & Slots Southport Site Management

A Vercel and Supabase-ready Next.js project for managing daily and weekly venue checks at LOL Bingo & Slots Southport.

## What is included

- Separate PIN-protected management and staff pages.
- Permission-based accounts, so managers can use the dashboard and complete checks while staff can be limited to specific check types.
- `LOLSPTDashboard` starter account for a view-only dashboard screen, PIN `654321`.
- Starter management account: Faith Shea, PIN `123456`.
- Starter staff account: Alyssa Stoker, PIN `123456`.
- Management dashboard with active alerts, live activity, and key site status.
- Management settings page for cleaning tasks, fire alarm zones and call points, StaffGuard remotes, food products, fridge/freezer units, opening/closing/safe checks, and accounts.
- Staff phone view for cleaning evidence, weekly fire alarm checks, weekly StaffGuard checks, food probe temperatures, and fridge/freezer temperatures.
- Missed-check reasons, staff issue reporting, manager corrective-action review, manager handovers, and CSV exports.
- Weekly rotation logic so only the next uncompleted fire zone and StaffGuard remote are available.
- Anomaly detection for unsafe food temperatures and out-of-range cold-storage temperatures.
- Twice-daily fridge/freezer tracking for morning and evening checks.
- Food product setup uses minimum and maximum safe temperature ranges.
- Supabase schema with starter tables, row level security policies, and review/corrective-action fields.

## Local routes

- `/management` - management dashboard
- `/management/settings` - management setup
- `/dashboard` - view-only dashboard display login
- `/staff` - staff checks

## Account model

Do not use a shared management account for real check completion. Keep every manager and staff member as a named account so the audit trail shows who completed or reviewed each item.

The included `Dashboard Display` account is intended only for a shared screen that shows the dashboard. Named management accounts should be used for settings, completing checks, corrective actions, handovers, and reviews.

## Recommended extra features

- Management sign-off on warnings with a required corrective action.
- Photo storage in a private Supabase Storage bucket for cleaning evidence.
- Staff authentication with separate management and staff roles.
- Exportable inspection reports by date range.
- A daily manager handover page for unresolved warnings, missed checks, and equipment issues.
- Optional notification emails for missed daily checks or unsafe temperatures.

## Local setup

Install dependencies:

```bash
npm install
```

Run the local app:

```bash
npm run dev
```

Open `http://localhost:3000`, or the port shown in the terminal.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor. This creates PIN-based site accounts instead of email-based Supabase Auth users.
3. Add your project URL, anon key, and service-role key to `.env.local` using `.env.example`.
4. Create a private storage bucket called `cleaning-evidence` for cleaning photos. Keep the bucket private, limit files to 5 MB, and allow `image/jpeg`, `image/png`, and `image/webp`.

Starter accounts:

- `LOLSPTDashboard` with PIN `654321`
- `Faith Shea` with PIN `123456`
- `Alyssa Stoker` with PIN `123456`

The app currently uses local in-browser state so the workflows can be tested immediately. The next build step is wiring the forms and logs to Supabase.
