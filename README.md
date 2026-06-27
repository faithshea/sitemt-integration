# LOL Bingo & Slots Southport Site Management

A Vercel and Supabase-ready Next.js project for managing daily and weekly venue checks at LOL Bingo & Slots Southport.

## What is included

- Separate PIN-protected management and staff pages.
- Starter management account: Faith Shea, PIN `123456`.
- Starter staff account: Alyssa Stoker, PIN `123456`.
- Management dashboard with active alerts, live activity, and key site status.
- Management settings page for cleaning tasks, fire zones, StaffGuard remotes, food products, fridge/freezer units, and staff/management accounts.
- Staff phone view for cleaning evidence, weekly fire alarm checks, weekly StaffGuard checks, food probe temperatures, and fridge/freezer temperatures.
- Weekly rotation logic so only the next uncompleted fire zone and StaffGuard remote are available.
- Anomaly detection for unsafe food temperatures and out-of-range cold-storage temperatures.
- Twice-daily fridge/freezer tracking for morning and evening checks.
- Supabase schema with starter tables, row level security policies, and review/corrective-action fields.

## Local routes

- `/management` - management dashboard
- `/management/settings` - management setup
- `/staff` - staff checks

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
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Add your project URL and anon key to `.env.local` using `.env.example`.
4. Create a private storage bucket for cleaning photos when the app is connected to Supabase.

The app currently uses local in-browser state so the workflows can be tested immediately. The next build step is wiring the forms and logs to Supabase.
