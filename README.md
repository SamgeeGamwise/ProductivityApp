# Home Rhythm

Skylight-inspired productivity dashboard built with Next.js + Tailwind. It pairs a Google Calendar viewer/editor with persistently stored household lists so you can pin it to a local display (e.g., Raspberry Pi) and keep it running offline most of the time.

## Highlights
- **Google Calendar module** – weekly view with quick-add form backed by Google Calendar API via a service account.
- **Todo + Chore lists** – lightweight list manager with notes, stored in `localStorage` for offline persistence per device.
- **Morning & evening routines** – reusable defaults with one-click reset to keep habits visible.
- **Modular layout** – each widget lives in `src/components/modules` so you can rearrange or restyle without touching app plumbing.

## Prerequisites
- Node.js 18.18+ or 20+ (recommended on Raspberry Pi).
- Google Cloud project with Calendar API enabled (only needed for live calendar sync).

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your environment file:
   ```bash
   cp .env.example .env.local
   ```
3. Populate the Google credentials inside `.env.local` (details below) if you want live calendar sync. If you skip this, the site still works publicly, but the calendar module stays in read-only mode with no event editing.
4. Run the dev server:
   ```bash
   npm run dev
   ```
5. Visit [http://localhost:3000](http://localhost:3000) to view the dashboard.

### Configuring Google Calendar
1. In Google Cloud Console, enable the **Google Calendar API** and create a **service account**.
2. Grant the service account access to the calendar you want to manage (Share calendar → Add the service account email → provide `Make changes to events`).
3. Generate a JSON key, then copy:
   - `client_email` → `GOOGLE_CLIENT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY` (keep the `\n` escapes or wrap the key in double quotes and replace actual newlines with `\n`).
4. Set `GOOGLE_CALENDAR_ID` to the Calendar ID (often `you@example.com` or `<id>@group.calendar.google.com`).

> The calendar API routes live at `app/api/calendar/events`. They expect ISO timestamps and can be extended for more actions (update/delete) if needed.

### Data Persistence
- Todos, chores, and routine steps use `localStorage` on the client; they are scoped per browser/device.
- To seed default values or change the storage keys, edit `src/hooks/usePersistentList.ts` or the respective module in `src/components/modules/`.

### Customizing the Layout
- Main composition lives in `src/components/dashboard.tsx`.
- Individual modules are in `src/components/modules/` – rearrange them, duplicate to add new widgets, or swap styling tokens.
- Global styles and theme tokens are in `src/app/globals.css`.

## Production Builds
```bash
npm run build
npm run start
```

## Free Deployment

### Recommended pipeline: GitHub + Vercel
- Best fit for this repo because it is a Next.js app with API routes.
- Free tier is enough for a personal/public dashboard.
- Native GitHub integration gives you automatic production deploys on pushes to `main` and preview deploys for pull requests.
- No Google Calendar secrets are required for a public read-only deployment.

### Suggested setup
1. Push this repo to GitHub.
2. Import the repo into Vercel.
3. Leave the Google Calendar env vars unset if you want a public read-only site.
4. Add only the weather env vars if you want to customize location:
   - `WEATHER_LATITUDE`
   - `WEATHER_LONGITUDE`
   - `WEATHER_USER_AGENT`
5. Set your production branch to `main`.
6. Optionally attach a custom domain from Vercel later.

### Why not GitHub Pages?
- GitHub Pages is free, but this app is not a clean fit because it uses Next.js server features and API routes.
- You would need to rework the app into a static export first.

### Why not Netlify or Cloudflare Pages?
- Both can work, but Vercel is the lowest-friction option for a standard Next.js deployment and has the tightest GitHub integration.

That’s it! Mount the app via Chromium in kiosk mode on your Raspberry Pi, and you’ll have an always-on household productivity board.
