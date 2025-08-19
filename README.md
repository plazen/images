# Plazen Schedule Images

A focused, server-rendered SVG generator for Plazen that renders a user's daily schedule as a single image. It does not proxy or transform arbitrary images — it only produces schedule images for Plazen users by querying Supabase.

- Repository: https://github.com/plazen/images
- Stack: Next.js, TypeScript, Supabase

Status: Early preview

## What it does

- Fetches a user's tasks for a specific date from Supabase
- Renders a clean, readable SVG timeline with hour grid and items
- Serves the SVG over HTTP with cache and CORS headers

## How it works

- Endpoint parses query parameters (see API)
- Loads optional user timetable settings and display name from Supabase
- Loads that user's tasks (title, scheduled_time, duration, etc.) for the given date window
- Renders a single SVG using the computed timeline and items

Key modules:

- app/route.ts — HTTP handler (GET/OPTIONS) that orchestrates fetching and rendering
- lib/schedule.ts — data access and shaping for a given user/date
- lib/svg.ts — schedule SVG renderer

## API

GET /
Query parameters:

- user (required): Supabase Auth user ID (UUID)
- date (required): YYYY-MM-DD (UTC day window)
- tz (optional, defaults to UTC): IANA time zone
- start (optional, defaults to Plazen settings): timetable day start in HH:MM (defaults to user settings or 08:00)
- end (optional, defaults to Plazen settings): timetable day end in HH:MM (defaults to user settings or 18:00)

Response:

- 200 image/svg+xml — the rendered schedule
- Caching: Cache-Control: public, max-age=60, s-maxage=300; CDN-Cache-Control: public, max-age=300
- CORS: Access-Control-Allow-Origin: \*

Examples:

```text
# Minimal
GET /?user=7e9f1c3a-1234-4d9c-b56d-abcdefabcdef&date=2025-08-19 (or today)

# With custom timetable window
GET /?user=7e9f1c3a-1234-4d9c-b56d-abcdefabcdef&date=2025-08-19&tz=UTC&start=07:00&end=19:30
```

Embedding example:

```html
<img
  src="https://images.plazen.org/?user=<your_uuid>&date=today"
  alt="Plazen schedule"
/>
```

Preview:

````html
<img
  src="https://images.plazen.org/?user=828ed580-32b8-49ab-a2d3-ce060edf0504&date=today"
  alt="Plazen schedule"
/>

<img
  src="https://images.plazen.org/?user=828ed580-32b8-49ab-a2d3-ce060edf0504&date=today"
  alt="Plazen schedule"
/>

## Data model expectations


This service expects a Supabase schema with a tasks table containing at least:

- user_id (UUID)
- title (text)
- scheduled_time (timestamp with time zone, ISO 8601)
- duration_minutes (integer)

Optional fields supported by the renderer if present:

- location (text)
- color (hex color like #0ea5e9)
- is_time_sensitive (boolean)
- is_completed (boolean)

User-specific settings (optional) may include:
- timetable_start (hour, e.g., 8)
- timetable_end (hour, e.g., 18)

The service may also fetch the user's display name from Supabase Auth to show in the SVG header.

## Local development

Prerequisites:
- Node.js 18+ (Next.js 14)
- pnpm, npm, or yarn

Setup:
```bash
git clone https://github.com/plazen/images
cd images
# install deps
pnpm install
# or: npm install
# configure environment
cp .env.example .env.local
# add your Supabase values
# run dev server
pnpm dev
# or: npm run dev
# build and start
pnpm build && pnpm start
# or: npm run build && npm start

Available scripts (see package.json):

- dev — next dev
- build — next build
- start — next start
- typecheck — tsc --noEmit

## Configuration

Copy .env.example to .env.local and set:

- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (optional, server-side only)

Notes:

- SERVICE_ROLE_KEY should never be exposed to browsers; keep it server-side only.
- If RLS is enabled, using the service role key on the server can reduce permission friction and improve performance.

## Rendering details

- SVG size: 1000x600 (subject to change)
- Grid: hourly lines with time labels on the left
- Items: vertically placed rectangles spanning start→end; auto-clamped to the day window
- Colors: defaults applied; can be overridden per item via color field when present
- Time zone: all times rendered in the provided tz via conversion from stored timestamps

## Error handling

- 400 — invalid/missing query parameters (e.g., bad date or time formats)
- 502 — database errors fetching schedule data
- 500 — rendering or unexpected server errors

## Deployment

- Works well on platforms that support Next.js 14
- Set environment variables in your host's dashboard
- Ensure only server code can access the service role key (if used)

## Security

- Treat all Supabase keys with care; never expose the service role key to clients
- Validate that callers are allowed to render images for the given user ID in your deployment context

## License

This project is licensed under the MIT License. See LICENSE for details.

