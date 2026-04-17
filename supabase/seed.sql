-- =============================================================
-- DEMO SEED DATA — nur für lokales Testen / Staging
-- Führe das manuell aus:
--   npx supabase db reset   (zieht migrations + seed.sql)
-- oder:
--   psql $DATABASE_URL -f supabase/seed.sql
-- In Produktion NICHT ausführen.
-- =============================================================

-- Team members
insert into team_members (id, name, email, role, hourly_cost) values
  (gen_random_uuid(), 'Felix',  'felix@contentleads.de',  'lead',   80),
  (gen_random_uuid(), 'Lisa',   'lisa@contentleads.de',   'va',     35),
  (gen_random_uuid(), 'Nils',   'nils@contentleads.de',   'video',  45)
on conflict (name) do nothing;

-- Clients
with ins as (
    insert into clients (name, status, account_manager, onboarded_at) values
        ('Walter GmbH',     'active', 'Felix', now()::date - 120),
        ('Müller Coaching', 'active', 'Felix', now()::date - 80),
        ('Berg & Tal',      'active', 'Nils',  now()::date - 60),
        ('Studio Neun',     'active', 'Nils',  now()::date - 30)
    on conflict do nothing
    returning id, name
)
insert into contracts (client_id, name, type, monthly_value, hours_included, hourly_rate, posts_per_month, starts_on)
select id, name || ' Retainer', 'retainer',
       case name
           when 'Walter GmbH'     then 2990
           when 'Müller Coaching' then 1490
           when 'Berg & Tal'      then 3990
           when 'Studio Neun'     then  990
       end,
       case name when 'Walter GmbH' then 30 when 'Berg & Tal' then 40 else 15 end,
       150,
       case name when 'Walter GmbH' then 12 when 'Berg & Tal' then 15 when 'Müller Coaching' then 8 else 4 end,
       now()::date - 60
from ins;

-- Time entries (spread over the last 20 days)
insert into time_entries (id, client_id, member_id, member_name, description, started_at, ended_at, duration_seconds, billable, hourly_cost, source)
select
    'seed-te-' || md5(c.name || m.name || g)::text,
    c.id, m.id, m.name,
    'Content production',
    now() - (g || ' days')::interval - (random() * 4 || ' hours')::interval,
    now() - (g || ' days')::interval,
    (1800 + floor(random() * 7200))::int,
    true, m.hourly_cost, 'manual'
from clients c
cross join team_members m
cross join generate_series(0, 19) g
where random() < 0.5
on conflict do nothing;

-- Delivery costs
insert into delivery_costs (client_id, category, description, amount, incurred_at)
select c.id, 'filming', 'Kamera-Tag', (150 + floor(random() * 300))::numeric, now()::date - (floor(random() * 25))::int
from clients c, generate_series(1, 3);

insert into delivery_costs (client_id, category, description, amount, incurred_at)
select c.id, 'ad_spend', 'Meta-Kampagne', (80 + floor(random() * 250))::numeric, now()::date - (floor(random() * 25))::int
from clients c, generate_series(1, 2);

-- Deliverables
insert into deliverables (client_id, type, title, status, channel, published_at)
select c.id,
       (array['post','reel','story','video'])[floor(random() * 4 + 1)],
       'Content #' || g,
       (array['published','published','published','in_progress','planned'])[floor(random() * 5 + 1)],
       (array['instagram','linkedin','tiktok'])[floor(random() * 3 + 1)],
       case when random() > 0.3 then now() - (floor(random() * 25) || ' days')::interval else null end
from clients c, generate_series(1, 8) g;

-- Invoices (mix paid / open / overdue)
insert into invoices (id, number, customer_name, total, net, vat, status, invoice_date, due_date, paid_at, currency)
values
  ('seed-1', 'RG-2026-001', 'Walter GmbH',     3500.00, 2941.18, 558.82, 'paid',    now()::date - 15, now()::date - 1,  now()::date - 2, 'EUR'),
  ('seed-2', 'RG-2026-002', 'Müller Coaching', 1772.10, 1489.16, 282.94, 'paid',    now()::date - 10, now()::date + 4,  now()::date - 3, 'EUR'),
  ('seed-3', 'RG-2026-003', 'Berg & Tal',      4748.10, 3990.00, 758.10, 'paid',    now()::date - 8,  now()::date + 6,  now()::date - 1, 'EUR'),
  ('seed-4', 'RG-2026-004', 'Studio Neun',     1178.10,  990.00, 188.10, 'open',    now()::date - 3,  now()::date + 11, null, 'EUR'),
  ('seed-5', 'RG-2026-005', 'Walter GmbH',     3500.00, 2941.18, 558.82, 'overdue', now()::date - 25, now()::date - 10, null, 'EUR')
on conflict (id) do nothing;

-- Bank accounts + transactions (Qonto + Commerzbank)
insert into bank_accounts (id, name, iban, balance, currency, institution, source) values
  ('seed-acc-qonto',  'Qonto Hauptkonto', 'DE89 3704 0044 0532 0130 00', 24850.50, 'EUR', 'qonto',       'api'),
  ('seed-acc-cobank', 'Commerzbank',      'DE27 1005 0000 0024 2908 33',  8120.33, 'EUR', 'commerzbank', 'csv')
on conflict (id) do nothing;

insert into bank_transactions (id, account_id, institution, amount, currency, label, counterparty, category, tx_date, settled_at, direction)
select
    'seed-tx-' || g,
    (array['seed-acc-qonto','seed-acc-cobank'])[floor(random() * 2 + 1)],
    (array['qonto','commerzbank'])[floor(random() * 2 + 1)],
    case when random() > 0.6 then (100 + floor(random() * 3500))::numeric
                              else -(50 + floor(random() * 800))::numeric end,
    'EUR',
    (array['Stripe Payout','Amazon','WeWork Miete','Adobe','Google Ads','Kunde Walter','Kunde Berg & Tal','Nils Freelance','Lohn Lisa'])[floor(random() * 9 + 1)],
    null, null,
    now()::date - (floor(random() * 30))::int,
    now() - (floor(random() * 30) || ' days')::interval,
    null
from generate_series(1, 40) g
on conflict do nothing;
update bank_transactions set direction = case when amount >= 0 then 'in' else 'out' end where direction is null;

-- Coaching clients + submissions
insert into coaching_clients (name, email, program, joined_at, active) values
  ('Alex Weber',  'alex@web.de',  'Kickstart 90',  now()::date - 45, true),
  ('Marie Koch',  'm@koch.de',    'Kickstart 90',  now()::date - 30, true),
  ('Tobi Becker', 'tobi@bec.de',  'Pro',           now()::date - 10, true)
on conflict do nothing;

insert into client_submissions (client_id, week_start, revenue, new_leads, booked_calls, closes, notes)
select id, date_trunc('week', now())::date, (500 + floor(random() * 3000))::numeric, floor(random()*20)::int, floor(random()*10)::int, floor(random()*3)::int, 'Seed'
from coaching_clients;

-- Recruiting positions + applications
with p as (
    insert into recruiting_positions (title, department, status, opened_at, budget_gross)
    values ('Video Producer', 'Creative', 'open', now()::date - 20, 55000),
           ('Social Media Manager', 'Marketing', 'open', now()::date - 5, 48000)
    on conflict do nothing
    returning id, title
)
insert into recruiting_applications (position_id, candidate_name, email, source, stage, applied_at, interviewed_at, trial_started_at, hired_at)
select p.id,
       (array['Paul M.','Sophie K.','Jonas B.','Emma F.','Luis H.','Clara T.'])[floor(random()*6+1)] || ' #' || g,
       'candidate' || g || '@example.com',
       (array['linkedin','referral','indeed'])[floor(random()*3+1)],
       (array['new','screening','interview','trial','offer','hired','rejected'])[floor(random()*7+1)],
       now() - ((floor(random()*20)+1) || ' days')::interval,
       case when random() > 0.5 then now() - ((floor(random()*15)) || ' days')::interval else null end,
       case when random() > 0.75 then now() - ((floor(random()*10)) || ' days')::interval else null end,
       case when random() > 0.9 then now() - ((floor(random()*5))  || ' days')::interval else null end
from p, generate_series(1, 4) g;

-- Recruiting costs
insert into recruiting_costs (position_id, category, description, amount, incurred_at)
select id, (array['interview','trial_day','ad_spend'])[floor(random()*3+1)],
       'Recruiting-Ausgabe',
       (50 + floor(random()*450))::numeric,
       now()::date - (floor(random()*25))::int
from recruiting_positions, generate_series(1, 5);

-- Manual expenses (Tools, Büro, etc.)
insert into manual_expenses (category, vendor, description, amount, incurred_at)
values
    ('tool', 'Adobe',      'Creative Cloud', 70.87, now()::date - 3),
    ('tool', 'ChatGPT',    'Team Plan',     119.00, now()::date - 8),
    ('office','IKEA',      'Büromaterial',  234.50, now()::date - 12),
    ('travel','Deutsche Bahn','Kundentermin BER', 89.90, now()::date - 15)
on conflict do nothing;

-- Manual income (sonstige)
insert into manual_income (source, description, amount, received_at)
values ('Workshop',   'Tagesworkshop Walter',     1200.00, now()::date - 5),
       ('Affiliate',  'CopeCart Auszahlung',       450.00, now()::date - 12)
on conflict do nothing;

-- Fulfillment items (Monday-like)
insert into monday_boards (board_id, name) values
  ('seed-board-1', 'Weekly Ops'),
  ('seed-board-2', 'Content Pipeline')
on conflict (board_id) do nothing;

insert into fulfillment_items (id, board_id, name, status, category, assignee, created_at, completed_at)
select
    'seed-fi-' || g,
    (array['seed-board-1','seed-board-2'])[floor(random()*2+1)],
    'Task #' || g,
    (array['open','in_progress','done','done','done'])[floor(random()*5+1)],
    (array['daily','weekly','monthly'])[floor(random()*3+1)],
    (array['Lisa','Nils','Felix'])[floor(random()*3+1)],
    now() - ((floor(random()*10)+1) || ' days')::interval,
    case when random() > 0.4 then now() - ((floor(random()*8)) || ' days')::interval else null end
from generate_series(1, 30) g;
update fulfillment_items set status = 'done' where completed_at is not null and status = 'open';

-- Opportunities + activities for Sales
insert into leads (id, name, source, status, owner) values
  ('seed-l-1', 'Potential Walter',  'linkedin', 'Qualified',         'Felix'),
  ('seed-l-2', 'Potential Müller',  'referral', 'Interested',        'Felix'),
  ('seed-l-3', 'Potential Berg',    'ads',      'Potential New Lead','John')
on conflict (id) do nothing;

insert into opportunities (id, lead_id, lead_name, pipeline, stage, value, owner, status, won_at, created_at)
values
  ('seed-op-1', 'seed-l-1', 'Potential Walter',  'Main', 'Setting - Terminiert', 3500, 'Felix', 'active', null,              now() - interval '4 days'),
  ('seed-op-2', 'seed-l-2', 'Potential Müller',  'Main', 'Closing - Terminiert', 1490, 'Felix', 'won',   now() - interval '2 days', now() - interval '10 days'),
  ('seed-op-3', 'seed-l-3', 'Potential Berg',    'Main', 'Angebot verschickt',   3990, 'John',  'active', null,              now() - interval '5 days')
on conflict (id) do nothing;

insert into activities (id, lead_id, type, direction, outcome, user_name, occurred_at, duration_seconds)
select 'seed-a-' || g,
       (array['seed-l-1','seed-l-2','seed-l-3'])[floor(random()*3+1)],
       'call',
       'outgoing',
       (array['connected','no_answer','voicemail'])[floor(random()*3+1)],
       (array['Felix','John'])[floor(random()*2+1)],
       now() - ((floor(random()*6)+1) || ' days')::interval,
       (60 + floor(random()*600))::int
from generate_series(1, 80) g;

-- Outreach (Instantly)
insert into outreach_campaigns (id, name, status, created_at) values
  ('seed-c-1', 'Q2 Agencies',  'active', now() - interval '30 days'),
  ('seed-c-2', 'Coaches 2026', 'active', now() - interval '60 days')
on conflict do nothing;

insert into outreach_metrics_daily (campaign_id, metric_date, sent, opened, replied, positive_replies, bounced)
select c.id, now()::date - g,
       (40 + floor(random()*70))::int,
       (20 + floor(random()*30))::int,
       floor(random()*5)::int,
       floor(random()*2)::int,
       floor(random()*2)::int
from outreach_campaigns c, generate_series(0, 20) g
on conflict do nothing;

-- Social / Marketing
insert into social_account_metrics_daily (platform, metric_date, followers, profile_views, reach, impressions)
select 'instagram', now()::date - g, 4200 + g, 80 + floor(random()*80)::int, 800 + floor(random()*1200)::int, 1000 + floor(random()*1500)::int
from generate_series(0, 6);

insert into social_account_metrics_daily (platform, metric_date, followers, profile_views, reach, impressions)
select 'linkedin',  now()::date - g, 1800 + g, 40 + floor(random()*60)::int, 500 + floor(random()*1000)::int,  700 + floor(random()*1300)::int
from generate_series(0, 6);
