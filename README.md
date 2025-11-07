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
3. Populate the Google credentials inside `.env.local` (details below). If you skip this, the calendar module will render but remain in read-only demo mode.
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

That’s it! Mount the app via Chromium in kiosk mode on your Raspberry Pi, and you’ll have an always-on household productivity board.
