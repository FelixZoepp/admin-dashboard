# Content Leads — Admin Dashboard

Realtime Dashboard für Sales (Close CRM), Fulfillment (Monday.com), Finanzen
(Easybill + Qonto), Marketing (Meta Ads, Instagram, LinkedIn) und Coaching-Kunden.

**Stack**: Next.js 15 · Supabase (Postgres + Edge Functions + Auth + Cron) · Tailwind · Vercel

---

## Architektur

```
┌──────────────┐     ┌────────────────────┐     ┌───────────────┐
│   Vercel     │◄────┤  Supabase Postgres │◄────┤ Edge Functions│
│  (Next.js)   │     │  (RLS + Views)     │     │  (Deno ETL)   │
└──────┬───────┘     └────────┬───────────┘     └───────┬───────┘
       │                      │                         │
       │   Auth (Magic Link)  │  pg_cron @ 06:00 UTC    │
       │                      │                         ▼
       │                      │              Close · Monday · Easybill
       │                      │              Qonto · Meta · IG · LinkedIn
       ▼
  Browser (Admin + Share-Links)
```

---

## Setup (einmalig)

### 1. Repository klonen & Abhängigkeiten

```bash
git clone git@github.com:FelixZoepp/admin-dashboard.git
cd admin-dashboard
npm install
cp .env.example .env.local
```

### 2. Supabase Projekt vorbereiten

Projekt-Ref: `imdcuumthauvrfhghqtz`

```bash
npx supabase login
npx supabase link --project-ref imdcuumthauvrfhghqtz
npx supabase db push                   # migrations anwenden
npx supabase functions deploy          # alle Edge Functions deployen
```

Danach im Supabase Dashboard unter **Project Settings → Edge Functions → Secrets**
die API-Keys eintragen (siehe `.env.example` für die Variablen-Namen).

Zusätzlich einmalig in der SQL-Konsole:

```sql
alter database postgres set "app.settings.supabase_url"
    to 'https://imdcuumthauvrfhghqtz.supabase.co';
alter database postgres set "app.settings.service_role_key"
    to '<service-role-key>';
```

### 3. Vercel

1. `vercel` → Projekt aus Repo importieren (Region Frankfurt `fra1`)
2. Env-Variablen aus `.env.example` eintragen (nur Public + Service Role + Share Secret)
3. Deploy

### 4. Auth-Whitelist

Supabase Dashboard → Authentication → Users → nur deine Email manuell anlegen
(in `config.toml` ist `enable_signup = false`).

---

## Integrationen

| Source        | Secrets                                     | Scope                                    |
|---------------|---------------------------------------------|------------------------------------------|
| Close CRM     | `CLOSE_API_KEY`                             | Leads, Opportunities, Activities         |
| Instantly     | `INSTANTLY_API_KEY`                         | E-Mail-Kampagnen, Leads, Daily Metrics   |
| Monday.com    | `MONDAY_API_TOKEN`, `MONDAY_BOARD_IDS`      | Fulfillment Items per Board              |
| Easybill      | `EASYBILL_API_KEY`                          | Rechnungen                               |
| Qonto         | `QONTO_LOGIN`, `QONTO_SECRET_KEY`           | Konten + Transaktionen                   |
| Commerzbank   | —                                           | CSV-Upload (kein REST-API verfügbar)     |
| Meta Ads      | `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`   | Campaigns + Daily Insights               |
| Instagram     | `IG_ACCESS_TOKEN`, `IG_BUSINESS_ACCOUNT_ID` | Account Stats + Posts + Insights         |
| LinkedIn      | `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_ORG_URN` | Followers + Page/Share Statistics        |
| Perspective   | `PERSPECTIVE_API_KEY`                       | Funnels + Daily Analytics (Views/Leads/CVR) |
| OnePage       | `ONEPAGE_API_KEY`, `ONEPAGE_API_BASE`       | Landing Pages + Daily Analytics          |
| CopeCart      | `COPECART_API_KEY`                          | Produkte + Sales + Refunds               |
| Clockify      | `CLOCKIFY_API_KEY`, `CLOCKIFY_WORKSPACE_ID` | Zeiterfassung pro Kunde + Mitarbeiter    |
| Airtable      | `AIRTABLE_API_KEY`                          | Bidirektional: Pull manueller Daten + Push von Leads/Deals/Applications |
| Coaching      | —                                           | Form-Einreichung direkt in Supabase      |
| Recruiting    | —                                           | Form-Einreichung direkt in Supabase      |

Alle Syncs laufen als **Supabase Edge Functions** (Deno) unter
`supabase/functions/sync-*`. `pg_cron` ruft täglich `sync-all` auf.

### Manuellen Sync auslösen

```bash
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  https://imdcuumthauvrfhghqtz.supabase.co/functions/v1/sync-close
```

---

## Lokale Entwicklung

```bash
npm run dev              # Next.js auf http://localhost:3000
npm run typecheck        # TypeScript strict check
npm run db:diff          # Schema-Diff gegen linked project
npm run db:push          # Migrations anwenden
```

---

## Client Profitability (Kunden-Tab)

Pro Social-Media-Kunde wird alles zusammengeführt:

- **Umsatz**: aus `contracts` (Retainer monthly_value → MRR/ARR)
- **Arbeitszeit**: aus `time_entries` (Clockify-Sync oder manuell via Airtable) — jeder Mitarbeiter hat einen Stundensatz (`hourly_cost`), daraus ergeben sich die Lohnkosten pro Kunde
- **Delivery-Kosten**: aus `delivery_costs` (z.B. Nils fürs Filming, Requisiten, Paid Ads pro Kunden-Konto) mit Kategorie + Belegnummer
- **Marge**: MRR − Lohnkosten − Delivery-Kosten
- **ROI-Multiple**: MRR / Gesamtkosten
- **€ pro Stunde**: effektiver Stundensatz (MRR / Stunden)
- **Stunden pro Post**: Arbeits-Aufwand je Deliverable
- **Signal-Badge**: Top (>50 % Marge) / OK (25–50 %) / Schwach (0–25 %) / Minus (< 0 %)

So siehst du auf einen Blick **wo du extrem Plus machst und wo du drauflegst**.

## Finanzamt-Export

`/api/export/tax?from=2026-01-01&to=2026-12-31` liefert ein CSV mit:
- Alle Einnahmen (Easybill-Rechnungen + manuelle Einnahmen)
- Alle Ausgaben (Delivery-Kosten pro Kunde, manuelle Ausgaben, Recruiting-Kosten)
- Jeweils mit Datum, Beleg-Nr., Gegenpartei, Kategorie, Betrag, Währung, Notiz

Direkt an den Steuerberater weiterleiten oder in DATEV/Elster importieren.

## Features

- **Overview**: Realtime KPIs aller Bereiche (Cash, Outreach, Team) + Integration Status
- **Kunden**: Profitabilität pro Kunde (MRR, Stunden, Lohn- + Delivery-Kosten, Marge, ROI, €/h, Posts, h/Post), Top/Bottom-3, Team-Stunden pro Monat, Delivery-Kosten-Ledger
- **Airtable**: Bi-direktionale Sync-Steuerung (Pull/Push Toggle), manuelle Finanz-KPIs, Ausgaben/Einnahmen-Listen
- **Sales**: detaillierter Funnel (Anwahlen → CC → Setting → Closing → Angebot → No Show → Won), Wochentrend, Won Deals, Pipeline nach Stage/Quelle, **Quoten pro Rolle** (Opener / Setter / Closer / Full-Cycle) mit CC-/Quali-/Closing-Rate, Performance pro Person, Leads nach Status
- **Outreach**: Instantly E-Mail-KPIs, Kampagnen, Close-Lead-Status, Cashflow MTD mit Ein-/Ausgängen pro Bank, offene Rechnungen
- **Recruiting**: Bewerbungen-Funnel (Bewerbung → Screening → Interview → Probetag → Angebot → Hire), offene Stellen, Kostenstruktur, Cost-per-Trial + Cost-per-Hire, Formulare für Bewerbungen und Kosten
- **Fulfillment**: Tägliche Produktivität, Wochentrend, Kategorien
- **Marketing**: Meta Ads, LinkedIn, Instagram, **Perspective-Funnels** (Views/Leads/CVR pro Funnel), **OnePage Landing Pages**, **CopeCart** (Produkt-Sales + Refunds)
- **Finanzen**: Cashflow mit Ein-/Ausgängen pro Bank (Qonto + Commerzbank), Umsatz MTD, offene RG, Monatsverlauf
- **Team**: Monday Boards, Auslastung pro Person
- **Coaching**: Kunden-Einreichungen (Umsatz, Leads, Calls, Closes)
- **Export**: CSV je Tab, PDF via Browser-Print
- **Share**: signierte Read-only Links (bis 30 Tage TTL)

---

## Sicherheit

- Alle Tabellen mit **RLS** — nur authentifizierte User lesen, Service Role schreibt.
- `middleware.ts` erzwingt Login auf allen Routen außer `/login`, `/share/*`, `/auth/callback`.
- Share-Tokens sind HMAC-signiert (kein DB-Lookup, Revocation via Secret-Rotation).
- Secrets **nie** im Repo — ausschließlich in Vercel Env + Supabase Vault.

---

## Branch

Aktive Entwicklung auf `claude/build-crm-dashboard-lLqVF`.
