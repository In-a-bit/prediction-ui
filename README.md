# prediction-ui

Next.js frontend for the DPM prediction market & casino platform.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **NextAuth v5** — casino login (username/password, JWT sessions)
- **Magic SDK** — embedded Web3 wallet (email OTP + Google SSO)
- **Prisma** + PostgreSQL — user accounts, positions, trades
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

The local PostgreSQL runs in Docker on port **5437** (avoids conflicts with other local databases).

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

## Deploy on Vercel

The easiest way to deploy is via the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Make sure to add all environment variables from the `.env.local` section above in your Vercel project settings, and swap `DATABASE_URL` / `DIRECT_URL` for your production database connection strings.

See the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
