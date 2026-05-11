# Deploying to a Plesk VPS

This guide walks you through getting the app live on a Plesk-managed VPS from scratch.
No prior Node.js deployment experience needed.

---

## What you will need before you start

- Your Plesk admin panel URL and login
- SSH access to your server (username, password or SSH key)
- The forked GitHub repository URL
- A domain or subdomain pointed at your VPS

---

## Overview

The steps in order:

1. Create a PostgreSQL database in Plesk
2. SSH into the server and clone the repo
3. Create the `.env` file
4. Install dependencies and run database migrations
5. Seed the database and create your super admin account
6. Configure the Node.js app in Plesk
7. Start the app and verify it works

---

## Step 1 — Create a PostgreSQL database in Plesk

Log into your Plesk panel and go to **Databases**.

1. Click **Add Database**
2. Set a database name — e.g. `restaurant_menu`
3. Choose **PostgreSQL** as the type
4. Create a database user — give it a strong password and note it down
5. Click OK

You now have a database. **Important:** Plesk sometimes prefixes the database name and username with your subscription name (e.g. you type `restaurant_menu` but it creates `clientname_restaurant_menu`). After creation, check the exact name Plesk shows and use that in your connection string — do not assume it matches what you typed.

The connection details you will need are:

| Field | Value |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database name | whatever you chose above |
| Username | the user you created |
| Password | the password you set |

Keep these handy — you will paste them into the `.env` file shortly.

---

## Step 2 — SSH into the server and clone the repo

Open a terminal on your local machine and connect to your VPS:

```sh
ssh your-username@your-server-ip
```

Navigate to the directory where Plesk hosts your domain files. It is usually:

```sh
cd /var/www/vhosts/yourdomain.com
```

If you are not sure of the path, log into Plesk, go to your domain, click **Files** — the path shown at the top is your document root. Go one level up from `httpdocs`.

Clone your repo into a folder called `app` (or any name you like — just don't put it inside `httpdocs`):

```sh
git clone https://github.com/your-username/your-repo.git app
cd app
```

---

## Step 3 — Create the `.env` file

The `.env` file holds all your configuration secrets. It is never stored in the repo — you create it fresh on each server.

Copy the example file as a starting point:

```sh
cp .env.example .env
```

Open it in the editor:

```sh
nano .env
```

Fill in every value. Use the table below as a guide:

```env
# Database — use the details from Step 1
DATABASE_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/YOUR_DB_NAME"

# Set to production
NODE_ENV="production"

# The port the Node.js process listens on internally.
# Plesk will proxy traffic through to this port — 3000 is fine.
PORT=3000

# Generate a real secret — run this command and paste the output:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET="paste-your-generated-secret-here"
JWT_EXPIRES_IN="8h"

# Your restaurant name — shown in the browser tab and admin header
RESTAURANT_NAME="My Restaurant"

# Your full public URL — no trailing slash
APP_URL="https://yourdomain.com"

# Your full public URL again (same value unless you embed the menu externally)
CORS_ORIGINS="https://yourdomain.com"

# Leave these at their defaults unless you have a reason to change them
MAX_UPLOAD_SIZE=5242880
UPLOAD_DIR="public/uploads"
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

To generate the `JWT_SECRET`, open a second terminal, run the command shown in the comment above, and paste the output. It will look like a long string of random characters — that is correct.

Save and close the file: `Ctrl+X`, then `Y`, then `Enter`.

---

## Step 4 — Install dependencies and run migrations

Still in the `app` directory over SSH:

```sh
npm install
```

This installs everything the app needs. It will take a minute.

Now run the database migrations. This creates all the tables in your PostgreSQL database:

```sh
npm run db:deploy
```

You should see output listing each migration being applied. If it finishes without errors, your database is set up.

---

## Step 5 — Seed the database and create your super admin

Seed the database. This creates a handful of required structural rows that the app needs to function (restaurant settings, opening hours, etc.) — it does not add any menu content:

```sh
npm run db:seed
```

Now create your super admin account. Replace the values with your own:

```sh
node scripts/create-super-admin.js your@email.com yourpassword "Your Name"
```

Use a strong password — this account has full access to everything.

You should see: `Super admin created: Your Name <your@email.com> (id: 1)`

That is all the data setup done.

---

## Step 6 — Configure the Node.js app in Plesk

Back in the Plesk panel, go to your domain and find **Node.js** in the menu (you may need the Node.js extension installed — check under **Extensions** if you do not see it).

Set the following:

| Setting | Value |
|---|---|
| Node.js version | 20 or higher |
| Application mode | production |
| Application root | the path to your `app` folder — e.g. `/var/www/vhosts/yourdomain.com/app` |
| Application startup file | `server.js` |
| Document root | `app/public` |

Under **Environment variables**, add each variable from your `.env` file. Plesk stores these separately from the file, but having the `.env` file as well does no harm — both work.

Click **Enable Node.js** (or **Apply** / **Save** depending on your Plesk version).

---

## Step 7 — Start the app and verify

In the Node.js panel, click **Restart App** (or **Start**).

Open your domain in a browser. You should be redirected to `/admin/login`.

Log in with the super admin email and password you created in Step 5.

If the page loads and you can log in — you are done.

---

## Updating the app after a code change

When you push new code to GitHub and want to pull it onto the server:

```sh
cd /var/www/vhosts/yourdomain.com/app
git pull
npm install
npm run db:deploy
```

Then in Plesk → Node.js → click **Restart App**.

If there were no database schema changes, you can skip `npm run db:deploy`.

---

## Troubleshooting

**The page does not load / shows a Plesk error page**
Check the Node.js app log in Plesk (Node.js panel → Logs). The most common cause is a missing or incorrect value in the environment variables.

**`npm run db:deploy` fails with a connection error**
Your `DATABASE_URL` is wrong. Double-check the host, port, database name, username, and password. Make sure PostgreSQL is running (`systemctl status postgresql` over SSH).

**Login fails immediately after setup**
The most likely cause is that `JWT_SECRET` is still set to the placeholder value. Regenerate it, update the `.env` file or Plesk environment variables, and restart the app.

**Uploaded images are not saving**
The `public/uploads` directory needs to be writable by the Node.js process:

```sh
chmod -R 755 /var/www/vhosts/yourdomain.com/app/public/uploads
```

---

## Quick reference — startup commands in order

```sh
npm install
npm run db:deploy
npm run db:seed
node scripts/create-super-admin.js your@email.com yourpassword "Your Name"
# then start the app via Plesk
```

Only `npm install`, `npm run db:deploy`, and the Plesk restart are needed for subsequent deployments.
