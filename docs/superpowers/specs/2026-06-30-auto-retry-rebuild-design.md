# OptiMow Auto-Retry — Designspec

**Datum:** 2026-06-30
**Status:** Godkänd design, redo för implementationsplan

## Bakgrund

OptiMow v3 byggdes ursprungligen som en omfattande övervakningsapp för Husqvarna-klippare
(EPOS-datainsamling, sessionsanalys, area-completion, dashboards, charts). Ingen använder
den och hela den funktionaliteten rivs.

Den nya appen har **en enda funktion**: automatisera den "retry" man annars gör manuellt i
Husqvarnas officiella app när en klippare slirat eller fastnat. I officiella appen klickar
man retry och väljer att fortsätta klippa enligt schema. Vi automatiserar exakt det.

## Mål

När en registrerad klippare hamnar i ett **bekräftbart felläge** (Husqvarna-API:t sätter
`isErrorConfirmable: true`), ska appen automatiskt:

1. Bekräfta felet — `POST /v1/mowers/{id}/errors/confirm`
2. Återuppta schema — `POST /v1/mowers/{id}/actions` med `{ data: { type: "ResumeSchedule" } }`

…utan någon inblandning från användaren.

## Icke-mål (rivs helt)

EPOS-datainsamling, `epos_*`-tabeller, snapshots, sessionsanalys, area-completion-cykler,
alla charts och dashboards, samt alla Edge Functions och migrations utom de auth-byggstenar
som anges nedan.

## Arkitektur

Server-first behålls som princip: klienten gör **aldrig** Husqvarna-anrop — allt går via
Supabase Edge Functions.

```
[Admin-UI (React)]  → logga in, registrera klippare, toggle på/av, se senaste retry-händelser
        │  (läser bara från databasen + triggar OAuth-redirect)
        ▼
[Supabase]
   ├── Auth: "Logga in med Husqvarna" (OAuth authorization_code → user_id + tokens lagras)
   ├── DB-tabeller (4 st)
   └── Edge Functions:
        ├── husqvarna-oauth-exchange   (återanvänds — byter code mot tokens)
        ├── husqvarna-token-refresh    (återanvänds — håller tokens färska)
        └── auto-retry-monitor         (NY — ersätter auto-resume-monitor; cron var 5:e min)
```

**Infrastruktur:** Befintligt Supabase-projekt återanvänds (Husqvarna-OAuth-appen är redan
registrerad där), men databasschemat nollställs helt.

**Inloggning:** "Logga in med Husqvarna" via Husqvarnas egen OAuth. Token-svaret innehåller
`user_id` som blir användarens identitet — inget separat lösenord att hantera.

**Detektion:** Polling på cron (var 5:e min). Realtids-WebSocket valdes bort eftersom det
kräver en ständigt uppkopplad process, vilket inte passar en ren Supabase-cron-arkitektur.
Några minuters fördröjning innan retry är acceptabelt.

## Databasschema

Allt gammalt schema droppas. Fyra nya tabeller:

```
husqvarna_accounts          # en rad per inloggad användare
  user_id        text  PK   # från Husqvarna OAuth (user_id i token-svaret)
  access_token   text
  refresh_token  text
  expires_at     timestamptz
  created_at / updated_at

mowers                      # klippare användaren valt att registrera
  id            text  PK    # Husqvarnas mower-id
  user_id       text  FK → husqvarna_accounts
  name          text        # för UI
  auto_retry    bool        # på/av-toggle
  created_at

retry_state                 # löpande tillstånd per klippare (1:1 med mowers)
  mower_id            text  PK  FK → mowers
  attempts_this_error int        # nollställs när felet försvinner
  last_error_code     int
  last_attempt_at     timestamptz
  needs_manual_help   bool        # sätts när max-försök nåtts → appen vilar
  resolved_at         timestamptz

retry_log                   # historik som UI:t visar
  id           bigint PK
  mower_id     text  FK
  occurred_at  timestamptz
  error_code   int
  outcome      text          # 'confirmed_and_resumed' | 'confirm_failed' | 'gave_up' | 'recovered'
```

**RLS:** användare ser bara sina egna rader. Edge Functions använder service-role och
kringgår RLS.

## Retry-logik (auto-retry-monitor, cron var 5:e min)

Konstant: `MAX_ATTEMPTS = 3`.

För varje klippare med `auto_retry = true`:

1. Hämta status från Husqvarna (via lagrad token; refresha vid behov).
2. **Inget fel / inget bekräftbart fel:** om `needs_manual_help` eller `attempts_this_error > 0`
   var satt → nollställ `retry_state` (klipparen har återhämtat sig), logga `recovered`. Klart.
3. **Bekräftbart fel** (`errorCode` satt + `isErrorConfirmable: true`):
   - Om `needs_manual_help = true` → hoppa över (appen vilar tills felet försvinner).
   - Om `attempts_this_error >= MAX_ATTEMPTS` → sätt `needs_manual_help = true`, logga `gave_up`.
   - Annars → `POST /errors/confirm`, sedan `POST /actions {ResumeSchedule}`.
     Öka `attempts_this_error`, sätt `last_attempt_at`,
     logga `confirmed_and_resumed` (eller `confirm_failed` om confirm misslyckades).
4. **Fatalt fel** (`FATAL_ERROR`, ej bekräftbart) → rör inte; sätt `needs_manual_help`, logga.
   Kräver människa.

**Nyckeldetalj:** `attempts_this_error` nollställs först när klipparen lämnat felläget. Så
"max 3 försök, sen vila" gäller per fel-tillfälle, inte globalt. Cron-intervallet (5 min) ger
naturlig cooldown mellan försöken.

## Felhantering

Monitorn ska aldrig krascha hela körningen:

- En klippare per iteration i try/catch — fel på en klippare stoppar inte de andra.
- Token utgången → refresha först; om refresh misslyckas (användaren har avregistrerat appen
  hos Husqvarna) → markera kontot, hoppa över, logga. Ingen retry-loop på trasig auth.
- Husqvarna-API nere / 429 / 5xx → logga och avbryt mjukt; nästa cron-körning tar nya tag.
  Ingen retry-storm.

## Säkerhet

- Tokens lagras serverside, exponeras aldrig i frontend.
- RLS så att användare bara ser sina egna klippare/loggar.
- `.env` med klient-hemligheter rensas och sätts som Supabase-secrets.
- Den läckta anon-nyckeln i `.claude/agents/info.txt` tas bort i städningen.

## Testning

- Edge Function-logik testas mot **mockade** Husqvarna-svar (fixtures för: bekräftbart fel,
  fatalt fel, friskt läge, token-utgång). Inga riktiga API-anrop i testerna.
- Verifiera retry-räknaren: 3 försök → `gave_up`; därefter "fel borta" → `recovered` nollställer.
- Manuell end-to-end: registrera riktig klippare, framtvinga ett bekräftbart fel, se att den
  återupptar.

## Relevanta API-detaljer (verifierade mot swagger)

- `GET /v1/mowers/{id}` → `attributes.mower.{state, errorCode, isErrorConfirmable}`.
  `state`-enum inkluderar `RESTRICTED`, `STOPPED`, `ERROR`, `FATAL_ERROR`, `ERROR_AT_POWER_UP`.
- `POST /v1/mowers/{id}/errors/confirm` — bekräftar icke-fatalt fel. Lyckas bara om felet är
  bekräftbart. Stöds av EPOS-modeller m.fl.
- `POST /v1/mowers/{id}/actions` med `{ data: { type: "ResumeSchedule" } }` — återuppta schema.
- Auth: `POST https://api.authentication.husqvarnagroup.dev/v1/oauth2/token`, svar innehåller
  `access_token`, `refresh_token`, `expires_in`, `user_id`.
- Alla mower-anrop kräver headers: `Authorization: Bearer <token>`, `Authorization-Provider: husqvarna`,
  `X-Api-Key: <client_id>`, `Content-Type: application/vnd.api+json`.
