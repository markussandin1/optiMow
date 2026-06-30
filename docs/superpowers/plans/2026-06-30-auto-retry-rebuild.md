# OptiMow Auto-Retry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Riv bort all gammal OptiMow-funktionalitet och bygg en enkel multi-user-app vars enda jobb är att automatiskt bekräfta bekräftbara klippar-fel och återuppta schemat.

**Architecture:** Server-first. En Supabase Edge Function (`auto-retry-monitor`) körs på cron var 5:e minut, läser klipparstatus från Husqvarna via lagrade tokens, och vid bekräftbart fel anropar `/errors/confirm` följt av `ResumeSchedule`. Ett litet React-admin låter användare logga in med Husqvarna-OAuth, registrera klippare och slå på/av auto-retry. Frontend pratar aldrig direkt med Husqvarna och läser aldrig tabellerna direkt — all data går via Edge Functions.

**Tech Stack:** Vite + React 19 + TypeScript + TailwindCSS v4 (frontend), Supabase Edge Functions (Deno), PostgreSQL + pg_cron + pg_net (Supabase).

## Global Constraints

- Inga TypeScript-fel tillåtna (`npm run build` måste passera).
- Inga Husqvarna-anrop från frontend — allt via Edge Functions.
- Frontend läser/skriver aldrig tabeller direkt — via Edge Functions (`app-api`).
- Edge Functions körs i Deno; delad logik ligger i `supabase/functions/_shared/`.
- Tester för ren logik körs med `deno test`.
- Husqvarna AMC-anrop kräver headers: `Authorization: Bearer <token>`, `Authorization-Provider: husqvarna`, `X-Api-Key: <HUSQVARNA_CLIENT_ID>`, `Content-Type: application/vnd.api+json`.
- `MAX_ATTEMPTS = 3` (max antal retry-försök per fel-tillfälle).
- Cron-intervall: var 5:e minut.
- Frequent commits — varje task slutar med en commit.

---

## File Structure

**Tas bort (teardown):**
- `src/pages/{DashboardPage,NewDashboardPage,EposDataPage,ClockTimePage,AreaCompletionPage}.tsx`
- `src/services/{epos,mower,clockTime}.ts`
- `src/stores/mowerStore.ts`
- `src/components/ui/*` utom `card.tsx`, `badge.tsx` (behålls som byggblock)
- `src/lib/{database.service,database.types}.ts` (ersätts)
- `supabase/functions/{mower-discovery,area-cycle-detector,scheduled-collection,auto-resume-monitor}/`
- `supabase/migrations/20250804_create_area_completion_cycles.sql` och alla andra gamla migrations
- Lösa SQL/patch/bild-filer i repo-roten, `REBUILD_GUIDE.md`, `SYSTEM_DOCUMENTATION.md`, `.claude/agents/info.txt` (läckt nyckel)

**Skapas/skrivs om:**
- `supabase/migrations/<ts>_reset_to_autoretry_schema.sql` — droppar gammalt, skapar 4 tabeller + RLS
- `supabase/migrations/<ts>_schedule_auto_retry_cron.sql` — pg_cron-jobb
- `supabase/functions/_shared/types.ts` — delade typer
- `supabase/functions/_shared/retry-logic.ts` + `.test.ts` — ren beslutsfunktion (TDD-kärna)
- `supabase/functions/_shared/husqvarna.ts` + `.test.ts` — AMC/OAuth-klient + token-expiry-helper
- `supabase/functions/_shared/session.ts` + `.test.ts` — utfärda/verifiera app-session-token (JWT)
- `supabase/functions/husqvarna-oauth-exchange/index.ts` — skrivs om mot nytt schema
- `supabase/functions/auto-retry-monitor/index.ts` — ny monitor
- `supabase/functions/app-api/index.ts` — frontend-gateway (list/discover/register/toggle/log)
- `src/lib/supabase.ts` — behålls (oförändrad)
- `src/lib/api.ts` — ny klient mot `app-api`
- `src/services/auth.ts` — skrivs om (OAuth initiate + callback exchange)
- `src/stores/authStore.ts` — förenklas
- `src/pages/{LoginPage,CallbackPage,DashboardPage}.tsx` — login/callback förenklas, dashboard ny
- `src/App.tsx` — rensad routing

---

### Task 1: Teardown av gammal kod

Tar bort allt som inte hör till auto-retry så att resten av planen byggs på rent bord. Inga tester här; verifieras genom att appen fortfarande typecheckar efter att routing rensats (sker i senare tasks) — här verifierar vi bara att filerna är borta och att inget kvarvarande importerar dem.

**Files:**
- Delete: se "Tas bort" ovan.

- [ ] **Step 1: Ta bort gamla Edge Functions och migrations**

```bash
rm -rf supabase/functions/mower-discovery \
       supabase/functions/area-cycle-detector \
       supabase/functions/scheduled-collection \
       supabase/functions/auto-resume-monitor
rm -f supabase/migrations/*.sql
```

- [ ] **Step 2: Ta bort gamla frontend-sidor, services och store**

```bash
rm -f src/pages/DashboardPage.tsx \
      src/pages/NewDashboardPage.tsx \
      src/pages/EposDataPage.tsx \
      src/pages/ClockTimePage.tsx \
      src/pages/AreaCompletionPage.tsx \
      src/services/epos.ts \
      src/services/mower.ts \
      src/services/clockTime.ts \
      src/stores/mowerStore.ts \
      src/lib/database.service.ts \
      src/lib/database.types.ts
```

- [ ] **Step 3: Ta bort oanvända UI-komponenter (behåll card + badge)**

```bash
cd src/components/ui && \
  find . -type f ! -name 'card.tsx' ! -name 'badge.tsx' -delete && \
  cd -
```

- [ ] **Step 4: Ta bort skräp i repo-roten + läckt nyckel**

```bash
rm -f REBUILD_GUIDE.md SYSTEM_DOCUMENTATION.md \
      deploy_reliable_collection.sh \
      mower_discovery_with_auto_refresh.patch \
      add_current_work_area_id.sql add_is_error_confirmable.sql fix_auto_resume_cron.sql \
      "auth_swagger .yml" \
      .claude/agents/info.txt \
      ./*.png ./*.PNG ./*.jpeg
rm -rf scripts dist
```

- [ ] **Step 5: Verifiera att inga kvarvarande filer importerar det borttagna**

Run: `grep -rEl "mowerStore|database.service|database.types|services/(epos|mower|clockTime)|EposData|AreaCompletion|ClockTime|NewDashboard" src supabase 2>/dev/null || echo "CLEAN"`
Expected: `CLEAN` (App.tsx/authStore fixas i senare tasks; om de listas här är det väntat och åtgärdas i Task 9–11. Notera dem men fortsätt.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: tear down old OptiMow features, keep auth scaffolding"
```

---

### Task 2: Databasschema (nollställ + 4 tabeller + RLS)

Skapar det nya schemat. Tabellerna låses till service-role; anon nekas helt (frontend går via Edge Functions). Migrationen är idempotent vad gäller drop av gamla tabeller.

**Files:**
- Create: `supabase/migrations/20260630090000_reset_to_autoretry_schema.sql`

**Interfaces:**
- Produces: tabellerna `husqvarna_accounts(user_id, access_token, refresh_token, expires_at, created_at, updated_at)`, `mowers(id, user_id, name, auto_retry, created_at)`, `retry_state(mower_id, attempts_this_error, last_error_code, last_attempt_at, needs_manual_help, resolved_at)`, `retry_log(id, mower_id, occurred_at, error_code, outcome)`.

- [ ] **Step 1: Skriv migrationen**

```sql
-- Drop all old OptiMow tables if present
drop table if exists
  epos_session_events, epos_area_completions, epos_mowing_sessions,
  epos_data_snapshots, data_collection_gaps, area_completion_cycles,
  auto_resume_attempts, auto_resume_tracking, mower_profiles, auth_sessions
  cascade;

-- New schema
create table husqvarna_accounts (
  user_id       text primary key,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table mowers (
  id          text primary key,
  user_id     text not null references husqvarna_accounts(user_id) on delete cascade,
  name        text not null,
  auto_retry  boolean not null default true,
  created_at  timestamptz not null default now()
);
create index mowers_user_id_idx on mowers(user_id);

create table retry_state (
  mower_id            text primary key references mowers(id) on delete cascade,
  attempts_this_error int not null default 0,
  last_error_code     int,
  last_attempt_at     timestamptz,
  needs_manual_help   boolean not null default false,
  resolved_at         timestamptz
);

create table retry_log (
  id          bigint generated always as identity primary key,
  mower_id    text not null references mowers(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  error_code  int,
  outcome     text not null
);
create index retry_log_mower_idx on retry_log(mower_id, occurred_at desc);

-- Lock everything down: only service_role (used by Edge Functions) may touch these.
alter table husqvarna_accounts enable row level security;
alter table mowers            enable row level security;
alter table retry_state       enable row level security;
alter table retry_log         enable row level security;
-- No policies created => anon/authenticated get zero access; service_role bypasses RLS.
```

- [ ] **Step 2: Applicera migrationen**

Run: `npx supabase db push`
Expected: migrationen körs utan fel; `husqvarna_accounts`, `mowers`, `retry_state`, `retry_log` finns.

- [ ] **Step 3: Verifiera tabeller**

Run: `npx supabase db push --dry-run` (eller kontrollera i Studio att tabellerna finns och RLS är på)
Expected: inga pending diffs / tabeller syns med RLS aktiverat.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260630090000_reset_to_autoretry_schema.sql
git commit -m "feat(db): reset schema to auto-retry tables with RLS lockdown"
```

---

### Task 3: Ren beslutslogik (`retry-logic.ts`) — TDD-kärna

Hjärtat i appen som en ren funktion utan I/O, så den kan testas uttömmande. Den tar klipparstatus + nuvarande retry-state och returnerar vilket beslut monitorn ska fatta.

**Files:**
- Create: `supabase/functions/_shared/types.ts`
- Create: `supabase/functions/_shared/retry-logic.ts`
- Test: `supabase/functions/_shared/retry-logic.test.ts`

**Interfaces:**
- Produces:
  - `interface MowerState { state: string; errorCode: number; isErrorConfirmable: boolean }`
  - `interface RetryState { attempts_this_error: number; needs_manual_help: boolean }`
  - `type Decision = { kind: "retry" } | { kind: "give_up" } | { kind: "recovered" } | { kind: "skip" }`
  - `function decideRetryAction(mower: MowerState, state: RetryState, maxAttempts: number): Decision`

- [ ] **Step 1: Skriv typerna**

I `supabase/functions/_shared/types.ts`:

```typescript
// Subset of Husqvarna AMC mower status we care about
export interface MowerState {
  state: string;            // PAUSED | RESTRICTED | STOPPED | ERROR | FATAL_ERROR | ...
  errorCode: number;        // 0 when no error
  isErrorConfirmable: boolean;
}

export interface RetryState {
  attempts_this_error: number;
  needs_manual_help: boolean;
}

export type Decision =
  | { kind: "retry" }       // confirm error + ResumeSchedule, then increment attempts
  | { kind: "give_up" }     // max attempts reached -> set needs_manual_help
  | { kind: "recovered" }   // mower left the error state -> reset retry_state
  | { kind: "skip" };       // do nothing this cycle
```

- [ ] **Step 2: Skriv de fallerande testerna**

I `supabase/functions/_shared/retry-logic.test.ts`:

```typescript
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decideRetryAction } from "./retry-logic.ts";
import type { MowerState, RetryState } from "./types.ts";

const MAX = 3;
const healthy: MowerState = { state: "RESTRICTED", errorCode: 0, isErrorConfirmable: false };
const confirmable: MowerState = { state: "ERROR", errorCode: 1, isErrorConfirmable: true };
const fatal: MowerState = { state: "FATAL_ERROR", errorCode: 2, isErrorConfirmable: false };
const fresh: RetryState = { attempts_this_error: 0, needs_manual_help: false };

Deno.test("confirmable error with attempts left -> retry", () => {
  assertEquals(decideRetryAction(confirmable, fresh, MAX), { kind: "retry" });
});

Deno.test("confirmable error at max attempts -> give_up", () => {
  const s: RetryState = { attempts_this_error: 3, needs_manual_help: false };
  assertEquals(decideRetryAction(confirmable, s, MAX), { kind: "give_up" });
});

Deno.test("confirmable error but already needs manual help -> skip", () => {
  const s: RetryState = { attempts_this_error: 3, needs_manual_help: true };
  assertEquals(decideRetryAction(confirmable, s, MAX), { kind: "skip" });
});

Deno.test("fatal error -> give_up (needs human)", () => {
  assertEquals(decideRetryAction(fatal, fresh, MAX), { kind: "give_up" });
});

Deno.test("healthy mower after a prior error -> recovered", () => {
  const s: RetryState = { attempts_this_error: 2, needs_manual_help: false };
  assertEquals(decideRetryAction(healthy, s, MAX), { kind: "recovered" });
});

Deno.test("healthy mower needing manual help -> recovered (clears flag)", () => {
  const s: RetryState = { attempts_this_error: 3, needs_manual_help: true };
  assertEquals(decideRetryAction(healthy, s, MAX), { kind: "recovered" });
});

Deno.test("healthy mower with clean state -> skip", () => {
  assertEquals(decideRetryAction(healthy, fresh, MAX), { kind: "skip" });
});

Deno.test("error present but not confirmable and not fatal -> skip", () => {
  const m: MowerState = { state: "ERROR", errorCode: 5, isErrorConfirmable: false };
  assertEquals(decideRetryAction(m, fresh, MAX), { kind: "skip" });
});
```

- [ ] **Step 3: Kör testerna och se dem falla**

Run: `deno test supabase/functions/_shared/retry-logic.test.ts`
Expected: FAIL — `decideRetryAction` finns inte / modulen saknas.

- [ ] **Step 4: Skriv minimal implementation**

I `supabase/functions/_shared/retry-logic.ts`:

```typescript
import type { MowerState, RetryState, Decision } from "./types.ts";

function hasActiveError(m: MowerState): boolean {
  return m.errorCode > 0 || m.state === "ERROR" || m.state === "FATAL_ERROR" ||
    m.state === "ERROR_AT_POWER_UP";
}

export function decideRetryAction(
  m: MowerState,
  state: RetryState,
  maxAttempts: number,
): Decision {
  // Fatal errors always require a human.
  if (m.state === "FATAL_ERROR") {
    return state.needs_manual_help ? { kind: "skip" } : { kind: "give_up" };
  }

  const confirmable = hasActiveError(m) && m.isErrorConfirmable;

  if (confirmable) {
    if (state.needs_manual_help) return { kind: "skip" };
    if (state.attempts_this_error >= maxAttempts) return { kind: "give_up" };
    return { kind: "retry" };
  }

  // Non-confirmable, non-fatal but STILL in an error state: wait it out,
  // preserving the per-episode attempt budget (do not treat as recovery).
  if (hasActiveError(m)) return { kind: "skip" };

  // Mower is genuinely out of error. If we were mid-episode, it recovered.
  if (state.needs_manual_help || state.attempts_this_error > 0) {
    return { kind: "recovered" };
  }
  return { kind: "skip" };
}
```

- [ ] **Step 5: Kör testerna och se dem passera**

Run: `deno test supabase/functions/_shared/retry-logic.test.ts`
Expected: PASS — alla 8 tester gröna.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/types.ts supabase/functions/_shared/retry-logic.ts supabase/functions/_shared/retry-logic.test.ts
git commit -m "feat(monitor): pure retry decision logic with tests"
```

---

### Task 4: Husqvarna-klient (`husqvarna.ts`)

Tunn I/O-wrapper runt AMC- och OAuth-endpoints, plus en ren `isExpired`-helper som testas. Nätverksanrop testas inte (det görs manuellt end-to-end).

**Files:**
- Create: `supabase/functions/_shared/husqvarna.ts`
- Test: `supabase/functions/_shared/husqvarna.test.ts`

**Interfaces:**
- Consumes: `MowerState` från `types.ts`.
- Produces:
  - `function isExpired(expiresAt: string, nowMs: number, skewSec?: number): boolean`
  - `function amcHeaders(token: string, apiKey: string): HeadersInit`
  - `async function getMowerStatus(token, apiKey, mowerId): Promise<MowerState | null>`
  - `async function confirmError(token, apiKey, mowerId): Promise<boolean>`
  - `async function resumeSchedule(token, apiKey, mowerId): Promise<boolean>`
  - `async function listMowers(token, apiKey): Promise<Array<{ id: string; name: string }>>`
  - `async function refreshAccessToken(clientId, clientSecret, refreshToken): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null>`

- [ ] **Step 1: Skriv det fallerande testet (ren helper)**

I `supabase/functions/_shared/husqvarna.test.ts`:

```typescript
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isExpired } from "./husqvarna.ts";

const now = 1_000_000_000_000; // fixed "now" in ms

Deno.test("token already past expiry is expired", () => {
  const past = new Date(now - 60_000).toISOString();
  assertEquals(isExpired(past, now), true);
});

Deno.test("token far in the future is not expired", () => {
  const future = new Date(now + 3_600_000).toISOString();
  assertEquals(isExpired(future, now), false);
});

Deno.test("token within skew window is treated as expired", () => {
  const soon = new Date(now + 30_000).toISOString(); // 30s left
  assertEquals(isExpired(soon, now, 60), true);       // 60s skew
});
```

- [ ] **Step 2: Kör testet och se det falla**

Run: `deno test supabase/functions/_shared/husqvarna.test.ts`
Expected: FAIL — `isExpired` finns inte.

- [ ] **Step 3: Skriv implementationen**

I `supabase/functions/_shared/husqvarna.ts`:

```typescript
import type { MowerState } from "./types.ts";

const AMC_BASE = "https://api.amc.husqvarna.dev/v1";
const AUTH_BASE = "https://api.authentication.husqvarnagroup.dev/v1";

export function isExpired(expiresAt: string, nowMs: number, skewSec = 60): boolean {
  return new Date(expiresAt).getTime() - skewSec * 1000 <= nowMs;
}

export function amcHeaders(token: string, apiKey: string): HeadersInit {
  return {
    "Authorization": `Bearer ${token}`,
    "Authorization-Provider": "husqvarna",
    "X-Api-Key": apiKey,
    "Content-Type": "application/vnd.api+json",
  };
}

export async function getMowerStatus(
  token: string, apiKey: string, mowerId: string,
): Promise<MowerState | null> {
  const res = await fetch(`${AMC_BASE}/mowers/${mowerId}`, { headers: amcHeaders(token, apiKey) });
  if (!res.ok) return null;
  const body = await res.json();
  const m = body?.data?.attributes?.mower;
  if (!m) return null;
  return {
    state: m.state ?? "",
    errorCode: m.errorCode ?? 0,
    isErrorConfirmable: m.isErrorConfirmable === true,
  };
}

export async function confirmError(token: string, apiKey: string, mowerId: string): Promise<boolean> {
  const res = await fetch(`${AMC_BASE}/mowers/${mowerId}/errors/confirm`, {
    method: "POST", headers: amcHeaders(token, apiKey),
  });
  return res.ok;
}

export async function resumeSchedule(token: string, apiKey: string, mowerId: string): Promise<boolean> {
  const res = await fetch(`${AMC_BASE}/mowers/${mowerId}/actions`, {
    method: "POST", headers: amcHeaders(token, apiKey),
    body: JSON.stringify({ data: { type: "ResumeSchedule" } }),
  });
  return res.ok;
}

export async function listMowers(
  token: string, apiKey: string,
): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch(`${AMC_BASE}/mowers`, { headers: amcHeaders(token, apiKey) });
  if (!res.ok) return [];
  const body = await res.json();
  const data = Array.isArray(body?.data) ? body.data : [];
  return data.map((d: { id: string; attributes?: { system?: { name?: string } } }) => ({
    id: d.id,
    name: d.attributes?.system?.name ?? d.id,
  }));
}

export async function refreshAccessToken(
  clientId: string, clientSecret: string, refreshToken: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const res = await fetch(`${AUTH_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) return null;
  const t = await res.json();
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? refreshToken,
    expires_in: t.expires_in,
  };
}
```

- [ ] **Step 4: Kör testet och se det passera**

Run: `deno test supabase/functions/_shared/husqvarna.test.ts`
Expected: PASS — 3 tester gröna.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/husqvarna.ts supabase/functions/_shared/husqvarna.test.ts
git commit -m "feat(monitor): husqvarna AMC/OAuth client + token expiry helper"
```

---

### Task 5: App-session-token (`session.ts`)

Stateless identitet för frontend: efter OAuth utfärdar vi en signerad HS256-JWT med `user_id`. Data-funktionen `app-api` verifierar den. Ingen extra tabell behövs.

**Files:**
- Create: `supabase/functions/_shared/session.ts`
- Test: `supabase/functions/_shared/session.test.ts`

**Interfaces:**
- Produces:
  - `async function createSessionToken(userId: string, secret: string, ttlSec?: number): Promise<string>`
  - `async function verifySessionToken(token: string, secret: string): Promise<string | null>` (returnerar `user_id` eller `null`)

- [ ] **Step 1: Skriv det fallerande testet**

I `supabase/functions/_shared/session.test.ts`:

```typescript
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createSessionToken, verifySessionToken } from "./session.ts";

const SECRET = "test-secret-please-change";

Deno.test("round-trips the user id", async () => {
  const token = await createSessionToken("user-123", SECRET);
  assertEquals(await verifySessionToken(token, SECRET), "user-123");
});

Deno.test("rejects a token signed with a different secret", async () => {
  const token = await createSessionToken("user-123", SECRET);
  assertEquals(await verifySessionToken(token, "other-secret"), null);
});

Deno.test("rejects garbage", async () => {
  assertEquals(await verifySessionToken("not-a-jwt", SECRET), null);
});
```

- [ ] **Step 2: Kör testet och se det falla**

Run: `deno test supabase/functions/_shared/session.test.ts`
Expected: FAIL — modulen/funktionerna saknas.

- [ ] **Step 3: Skriv implementationen**

I `supabase/functions/_shared/session.ts` (använder `djwt`):

```typescript
import { create, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

async function key(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"],
  );
}

export async function createSessionToken(
  userId: string, secret: string, ttlSec = 60 * 60 * 24 * 7,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  return await create({ alg: "HS256", typ: "JWT" }, { sub: userId, exp }, await key(secret));
}

export async function verifySessionToken(token: string, secret: string): Promise<string | null> {
  try {
    const payload = await verify(token, await key(secret));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Kör testet och se det passera**

Run: `deno test supabase/functions/_shared/session.test.ts`
Expected: PASS — 3 tester gröna.

- [ ] **Step 5: Kör hela testsviten**

Run: `deno test supabase/functions/_shared/`
Expected: PASS — alla tester (retry-logic, husqvarna, session) gröna.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/session.ts supabase/functions/_shared/session.test.ts
git commit -m "feat(auth): stateless app session token (HS256) with tests"
```

---

### Task 6: OAuth-exchange-funktion (skrivs om)

Byter authorization code mot Husqvarna-tokens, sparar dem i `husqvarna_accounts` (keyed på `user_id`), och returnerar en app-session-token till frontend.

**Files:**
- Modify: `supabase/functions/husqvarna-oauth-exchange/index.ts` (ersätt hela innehållet)

**Interfaces:**
- Consumes: `createSessionToken` från `_shared/session.ts`.
- Produces: HTTP `POST { code }` → `{ session_token, user_id }`. Env: `HUSQVARNA_CLIENT_ID`, `HUSQVARNA_CLIENT_SECRET`, `HUSQVARNA_REDIRECT_URI`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_SESSION_SECRET`.

- [ ] **Step 1: Skriv funktionen**

Ersätt hela `supabase/functions/husqvarna-oauth-exchange/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createSessionToken } from "../_shared/session.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const clientId = Deno.env.get("HUSQVARNA_CLIENT_ID")!;
  const clientSecret = Deno.env.get("HUSQVARNA_CLIENT_SECRET")!;
  const redirectUri = Deno.env.get("HUSQVARNA_REDIRECT_URI")!;
  const sessionSecret = Deno.env.get("APP_SESSION_SECRET")!;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { code } = await req.json();
    if (!code) return json({ error: "missing code" }, 400);

    const tokenRes = await fetch(
      "https://api.authentication.husqvarnagroup.dev/v1/oauth2/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      },
    );
    if (!tokenRes.ok) {
      console.error("token exchange failed", tokenRes.status, await tokenRes.text());
      return json({ error: "token exchange failed" }, 400);
    }
    const t = await tokenRes.json();
    const expiresAt = new Date(Date.now() + t.expires_in * 1000).toISOString();

    const { error } = await supabase.from("husqvarna_accounts").upsert({
      user_id: t.user_id,
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error("db upsert failed", error);
      return json({ error: "failed to store account" }, 500);
    }

    const sessionToken = await createSessionToken(t.user_id, sessionSecret);
    return json({ session_token: sessionToken, user_id: t.user_id });
  } catch (e) {
    console.error("oauth exchange error", e);
    return json({ error: "internal error" }, 500);
  }
});
```

- [ ] **Step 2: Verifiera att funktionen typecheckar i Deno**

Run: `deno check supabase/functions/husqvarna-oauth-exchange/index.ts`
Expected: inga typfel.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/husqvarna-oauth-exchange/index.ts
git commit -m "feat(auth): rewrite oauth-exchange for new schema + session token"
```

---

### Task 7: Auto-retry-monitor

Cron-driven funktion som går igenom alla klippare med `auto_retry = true`, fattar beslut via `decideRetryAction`, och utför confirm + ResumeSchedule. Varje klippare körs i egen try/catch. Skyddas av en `CRON_SECRET`-header.

**Files:**
- Create: `supabase/functions/auto-retry-monitor/index.ts`

**Interfaces:**
- Consumes: `decideRetryAction` (retry-logic), `getMowerStatus`/`confirmError`/`resumeSchedule`/`isExpired`/`refreshAccessToken` (husqvarna).
- Produces: HTTP `POST` (header `x-cron-secret`) → `{ processed, results }`. Env: samma som Task 6 plus `CRON_SECRET`.

- [ ] **Step 1: Skriv funktionen**

I `supabase/functions/auto-retry-monitor/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decideRetryAction } from "../_shared/retry-logic.ts";
import {
  confirmError, getMowerStatus, isExpired, refreshAccessToken, resumeSchedule,
} from "../_shared/husqvarna.ts";

const MAX_ATTEMPTS = 3;
const cors = { "Access-Control-Allow-Origin": "*" };
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return json({ error: "forbidden" }, 403);
  }

  const apiKey = Deno.env.get("HUSQVARNA_CLIENT_ID")!;
  const clientSecret = Deno.env.get("HUSQVARNA_CLIENT_SECRET")!;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Mowers with auto_retry on, joined with their account + retry_state.
  const { data: mowers, error } = await supabase
    .from("mowers")
    .select("id, user_id, husqvarna_accounts!inner(access_token, refresh_token, expires_at), retry_state(attempts_this_error, needs_manual_help)")
    .eq("auto_retry", true);
  if (error) return json({ error: error.message }, 500);

  const results: Array<{ mower: string; decision: string }> = [];

  for (const m of mowers ?? []) {
    try {
      const account = (m as unknown as { husqvarna_accounts: { access_token: string; refresh_token: string; expires_at: string } }).husqvarna_accounts;
      const rsRow = (m as { retry_state: { attempts_this_error: number; needs_manual_help: boolean } | { attempts_this_error: number; needs_manual_help: boolean }[] | null }).retry_state;
      const rs = Array.isArray(rsRow) ? rsRow[0] : rsRow;
      const state = { attempts_this_error: rs?.attempts_this_error ?? 0, needs_manual_help: rs?.needs_manual_help ?? false };

      // Refresh token if needed.
      let token = account.access_token;
      if (isExpired(account.expires_at, Date.now())) {
        const refreshed = await refreshAccessToken(apiKey, clientSecret, account.refresh_token);
        if (!refreshed) {
          results.push({ mower: m.id, decision: "auth_failed" });
          continue;
        }
        token = refreshed.access_token;
        await supabase.from("husqvarna_accounts").update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("user_id", m.user_id);
      }

      const status = await getMowerStatus(token, apiKey, m.id);
      if (!status) { results.push({ mower: m.id, decision: "status_unavailable" }); continue; }

      const decision = decideRetryAction(status, state, MAX_ATTEMPTS);
      results.push({ mower: m.id, decision: decision.kind });

      if (decision.kind === "skip") continue;

      if (decision.kind === "recovered") {
        await supabase.from("retry_state").upsert({
          mower_id: m.id, attempts_this_error: 0, needs_manual_help: false,
          resolved_at: new Date().toISOString(), last_error_code: null,
        });
        await supabase.from("retry_log").insert({ mower_id: m.id, error_code: 0, outcome: "recovered" });
        continue;
      }

      if (decision.kind === "give_up") {
        await supabase.from("retry_state").upsert({
          mower_id: m.id, needs_manual_help: true,
          attempts_this_error: state.attempts_this_error, last_error_code: status.errorCode,
        });
        await supabase.from("retry_log").insert({ mower_id: m.id, error_code: status.errorCode, outcome: "gave_up" });
        continue;
      }

      // decision.kind === "retry"
      const confirmed = await confirmError(token, apiKey, m.id);
      if (!confirmed) {
        await supabase.from("retry_log").insert({ mower_id: m.id, error_code: status.errorCode, outcome: "confirm_failed" });
        continue;
      }
      const resumed = await resumeSchedule(token, apiKey, m.id);
      await supabase.from("retry_state").upsert({
        mower_id: m.id,
        attempts_this_error: state.attempts_this_error + 1,
        needs_manual_help: false,
        last_error_code: status.errorCode,
        last_attempt_at: new Date().toISOString(),
        resolved_at: null,
      });
      await supabase.from("retry_log").insert({ mower_id: m.id, error_code: status.errorCode, outcome: resumed ? "confirmed_and_resumed" : "resume_failed" });
    } catch (e) {
      console.error(`mower ${m.id} failed`, e);
      results.push({ mower: m.id, decision: "exception" });
    }
  }

  return json({ processed: results.length, results });
});
```

- [ ] **Step 2: Verifiera att funktionen typecheckar i Deno**

Run: `deno check supabase/functions/auto-retry-monitor/index.ts`
Expected: inga typfel.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/auto-retry-monitor/index.ts
git commit -m "feat(monitor): auto-retry-monitor edge function"
```

---

### Task 8: Cron-schemaläggning

pg_cron-jobb som var 5:e minut POST:ar till `auto-retry-monitor` via pg_net med `CRON_SECRET`-headern. Project ref och secret sätts via SQL-variabler.

**Files:**
- Create: `supabase/migrations/20260630090500_schedule_auto_retry_cron.sql`

- [ ] **Step 1: Skriv migrationen**

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Replace <PROJECT_REF> with the Supabase project ref and <CRON_SECRET> with the configured secret.
select cron.schedule(
  'auto-retry-monitor',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/auto-retry-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 2: Fyll i project ref + secret och applicera**

Ersätt `<PROJECT_REF>` (syns i `supabase/.temp/project-ref`) och `<CRON_SECRET>` (samma värde som sätts i Step 3).
Run: `npx supabase db push`
Expected: jobbet skapas; `select * from cron.job;` visar `auto-retry-monitor`.

- [ ] **Step 3: Sätt Edge Function-secrets**

Run:
```bash
npx supabase secrets set CRON_SECRET="$(openssl rand -hex 24)" \
  APP_SESSION_SECRET="$(openssl rand -hex 32)"
```
(Husqvarna-secrets `HUSQVARNA_CLIENT_ID/SECRET/REDIRECT_URI` ska redan finnas; verifiera med `npx supabase secrets list`. `CRON_SECRET` här måste matcha värdet i migrationen.)
Expected: secrets satta.

- [ ] **Step 4: Deploya funktionerna**

Run: `npx supabase functions deploy auto-retry-monitor husqvarna-oauth-exchange`
Expected: båda deployade.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260630090500_schedule_auto_retry_cron.sql
git commit -m "feat(cron): schedule auto-retry-monitor every 5 minutes"
```

---

### Task 9: Data-gateway-funktion (`app-api`)

Allt frontend behöver: lista registrerade klippare (med state + senaste logg), upptäcka oregistrerade Husqvarna-klippare, registrera, och toggla auto_retry. Validerar app-session-token och scope:ar allt till `user_id`.

**Files:**
- Create: `supabase/functions/app-api/index.ts`

**Interfaces:**
- Consumes: `verifySessionToken` (session), `listMowers`/`isExpired`/`refreshAccessToken` (husqvarna).
- Produces: HTTP `POST { op, ...args }` med header `Authorization: Bearer <session_token>`. Ops:
  - `list` → `{ mowers: Array<{ id, name, auto_retry, state, log: Array<{occurred_at, error_code, outcome}> }> }`
  - `discover` → `{ available: Array<{ id, name }> }` (Husqvarna-klippare ej registrerade)
  - `register { id, name }` → `{ ok: true }`
  - `toggle { id, auto_retry }` → `{ ok: true }`

- [ ] **Step 1: Skriv funktionen**

I `supabase/functions/app-api/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifySessionToken } from "../_shared/session.ts";
import { isExpired, listMowers, refreshAccessToken } from "../_shared/husqvarna.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const sessionSecret = Deno.env.get("APP_SESSION_SECRET")!;
  const apiKey = Deno.env.get("HUSQVARNA_CLIENT_ID")!;
  const clientSecret = Deno.env.get("HUSQVARNA_CLIENT_SECRET")!;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const auth = req.headers.get("Authorization") ?? "";
  const userId = await verifySessionToken(auth.replace(/^Bearer\s+/i, ""), sessionSecret);
  if (!userId) return json({ error: "unauthorized" }, 401);

  // Get a valid Husqvarna access token for this user (refresh if needed).
  async function validToken(): Promise<string | null> {
    const { data: acc } = await supabase.from("husqvarna_accounts")
      .select("access_token, refresh_token, expires_at").eq("user_id", userId).single();
    if (!acc) return null;
    if (!isExpired(acc.expires_at, Date.now())) return acc.access_token;
    const r = await refreshAccessToken(apiKey, clientSecret, acc.refresh_token);
    if (!r) return null;
    await supabase.from("husqvarna_accounts").update({
      access_token: r.access_token, refresh_token: r.refresh_token,
      expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
    return r.access_token;
  }

  try {
    const { op, id, name, auto_retry } = await req.json();

    if (op === "list") {
      const { data: rows } = await supabase.from("mowers")
        .select("id, name, auto_retry, retry_state(needs_manual_help, attempts_this_error)")
        .eq("user_id", userId);
      const mowers = [];
      for (const r of rows ?? []) {
        const { data: log } = await supabase.from("retry_log")
          .select("occurred_at, error_code, outcome")
          .eq("mower_id", r.id).order("occurred_at", { ascending: false }).limit(10);
        const rs = Array.isArray(r.retry_state) ? r.retry_state[0] : r.retry_state;
        mowers.push({
          id: r.id, name: r.name, auto_retry: r.auto_retry,
          needs_manual_help: rs?.needs_manual_help ?? false,
          attempts: rs?.attempts_this_error ?? 0,
          log: log ?? [],
        });
      }
      return json({ mowers });
    }

    if (op === "discover") {
      const token = await validToken();
      if (!token) return json({ error: "no valid husqvarna token" }, 400);
      const all = await listMowers(token, apiKey);
      const { data: existing } = await supabase.from("mowers").select("id").eq("user_id", userId);
      const taken = new Set((existing ?? []).map((e) => e.id));
      return json({ available: all.filter((m) => !taken.has(m.id)) });
    }

    if (op === "register") {
      if (!id || !name) return json({ error: "missing id/name" }, 400);
      const { error } = await supabase.from("mowers").insert({ id, user_id: userId, name, auto_retry: true });
      if (error) return json({ error: error.message }, 400);
      await supabase.from("retry_state").insert({ mower_id: id });
      return json({ ok: true });
    }

    if (op === "toggle") {
      if (!id || typeof auto_retry !== "boolean") return json({ error: "missing id/auto_retry" }, 400);
      const { error } = await supabase.from("mowers")
        .update({ auto_retry }).eq("id", id).eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "unknown op" }, 400);
  } catch (e) {
    console.error("app-api error", e);
    return json({ error: "internal error" }, 500);
  }
});
```

- [ ] **Step 2: Typecheck + deploy**

Run: `deno check supabase/functions/app-api/index.ts && npx supabase functions deploy app-api`
Expected: inga typfel; funktionen deployad.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/app-api/index.ts
git commit -m "feat(api): app-api gateway for frontend (list/discover/register/toggle)"
```

---

### Task 10: Frontend auth (api-klient, service, store, login/callback)

Förenklar auth-flödet: login redirectar till Husqvarna; callback byter code mot session-token via `husqvarna-oauth-exchange` och sparar token. `api.ts` anropar `app-api` med token.

**Files:**
- Create: `src/lib/api.ts`
- Modify: `src/services/auth.ts` (ersätt hela)
- Modify: `src/stores/authStore.ts` (ersätt hela)
- Modify: `src/pages/LoginPage.tsx` (förenkla — byt rubrik/copy)
- Modify: `src/pages/CallbackPage.tsx` (ersätt hela)

**Interfaces:**
- Consumes: env `VITE_HUSQVARNA_CLIENT_ID`, `VITE_HUSQVARNA_REDIRECT_URI`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Produces:
  - `api.call(op, args?)` → Promise<any> (lägger på `Authorization: Bearer <session_token>`)
  - `authStore`: `{ sessionToken, userId, isAuthenticated, initiateOAuth(), completeOAuth(code), logout() }`

- [ ] **Step 1: Skriv api-klienten**

I `src/lib/api.ts`:

```typescript
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export async function callAppApi(op: string, args: Record<string, unknown> = {}) {
  const token = localStorage.getItem("optimow_session");
  const res = await fetch(`${FUNCTIONS_URL}/app-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token ?? ""}`,
      "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ op, ...args }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? `app-api ${op} failed`);
  return res.json();
}

export async function exchangeOAuthCode(code: string): Promise<{ session_token: string; user_id: string }> {
  const res = await fetch(`${FUNCTIONS_URL}/husqvarna-oauth-exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "oauth exchange failed");
  return res.json();
}
```

- [ ] **Step 2: Skriv auth-servicen**

Ersätt hela `src/services/auth.ts`:

```typescript
const AUTH_BASE = "https://api.authentication.husqvarnagroup.dev/v1";

export function buildAuthorizeUrl(): string {
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_HUSQVARNA_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_HUSQVARNA_REDIRECT_URI,
    response_type: "code",
    scope: "iam:read amc:api",
    state: JSON.stringify({ timestamp: Date.now() }),
  });
  return `${AUTH_BASE}/oauth2/authorize?${params.toString()}`;
}
```

- [ ] **Step 3: Skriv authStore**

Ersätt hela `src/stores/authStore.ts`:

```typescript
import { create } from "zustand";
import { buildAuthorizeUrl } from "@/services/auth";
import { exchangeOAuthCode } from "@/lib/api";

interface AuthState {
  sessionToken: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  initiateOAuth: () => void;
  completeOAuth: (code: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  sessionToken: localStorage.getItem("optimow_session"),
  userId: localStorage.getItem("optimow_user"),
  isAuthenticated: !!localStorage.getItem("optimow_session"),

  initiateOAuth: () => { window.location.href = buildAuthorizeUrl(); },

  completeOAuth: async (code: string) => {
    const { session_token, user_id } = await exchangeOAuthCode(code);
    localStorage.setItem("optimow_session", session_token);
    localStorage.setItem("optimow_user", user_id);
    set({ sessionToken: session_token, userId: user_id, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem("optimow_session");
    localStorage.removeItem("optimow_user");
    set({ sessionToken: null, userId: null, isAuthenticated: false });
  },
}));
```

- [ ] **Step 4: Förenkla LoginPage**

Ersätt hela `src/pages/LoginPage.tsx`:

```typescript
import { useAuthStore } from "@/stores/authStore";

export function LoginPage() {
  const initiateOAuth = useAuthStore((s) => s.initiateOAuth);
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4">
      <div className="mx-auto w-full max-w-md bg-white py-8 px-6 shadow rounded-lg text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">OptiMow Auto-Retry</h1>
        <p className="text-sm text-gray-600 mb-8">
          Logga in med Husqvarna så återupptar vi klippningen automatiskt när din
          klippare slirar eller fastnar.
        </p>
        <button
          onClick={initiateOAuth}
          className="w-full py-3 px-4 rounded-md text-sm font-medium text-white bg-orange-600 hover:bg-orange-700"
        >
          Logga in med Husqvarna
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Skriv om CallbackPage**

Ersätt hela `src/pages/CallbackPage.tsx`:

```typescript
import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

export function CallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const completeOAuth = useAuthStore((s) => s.completeOAuth);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    (async () => {
      const code = params.get("code");
      const oauthError = params.get("error");
      if (oauthError) { setError(oauthError); return; }
      if (!code) { setError("Saknar authorization code"); return; }
      try {
        await completeOAuth(code);
        navigate("/", { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Inloggning misslyckades");
      }
    })();
  }, [params, navigate, completeOAuth]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white py-8 px-6 shadow rounded-lg text-center max-w-md w-full">
        {error
          ? <>
              <h2 className="text-lg font-medium text-gray-900 mb-2">Inloggning misslyckades</h2>
              <p className="text-sm text-gray-600 mb-4">{error}</p>
              <button onClick={() => navigate("/login", { replace: true })}
                className="py-2 px-4 rounded-md text-sm text-white bg-orange-600 hover:bg-orange-700">
                Försök igen
              </button>
            </>
          : <p className="text-sm text-gray-600">Loggar in…</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verifiera typecheck**

Run: `npm run build`
Expected: bygget kan fortfarande fela på `App.tsx`/`DashboardPage` (fixas i Task 11). Verifiera att `api.ts`, `auth.ts`, `authStore.ts`, `LoginPage.tsx`, `CallbackPage.tsx` inte har egna typfel (felmeddelanden ska bara röra ännu ej uppdaterade filer).

- [ ] **Step 7: Commit**

```bash
git add src/lib/api.ts src/services/auth.ts src/stores/authStore.ts src/pages/LoginPage.tsx src/pages/CallbackPage.tsx
git commit -m "feat(frontend): husqvarna login + session-token auth flow"
```

---

### Task 11: Dashboard + routing (admin klart)

Den enda inloggade vyn: lista registrerade klippare med på/av-toggle och senaste retry-händelser, plus en knapp för att upptäcka och registrera nya klippare. Rensar `App.tsx` och `ProtectedRoute`.

**Files:**
- Create: `src/pages/DashboardPage.tsx`
- Modify: `src/components/ProtectedRoute.tsx` (ersätt — använd nya store)
- Modify: `src/App.tsx` (ersätt — bara login/callback/dashboard)

**Interfaces:**
- Consumes: `callAppApi` (api.ts), `useAuthStore`.

- [ ] **Step 1: Skriv ProtectedRoute**

Ersätt hela `src/components/ProtectedRoute.tsx`:

```typescript
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}
```

- [ ] **Step 2: Skriv DashboardPage**

I `src/pages/DashboardPage.tsx`:

```typescript
import { useEffect, useState, useCallback } from "react";
import { callAppApi } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

interface LogEntry { occurred_at: string; error_code: number; outcome: string }
interface Mower {
  id: string; name: string; auto_retry: boolean;
  needs_manual_help: boolean; attempts: number; log: LogEntry[];
}
interface Available { id: string; name: string }

export function DashboardPage() {
  const logout = useAuthStore((s) => s.logout);
  const [mowers, setMowers] = useState<Mower[]>([]);
  const [available, setAvailable] = useState<Available[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { mowers } = await callAppApi("list");
      setMowers(mowers);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte hämta klippare");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const discover = async () => {
    const { available } = await callAppApi("discover");
    setAvailable(available);
  };
  const register = async (m: Available) => {
    await callAppApi("register", { id: m.id, name: m.name });
    setAvailable((a) => a.filter((x) => x.id !== m.id));
    await load();
  };
  const toggle = async (m: Mower) => {
    await callAppApi("toggle", { id: m.id, auto_retry: !m.auto_retry });
    await load();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">OptiMow Auto-Retry</h1>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700 underline">
            Logga ut
          </button>
        </div>

        {error && <div className="rounded-md bg-red-50 p-3 mb-4 text-sm text-red-700">{error}</div>}

        {loading ? <p className="text-sm text-gray-600">Laddar…</p> : (
          <div className="space-y-4">
            {mowers.length === 0 && <p className="text-sm text-gray-600">Inga registrerade klippare ännu.</p>}
            {mowers.map((m) => (
              <div key={m.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{m.name}</div>
                    {m.needs_manual_help && (
                      <div className="text-xs text-red-600 mt-1">Behöver manuell hjälp (gav upp efter {m.attempts} försök)</div>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    Auto-retry
                    <input type="checkbox" checked={m.auto_retry} onChange={() => toggle(m)} className="h-4 w-4" />
                  </label>
                </div>
                {m.log.length > 0 && (
                  <ul className="mt-3 border-t pt-2 text-xs text-gray-500 space-y-1">
                    {m.log.map((l, i) => (
                      <li key={i} className="flex justify-between">
                        <span>{new Date(l.occurred_at).toLocaleString("sv-SE")}</span>
                        <span>{l.outcome}{l.error_code ? ` (kod ${l.error_code})` : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-8">
          <button onClick={discover} className="text-sm py-2 px-4 rounded-md text-white bg-orange-600 hover:bg-orange-700">
            Hitta nya klippare
          </button>
          {available.length > 0 && (
            <ul className="mt-3 space-y-2">
              {available.map((m) => (
                <li key={m.id} className="flex items-center justify-between bg-white rounded-md shadow px-4 py-2">
                  <span className="text-sm text-gray-900">{m.name}</span>
                  <button onClick={() => register(m)} className="text-sm text-orange-600 hover:underline">
                    Registrera
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rensa App.tsx**

Ersätt hela `src/App.tsx`:

```typescript
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { queryClient } from "./lib/queryClient";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { CallbackPage } from "./pages/CallbackPage";
import { DashboardPage } from "./pages/DashboardPage";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<CallbackPage />} />
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
```

- [ ] **Step 4: Verifiera bygget**

Run: `npm run build`
Expected: PASS — inga TypeScript-fel, bygget lyckas.

- [ ] **Step 5: Commit**

```bash
git add src/pages/DashboardPage.tsx src/components/ProtectedRoute.tsx src/App.tsx
git commit -m "feat(frontend): admin dashboard (register, toggle, retry log) + routing"
```

---

### Task 12: End-to-end-verifiering (manuell)

Slutkontroll mot riktig Husqvarna-klippare. Inga automatiska tester — detta dokumenterar verifieringsstegen.

- [ ] **Step 1: Verifiera hela testsviten**

Run: `deno test supabase/functions/_shared/`
Expected: PASS — alla enhetstester gröna.

- [ ] **Step 2: Verifiera frontend-bygget**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Logga in och registrera**

Kör `npm run dev`, gå till appen, "Logga in med Husqvarna", godkänn. Klicka "Hitta nya klippare" → "Registrera" din klippare. Verifiera att den dyker upp med auto-retry på.

- [ ] **Step 4: Framtvinga bekräftbart fel**

Skapa ett bekräftbart fel på klipparen (t.ex. lyft/stoppa den så den hamnar i ett confirmable error). Vänta ≤5 min (eller anropa funktionen manuellt med `x-cron-secret`).
Run: `curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/auto-retry-monitor -H "x-cron-secret: <CRON_SECRET>"`
Expected: svar visar `decision: "retry"` för klipparen; klipparen återupptar klippning; `retry_log` får `confirmed_and_resumed`.

- [ ] **Step 5: Verifiera give-up och recovery**

Låt ett bekräftbart fel kvarstå över ≥3 cron-körningar → verifiera `gave_up` i loggen och `needs_manual_help` i dashboarden. Lös felet fysiskt → vid nästa körning ska `recovered` loggas och flaggan nollställas.

---

## Anteckningar för genomförande

- **Designavvikelse från spec:** Frontend läser inte tabeller direkt med RLS-per-rad (spec sektion "Databasschema"). Istället går allt via `app-api` med en app-utfärdad session-token, och tabellerna är låsta till service-role. Detta beror på att "logga in med Husqvarna" innebär att vi inte har en Supabase-Auth-JWT i frontend. Samma säkerhetsintention uppnås (man ser bara sina egna klippare).
- **Secrets som måste finnas i Supabase:** `HUSQVARNA_CLIENT_ID`, `HUSQVARNA_CLIENT_SECRET`, `HUSQVARNA_REDIRECT_URI`, `APP_SESSION_SECRET`, `CRON_SECRET`.
- **`HUSQVARNA_REDIRECT_URI`** måste matcha den registrerade redirect-URI:n i Husqvarna Developer Portal och peka på `/auth/callback` i frontend.
