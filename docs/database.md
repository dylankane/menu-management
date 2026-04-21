# Database Guide

## What we're using and why

This project uses **PostgreSQL** as its database. PostgreSQL is a free, open-source database that runs as a separate program on your computer (or server) — think of it like a filing cabinet that your Node.js app talks to whenever it needs to save or retrieve data.

We use **Prisma** as the go-between. Instead of writing raw SQL queries, you define your data models in `prisma/schema.prisma` and Prisma handles translating that into database operations. It also manages **migrations** — which are the instructions for creating and updating your database tables.

---

## How it works in development

On your local machine, PostgreSQL runs as a background Windows service (it started automatically when you installed it and will start on boot going forward). Your Node.js app connects to it using the `DATABASE_URL` in your `.env` file.

```
Your app (.env) → DATABASE_URL → PostgreSQL running on your machine → restaurant_menu_dev database
```

Your local `.env`:
```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/restaurant_menu_dev"
```

- `postgres` — the default superuser created during installation
- `YOUR_PASSWORD` — the password you set during installation
- `localhost` — PostgreSQL is running on your own machine
- `5432` — the default PostgreSQL port
- `restaurant_menu_dev` — the database you created for local development

---

## How it works in production (Plesk VPS)

On your VPS, PostgreSQL is managed through the Plesk control panel. Each restaurant client gets their own separate database — they never share data with each other.

```
Client app (.env) → DATABASE_URL → PostgreSQL on VPS → client_name_menu database
```

The only difference from local is the `DATABASE_URL` in the client's `.env` file — everything else in the codebase is identical.

For each new client deployment:
1. Log into Plesk → Databases → Add Database
2. Create a database (e.g. `clientname_menu`) and a dedicated user with a strong password
3. Copy the connection string into that client's `.env` as `DATABASE_URL`
4. Run migrations and seed (see production commands below)

---

## Default admin credentials1

These are created by the seed script. **Change them immediately after any deployment.**

| Field    | Value                    |
|----------|--------------------------|
| Email    | admin@restaurant.com     |
| Password | admin123                 |

To change them: log into the admin dashboard at `/admin` and update via the profile settings (Stage 3), or update directly in the database via pgAdmin.

---

## Migration and seed commands

Migrations are how you create or update your database tables. When you change `prisma/schema.prisma` (add a field, add a model, etc.) you create a new migration which records exactly what changed and applies it to the database.

The seed script fills the database with default data — the admin user, allergen tags, dietary tags, and starter categories.

---

### Local development

**Run migrations** (use this when you make schema changes during development):
```bash
npm run db:migrate
```
This will ask you to name the migration — use something descriptive like `add_price_to_items` or `init`. It creates the tables and applies the changes immediately.

**Seed the database** (run once after first migration, or after a reset):
```bash
npm run db:seed
```

**Reset the database** (wipes everything and starts fresh — useful during development):
```bash
npm run db:reset
```
This drops all tables, re-runs all migrations from scratch, and then runs the seed automatically. Only use this locally — never on production.

**Open Prisma Studio** (visual browser for your database — useful for inspection):
```bash
npm run db:studio
```

---

### Production (Plesk VPS)

**Run migrations** (use this instead of `db:migrate` on production — it applies without prompts):
```bash
npm run db:deploy
```
Run this every time you deploy an update that includes schema changes. It is safe to run even if there are no new migrations — it will just do nothing.

**Seed the database** (run once after first deployment):
```bash
npm run db:seed
```

**Never run `db:reset` on production.** It will wipe all your client's real data.

---

## Typical workflow

### Setting up a fresh local environment
```bash
# 1. Make sure PostgreSQL is running and DATABASE_URL is set in .env
# 2. Create the tables
npm run db:migrate    # name it "init" on first run

# 3. Fill with default data
npm run db:seed
```

### Making a schema change locally
```bash
# 1. Edit prisma/schema.prisma
# 2. Create and apply the migration
npm run db:migrate    # give it a descriptive name

# 3. Prisma regenerates the client automatically
```

### Deploying a schema change to production
```bash
# 1. SSH into your VPS / open Plesk terminal
# 2. Pull the latest code
# 3. Apply migrations (no prompt, safe for production)
npm run db:deploy

# 4. Restart the app
```

### Setting up a new client on production
```bash
# 1. Create database + user in Plesk
# 2. Set DATABASE_URL in the client's .env
# 3. Apply migrations
npm run db:deploy

# 4. Seed default data
npm run db:seed

# 5. Log in at /admin with admin@restaurant.com / admin123 and change the password
```
