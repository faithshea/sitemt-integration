# LOL Bingo POS

A tablet-first point-of-sale prototype for food and beverage, darts, pool, bingo, customer tabs, cash matches, bingo credits, end-of-trade reports, and Tuesday–Monday stock checks.

## Run locally — easiest method

Double-click **Start LOL POS.cmd**. Keep the black window open while using the app.

## Run from VS Code

If Node.js is installed normally, open this exact folder in VS Code and run `npm run dev`. There are no packages to install.

Staff sign in with their assigned four-digit PIN. PIN verification runs in a protected Supabase Edge Function; neither PINs nor PIN hashes are stored in or returned to the browser.

Products, sales, line items, customer tabs, promotions, floats, till checks, stock checks, staff and end-of-trade reports are stored in Supabase behind Row Level Security. On the first successful manager login, any products from the legacy browser state are imported by SKU and that obsolete browser state is removed only after the import succeeds.

When a network write fails, the current screen retains the unsaved change and shows a retryable error. Do not close or refresh the page until connectivity returns and the save is retried.
