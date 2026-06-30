# Deploy-runbook — OptiMow Auto-Retry

Alla kodsteg är klara, testade och granskade på branchen `feat/auto-retry-rebuild`. Det här
dokumentet samlar de live-beroende stegen som sköts upp under bygget (det gamla Supabase-projektet
var pausat/oåterställbart, så vi skapar ett nytt). Kör stegen i ordning.

## 0. Förutsättningar
- Inloggad i Supabase-CLI på rätt konto: `npx supabase login`
- Husqvarna Developer-konto med en Application (Client ID + Client Secret)

## 1. Skapa nytt Supabase-projekt
1. Skapa ett nytt projekt i dashboarden (t.ex. `optimow-autoretry`, region West EU).
2. Notera **Project ref**, **anon key**, **service_role key** (Settings → API).

## 2. Länka projektet lokalt
```bash
npx supabase link --project-ref <NEW_PROJECT_REF>
```

## 3. Generera och sätt secrets
Generera CRON_SECRET och APP_SESSION_SECRET en gång — CRON_SECRET måste matcha värdet i
cron-migrationen (steg 4).
```bash
CRON_SECRET="$(openssl rand -hex 24)"
APP_SESSION_SECRET="$(openssl rand -hex 32)"
echo "CRON_SECRET=$CRON_SECRET"   # spara detta — används i steg 4

npx supabase secrets set \
  HUSQVARNA_CLIENT_ID="<husqvarna_client_id>" \
  HUSQVARNA_CLIENT_SECRET="<husqvarna_client_secret>" \
  HUSQVARNA_REDIRECT_URI="<frontend_url>/auth/callback" \
  APP_SESSION_SECRET="$APP_SESSION_SECRET" \
  CRON_SECRET="$CRON_SECRET"
```
Verifiera: `npx supabase secrets list`

## 4. Fyll i cron-migrationens placeholders
Migrationen `supabase/migrations/20260630090500_schedule_auto_retry_cron.sql` innehåller
`<PROJECT_REF>` och `<CRON_SECRET>`. Ersätt dem med projektets ref respektive CRON_SECRET från
steg 3 **innan** du pushar (annars schemaläggs jobbet med literal-placeholder och 403:ar).

## 5. Applicera migrationerna (skapar schema + cron-jobb)
```bash
npx supabase db push
```
Verifiera: 4 tabeller finns med RLS på; `select * from cron.job;` visar `auto-retry-monitor`.

## 6. Deploya Edge Functions
```bash
npx supabase functions deploy auto-retry-monitor husqvarna-oauth-exchange app-api
```

## 7. Frontend-env
Uppdatera `.env` (skapas lokalt, är gitignored):
```
VITE_SUPABASE_URL=https://<NEW_PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
VITE_HUSQVARNA_CLIENT_ID=<husqvarna_client_id>
VITE_HUSQVARNA_REDIRECT_URI=<frontend_url>/auth/callback
```

## 8. Husqvarna Developer Portal
- Lägg till redirect-URI som exakt matchar `VITE_HUSQVARNA_REDIRECT_URI` (`.../auth/callback`).
- Aktivera **Authentication API** och **Automower Connect API** för applikationen.

## 9. End-to-end-verifiering (Task 12)
1. `npm run dev`, gå till appen, "Logga in med Husqvarna", godkänn.
2. "Hitta nya klippare" → "Registrera" din klippare. Den ska visas med auto-retry på.
3. Framtvinga ett bekräftbart fel på klipparen (lyft/stoppa den). Vänta ≤5 min, eller trigga manuellt:
   ```bash
   curl -X POST https://<NEW_PROJECT_REF>.supabase.co/functions/v1/auto-retry-monitor \
     -H "x-cron-secret: $CRON_SECRET"
   ```
   Förväntat: svaret visar `decision: "retry"`; klipparen återupptar; `retry_log` får
   `confirmed_and_resumed` (eller `resume_failed` om resume-anropet nekades).
4. Låt felet kvarstå ≥3 cron-körningar → `gave_up` loggas och dashboarden visar
   "Behöver manuell hjälp". Lös felet fysiskt → nästa körning loggar `recovered`.

## Öppet beslut (från slut-reviewn)
`app-api` `register` verifierar inte att klippar-ID:t hör till den inloggade användarens
Husqvarna-konto (planen sköt upp detta medvetet). Risk: en användare kan registrera ett
klippar-ID som tillhör någon annans konto (PK-konflikt låser då ut den rätta ägaren). Lågt i en
liten betrodd användarkrets, men inför publik åtkomst bör `register` anropa `listMowers` och
bekräfta att ID:t finns i anroparens upptäckta klippare innan insert. Beslut innan publik drift.
