# prediction-ui

Next.js frontend for the DPM prediction market & casino platform.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **NextAuth v5** — casino login (username/password, JWT sessions)
- **Magic SDK** — embedded Web3 wallet (email OTP + Google SSO)
- **Prisma** + PostgreSQL — user accounts, positions, trades (Vercel Postgres in prod, Docker locally)
- **TanStack Query** — client-side data fetching
- **Tailwind CSS v4**

## Prerequisites

- Node.js v20+ (use `nvm use v22`)
- Docker (for the local PostgreSQL instance)

## Environment Variables

Create a `.env.local` file (and a `.env` file for Prisma):

```env
# Database (Prisma reads .env, Next.js reads .env.local)
DATABASE_URL=postgresql://postgres:postgres@localhost:5437/prediction_ui
DIRECT_URL=postgresql://postgres:postgres@localhost:5437/prediction_ui

# NextAuth
AUTH_SECRET=<generate with: openssl rand -base64 32>

# Magic.link — get from https://dashboard.magic.link
NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY=pk_live_...
```

## Getting Started

```bash
# 1. Start the database
docker compose up -d

# 2. Install dependencies (also runs prisma generate via postinstall)
nvm use v22
npm install

# 3. Apply database migrations
npx prisma migrate deploy

# 4. Start the dev server (runs on port 2030)
npm run dev
```

> `npm install` automatically runs `prisma generate` via the `postinstall` script, so the Prisma client is always up to date after installing. If you update `prisma/schema.prisma` without reinstalling, run `npx prisma generate` manually.

Open [http://localhost:2030](http://localhost:2030).

## Magic Wallet Setup

The app has a two-step login flow:

1. **Casino login** — username/password via NextAuth (creates an account with $1,000 virtual balance)
2. **Connect Wallet** — appears in the header after casino login; uses Magic SDK to create/connect a Web3 wallet

### Configuring Magic

1. Create a free app at [dashboard.magic.link](https://dashboard.magic.link) and copy the publishable key into `NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY`
2. Add `http://localhost:2030/oauth/callback` to the **Redirect Allowlist** in Magic dashboard → Settings → Allowed Origins & Redirects

### Configuring Google SSO (optional)

1. Create an OAuth 2.0 Client ID in [Google Cloud Console](https://console.cloud.google.com) (Web application type)
2. Add these two **Authorized redirect URIs** in Google Cloud Console:
   - The Magic callback URI shown in Magic dashboard → Social Login → Google
   - `http://localhost:2030/oauth/callback`
3. Paste the Client ID and Client Secret into Magic dashboard → Social Login → Google
4. Add yourself as a test user in Google Cloud Console → OAuth consent screen (if app is in Testing mode)

### DID Token (debug)

After wallet connection, the app shows the Magic DID token — this is used by the backend team to validate the wallet session via `POST /login` on the prediction-go API.

## Database

### Two environments

| Environment | Connection vars | Source |
|---|---|---|
| **Local dev** | `DATABASE_URL` / `DIRECT_URL` | `.env.local` — Docker Postgres on port 5437 |
| **Vercel (prod)** | `VERCEL_PRISMA_DATABASE_URL` / `VERCEL_POSTGRES_URL` | Set automatically by Vercel Postgres addon |

The app checks `process.env.VERCEL` (auto-set by Vercel) to decide which vars to use. Locally it always uses the Docker database.

### Local database

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Reset (wipe data)
docker compose down -v
docker compose up -d
npx prisma migrate deploy
```

### Migrations

```bash
# Apply migrations to local DB
npx prisma migrate deploy

# Create a new migration (local DB)
npx prisma migrate dev --name <migration_name>

# Apply migrations to Vercel DB (from local machine)
VERCEL=1 npx prisma migrate dev --name <migration_name>
```

Migrations run automatically on push to `main` via GitHub Actions (see `.github/workflows/prisma-migrate.yml`). The workflow runs `prisma migrate deploy` against the Vercel Postgres database.

### Pulling Vercel env vars

```bash
# Link project (one-time)
npx vercel link

# Pull Vercel env vars into a separate file (won't touch .env.local)
npx vercel env pull .env.development.local
```

## Deploy on Vercel

Deployments are automatic on push to `main`. The Vercel Postgres addon provides `VERCEL_PRISMA_DATABASE_URL` and `VERCEL_POSTGRES_URL` automatically — no manual DB config needed.

Database migrations are applied automatically by the CI pipeline before each deployment.

See the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
