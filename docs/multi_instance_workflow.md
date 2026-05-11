# Multi-Instance / White-Label Workflow

This project is designed to be copied into client-specific versions while still allowing selected updates to be pulled from the master repo later.

Example:

* Master repo:

  * `menu-management`

* Client repo:

  * `jugo-de-mar-manager`

---

# Creating a New Client Copy

## 1. Download the master repo

From GitHub:

Code → Download ZIP

Extract and rename the folder.

Example:

```txt
jugo-de-mar-manager
```

---

## 2. Create a new empty GitHub repo

Example:

```txt
jugo-de-mar-manager
```

Do NOT initialize with README or gitignore.

---

## 3. Open the extracted folder in the IDE

Initialize git:

```sh
git init
```

Connect to the new repo:

```sh
git remote add origin https://github.com/YOURNAME/jugo-de-mar-manager.git
```

Initial push:

```sh
git add .
git commit -m "Initial client copy"
git push -u origin main
```

---

# Local Setup

Copy the existing `.env` file from the master project.

Install dependencies:

```sh
npm install
```

Generate Prisma client:

```sh
npx prisma generate
```

Run migrations:

```sh
npm run db:deploy
```

Run locally:

```sh
npm run dev
```

Optional: change local port in `.env`

```env
PORT=3001
```

---

# Connecting Back to the Master Repo

Inside the client repo:

```sh
git remote add upstream https://github.com/YOURNAME/menu-management.git
```

Check remotes:

```sh
git remote -v
```

You should see:

```txt
origin   = client repo
upstream = master repo
```

---

# First Pull From Master

The first merge will fail with:

```txt
fatal: refusing to merge unrelated histories
```

This is normal because the client repo was manually created.

Run:

```sh
git fetch upstream
git merge upstream/main --allow-unrelated-histories
```

If conflicts occur and the client repo has no important changes yet, use the upstream versions:

```sh
git checkout --theirs FILE_PATH
```

After resolving conflicts:

```sh
git add .
git commit -m "Merge latest master changes"
```

Then:

```sh
npm install
npx prisma generate
npm run db:deploy
```

---

# Future Updates From Master

After the first merge, updates are much simpler.

## Pull all updates

```sh
git fetch upstream
git merge upstream/main
```

## Pull only specific commits

View commits:

```sh
git log --oneline upstream/main
```

Apply one commit only:

```sh
git cherry-pick COMMIT_ID
```

---

# Recommended Workflow

Keep shared logic in the master repo:

* backend
* admin
* schemas
* authentication
* shared UI

Keep client-specific customization inside the client repo:

* public menu pages
* branding
* styling
* restaurant-specific frontend
