# APadel

Egypt's competitive padel tennis tournament platform. Players register, organizers manage tournaments and brackets, and admins control the full platform.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES Modules) |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage + RLS) |
| Static server | Express.js (development) |
| Fonts | Barlow Condensed + Barlow (Google Fonts) |

---

## Prerequisites

- Node.js 18+
- A Supabase project (see setup below)

---

## Installation

```bash
# 1. Clone the repo
git clone <repo-url>
cd APADEL

# 2. Install dependencies
npm install

# 3. Copy the environment file
copy .env.example .env   # Windows
# cp .env.example .env   # Mac/Linux

# 4. Fill in your Supabase credentials in .env (see below)

# 5. Start the dev server
npm start
# → http://localhost:3000
```

---

## Environment Variables

Edit `.env` in the project root:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
PORT=3000
```

The anon key is the **public** key from Supabase → Project Settings → API.  
**Never** put the `service_role` key in any file here — it must stay server-side only.

These values are also hardcoded in `frontend/js/supabase.js` for the browser client (the anon key is safe to expose in frontend code).

---

## Supabase Setup

### 1. Create a new Supabase project

Go to [supabase.com](https://supabase.com), create a new project, and note your project URL and anon key.

### 2. Run the schema

1. Open your Supabase project dashboard
2. Go to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Open `supabase/schema.sql` from this repo and paste the entire contents into the editor
5. Click **Run** (or press Ctrl+Enter)

This creates all tables, indexes, triggers, RLS policies, and the storage bucket in one step.

### 3. Update the frontend client

Edit `frontend/js/supabase.js` and replace the URL and anon key with your project's values:

```js
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### 4. Create the first admin user

1. Register an account on the site normally (via `/register.html`)
2. In Supabase dashboard → **Table Editor** → `profiles` table
3. Find your user row and change `role` from `player` to `admin`
4. You can now log in and manage everything from `/admin.html`

---

## Project Structure

```
APADEL/
├── frontend/
│   ├── css/
│   │   └── style.css          # All styles — design tokens, components, layouts
│   ├── js/
│   │   ├── supabase.js        # Supabase client singleton
│   │   ├── app.js             # Core: auth, nav, utilities, boot event
│   │   ├── auth.js            # Login / register / password reset forms
│   │   ├── tournaments.js     # Tournament listing page
│   │   ├── tournament.js      # Tournament detail, registration, bracket view
│   │   ├── bracket.js         # Bracket generation logic (group + knockout)
│   │   ├── rankings.js        # Player rankings with gender filter
│   │   ├── player.js          # Player profile and match history
│   │   ├── edit-profile.js    # Profile editing and avatar upload
│   │   ├── results.js         # Match results by tournament
│   │   ├── announcements.js   # Public announcements list
│   │   ├── contact.js         # Contact info display and form submit
│   │   ├── organiser.js       # Organiser panel (tournaments, registrations, matches)
│   │   └── admin.js           # Admin panel (users, sponsors, config, submissions)
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── forgot-password.html
│   ├── reset-password.html
│   ├── tournaments.html
│   ├── tournament.html
│   ├── rankings.html
│   ├── results.html
│   ├── player.html
│   ├── edit-profile.html
│   ├── announcements.html
│   ├── about.html
│   ├── contact.html
│   ├── organiser.html
│   ├── admin.html
│   ├── robots.txt
│   └── sitemap.xml
├── supabase/
│   └── schema.sql             # Complete DB schema — run once in Supabase SQL Editor
├── server.js                  # Express static file server
├── .env                       # Environment variables (not committed)
├── .env.example               # Template for .env
├── package.json
└── README.md
```

---

## Roles

| Role | Access |
|---|---|
| `player` | Browse, register for tournaments, view own profile |
| `organizer_l1` | Approve registrations, record match scores, manage players |
| `organizer_l2` | All of L1 + create tournaments, announcements, rule templates |
| `admin` | Full access: user roles, sponsors, point config, contact info, all above |

Role is stored in the `profiles` table and enforced by Supabase RLS policies on every table.

---

## Key Architecture Decisions

### Boot event pattern

`app.js` runs an async IIFE that loads the user session, renders the nav, then fires `new CustomEvent('app:ready')`. Every page module listens for this event before running:

```js
window.addEventListener('app:ready', ({ detail: { profile } }) => {
  // page logic here
});
```

This eliminates race conditions between the async Supabase session load and page module initialization.

### XSS prevention

All user-supplied content rendered into `innerHTML` is passed through `escapeHtml()` (exported from `app.js`). Never use `innerHTML` with raw API data directly.

### Supabase Storage

Bucket: `padel-images`  
Folders: `avatars/`, `tournaments/`, `receipts/`, `sponsors/`

Avatar uploads are validated client-side (image MIME type, max 5MB) before upload.

---

## Deployment

### Option A: Static hosting (Netlify, Vercel, Cloudflare Pages)

The `frontend/` folder is entirely static — no build step required.

1. Point your host to the `frontend/` directory as the publish/dist folder
2. Set environment variables for Supabase credentials if needed
3. Update `frontend/js/supabase.js` with production credentials before deploying
4. Update `frontend/sitemap.xml` with your real production domain

### Option B: Node.js server (Railway, Render, VPS)

```bash
npm start
# Serves frontend/ on PORT (default 3000)
```

Set the `PORT` environment variable in your host's dashboard.

---

## After Launch Checklist

- [ ] Replace `https://apadel.com` in `sitemap.xml` and `robots.txt` with the real domain
- [ ] Submit `sitemap.xml` to Google Search Console
- [ ] Set up Supabase Auth email templates (confirmation, password reset) with your branding
- [ ] Configure Storage bucket public access policy for `padel-images`
- [ ] Enable Supabase Auth → Email confirmations if desired
- [ ] Set the first admin user's role manually in the `profiles` table
- [ ] Add real sponsor logos and contact info via the Admin panel

---

## Development Notes

- The Express server in `server.js` adds `Cache-Control: no-cache` headers in development so browser caching does not hide file changes
- Supabase RLS is enabled on all tables — queries from the browser only return data the user is allowed to see
- The `point_config` and `contact_info` tables each have a single row with `id = 1` — they are updated, never re-inserted
