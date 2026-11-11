# acme-billing — public demo fixture

A small, plausible invoicing service (TypeScript, **no npm dependency**) used as the
**public example repository** for [Chantiers en collision](https://github.com/baptistefaisy/chantiers-en-collision),
a Forge/Jira app that detects collisions between worksites — humans and coding agents —
through file footprints.

You do not need to run this app. Clone it, point your agent or your CI at your installation,
and watch the app tell two agents that they are editing `src/billing/invoice.ts` at the same time.

```
.
├── .chantier/hook.sh            # agent-client hook (open / close, fail-open, 3 s budget)
├── .claude/settings.json        # Claude Code hook wiring (SessionStart / PreToolUse / SessionEnd)
├── .github/workflows/footprint.yml  # attested footprint on every push
├── src/billing/invoice.ts       # createInvoice, totalCents — `Invoice.total` (renamed by the demo)
├── src/billing/tax.ts           # VAT rates, quiet zone
├── src/billing/service.ts       # BillingService, used by routes and index
├── src/billing/routes.ts        # the route table — HOTSPOT
├── src/auth/login.ts            # fake login — quiet zone, gives `free` verdicts
├── src/i18n/messages.json       # fr/en catalogue — translation hotspot
├── src/index.ts                 # wiring + demo trace
└── db/migrations/000{1,2,3}_*.sql   # EXCLUSIVE zone: two migrations never merge silently
```

Everything is fictional: no real customer, no real money, no real credentials.

---

## Before you start — two values

| Value | Where |
|---|---|
| `<INSTALLATION_URL>` = `https://<INSTALLATION>.webtrigger.atlassian.app/v2/<APP_ID>` | Jira → project settings → **Worksites** → *Hook & CI* tab (copy button). |
| `CHANTIER_TOKEN` (personal token) | Jira → personal settings → **My worksites** → *Generate token*. Shown **once**; the app keeps only its sha256. |
| `CHANTIER_PROJECT_TOKEN` (project token, `/ci/*` only) | Jira → project settings → **Worksites** → *Hook & CI* tab. |

```bash
export CHANTIER_URL="https://<INSTALLATION>.webtrigger.atlassian.app/v2/<APP_ID>"
export CHANTIER_TOKEN="<your personal token>"
```

---

## (a) Use it with the agent hook

The repository already ships `.chantier/hook.sh` (executable) and `.claude/settings.json`.

1. Copy the two files into your own project if you are not working in this one:
   `.chantier/hook.sh` + `.claude/settings.json` (merge the `hooks` block into your existing settings).
2. In `.claude/settings.json`, replace `<INSTALLATION_URL>` in the `PreToolUse` URL with your own
   base URL (the `X-Chantier-Repo: acme/billing` header stays as long as you test against this repo).
3. Export `CHANTIER_URL` and `CHANTIER_TOKEN` (above). The token never gets committed.
4. Start **two agent sessions on two tickets**, e.g. two terminals or two worktrees:

```bash
git checkout -b feature/PROJ-88     # terminal 1: "add multi-currency invoices"
git checkout -b feature/PROJ-101    # terminal 2: "rename invoices.total to total_cents"
```

What happens:

- `SessionStart` → `hook.sh open` reads the branch, extracts the ticket key with
  `[A-Z][A-Z0-9]+-[0-9]+` and POSTs to `/ingest/open`. **Its stdout is injected into the agent's
  context**, so the neighbour list appears before the agent writes anything.
- First `Edit` / `Write` / `NotebookEdit` → the path is POSTed to `/ingest/touch`. On overlap the
  agent receives `additionalContext` naming the neighbour worksite, its actor, its state and any
  notice ("renaming invoices.total to total_cents").
- `SessionEnd` → `hook.sh close` pauses the worksite. If the call fails, dormancy takes over.

**Fail-open proof:** unset `CHANTIER_URL` (or point it at a dead host) and edit a file. The agent is
never blocked: the script exits 0 within 3 s (1.5 s on `SessionEnd`) whatever happens.

## (b) Use it with CI

`.github/workflows/footprint.yml` runs on every push: it computes the files changed since `main`
and POSTs them to `<INSTALLATION_URL>/ingest/ci/footprint`. This makes an **attested** footprint
appear for a developer who has no agent and no hook at all.

Add two repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `CHANTIER_URL` | `https://<INSTALLATION>.webtrigger.atlassian.app/v2/<APP_ID>` |
| `CHANTIER_PROJECT_TOKEN` | the project token (`/ci/*` routes only) |

No secret, no merge base, app down: the job prints a notice and exits 0. It never fails your build
(`timeout-minutes: 5`, `concurrency` per branch, `|| true` on the POST).

## (c) Use it with `curl` — nothing to install

Two commands that simulate two pushes on two tickets. Either token works on `/ci/*`;
`$CHANTIER_PROJECT_TOKEN` is the natural choice.

**Push 1 — PROJ-88 touches the billing domain:**

```bash
curl -sS -X POST "<INSTALLATION_URL>/ingest/ci/footprint" \
  -H "Authorization: Bearer $CHANTIER_PROJECT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "repoSlug": "acme/billing",
        "branch": "feature/PROJ-88",
        "baseBranch": "main",
        "issueKey": "PROJ-88",
        "files": ["src/billing/service.ts", "src/billing/invoice.ts"]
      }'
```

**Push 2 — PROJ-101 touches the same file (and a migration):**

```bash
curl -sS -X POST "<INSTALLATION_URL>/ingest/ci/footprint" \
  -H "Authorization: Bearer $CHANTIER_PROJECT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "repoSlug": "acme/billing",
        "branch": "feature/PROJ-101",
        "baseBranch": "main",
        "issueKey": "PROJ-101",
        "files": ["src/billing/invoice.ts", "db/migrations/0002_add_total.sql"]
      }'
```

Expected in the app: a worksite for each ticket (footprint tagged **attested**), a collision on
`src/billing/invoice.ts` visible on both panels, and `db/migrations/` cited as an exclusive zone.

---

## Scenarios to try

| # | Scenario | What you do | Expected verdict |
|---|---|---|---|
| 1 | Two agents on `invoice.ts` | PROJ-88 declares `src/billing/invoice.ts`, then PROJ-101 declares the same file (hook, `curl` or CI) | `caution`, **D2** — same file, neighbour named (ticket, actor, state, "active n min ago") |
| 2 | Two migrations | PROJ-93 declares `db/migrations/0002_add_total.sql` while PROJ-88 holds a reservation on `db/migrations/` | `wait`, **D4** — exclusive resource `migrations` cited, release time given, advice "work outside db/migrations/, then redeclare" |
| 3 | Lockfile | Two branches both touch `package-lock.json` (add it to the `files` array of the two `curl` commands) | **exclusive** — a lockfile is an exclusive resource: `wait`, never two writers at once |
| 4 | Hotspots | Two agents append a route to `src/billing/routes.ts`, or two keys to `src/i18n/messages.json` | collision **degree lowered** — declared hotspots are expected to be edited in parallel; advice replaces alarm |
| 5 | Notice | PROJ-101 posts "renaming invoices.total to total_cents"; PROJ-88 calls again | the notice is delivered **once**, on the neighbour's next call |
| 6 | Quiet zones | One agent in `src/auth/login.ts`, another in `src/billing/tax.ts` | `free` — disjoint footprints, nothing to report |
| 7 | Release | Close PROJ-88 (`SessionEnd`, or `close-worksite`) | PROJ-101's next check answers `free` |

---

## Working on the fixture itself

```bash
# typecheck only — no install, no dependency (uses any TypeScript >= 5)
npx --yes -p typescript tsc --noEmit -p tsconfig.json

# or, if you prefer npm scripts
npm install --no-save typescript && npm run typecheck && npm run build && npm start
```

`npm test` is a stub (there is no test suite in the fixture) and `npm run build` only emits
`dist/`. Money is always an integer number of cents; the schema the real service would use is
documented in `db/migrations/*.sql`.
