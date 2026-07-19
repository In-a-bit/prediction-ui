# prediction-ui

Next.js frontend for the DPM prediction market & casino platform.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Magic SDK** — embedded Web3 wallet (email OTP + Google SSO)
- **TanStack Query** — client-side data fetching
- **Tailwind CSS v4**
- **Prisma** + PostgreSQL — schema & migrations retained in the repo but currently unused by the app (no database is required to run it)

## Prerequisites

- Node.js v20+ (use `nvm use v22`)

## Environment Variables

Create a `.env.local` file (see [`.env.example`](.env.example) for the full list):

```env
# LP demo sealed cookies (generate with: openssl rand -base64 32)
AUTH_SECRET=<random secret>

# Magic.link — get from https://dashboard.magic.link
NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY=pk_live_...
```

## Getting Started

```bash
# 1. Install dependencies (runs `prisma generate` via postinstall — no DB needed)
nvm use v22
npm install

# 2. Start the dev server (runs on port 2030)
npm run dev
```

Open [http://localhost:2030](http://localhost:2030).

No database is required to install, build, or run the app.

## Magic Wallet Setup

Login is a single step: **Connect Wallet** in the header uses Magic SDK to create/connect a Web3 wallet.

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

## Database (retained, currently unused)

The Prisma schema and migrations are kept in the repo for future use, but no application code reads from the database today, so the app runs without one. `prisma generate` still runs on `postinstall` so the client types resolve (it does not require a database connection).

If you want to work with the database locally:

```bash
# Start local Postgres (port 5437)
docker compose up -d

# Apply migrations
npx prisma migrate deploy
```

`DATABASE_URL` / `DIRECT_URL` (see `.env.example`) are only needed for these Prisma CLI commands.

## Deploy on Vercel

Deployments are automatic on push to `main`.

See the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
