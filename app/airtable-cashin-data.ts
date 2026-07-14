const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || ''
const BASE_ID = 'appTpGFd5R3nh8olz'
const TABLE_ID = 'tblzehvHOPBS9iUhq'

// Use field names for REST API (response keys are always field names)
const FIELD_NAMES = [
  'Kunden-ID',
  'Firma',
  'Paket',
  'Preis/Monat (€)',
  'Ratenhöhe (€)',
  'SetUp Zahlung',
  'Vertragsbeginn',
  'Vertragslaufzeit (Monate)',
  'Zahlungslaufzeit (Monate)',
  'Status',
  'Umsatztyp',
  'Ansprechpartner',
]

export interface CustomerCashIn {
  kundenId: string
  firma: string
  paket: string
  cashInNetto: number
  umsatztyp: string
  isSetup: boolean
}

export interface MonthCashIn {
  month: number // 1-12
  year: number
  label: string // "Juni 2026"
  customers: CustomerCashIn[]
  totalNetto: number
  totalBrutto: number
}

export interface NonPayingCustomer {
  kundenId: string
  firma: string
  paket: string
  rateMonat: number
  reason: string
  offenerBetrag: number
}

export interface AirtableCashInData {
  months: MonthCashIn[]
  nonPaying: NonPayingCustomer[]
  lastUpdated: string
}

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

// Kunden die nicht zahlen (Streitfall/inaktiv/existiert nicht mehr)
const NON_PAYING: NonPayingCustomer[] = [
  { kundenId: 'CL-015', firma: 'Eicke Awe', paket: 'Agentur Skalierung', rateMonat: 2500, reason: 'Streitfall — beim Anwalt', offenerBetrag: 17000 },
  { kundenId: 'CL-024', firma: 'AiVio Media', paket: 'DFY LinkedIn', rateMonat: 3500, reason: 'Streitfall — beim Anwalt', offenerBetrag: 21000 },
  { kundenId: 'CL-037', firma: 'Systemklar UG', paket: 'Coaching 90-Tage', rateMonat: 1500, reason: 'Streitfall — beim Anwalt', offenerBetrag: 4000 },
  { kundenId: 'CL-019', firma: 'Leon Ostermann', paket: 'Coaching 90-Tage', rateMonat: 1000, reason: 'Streitfall — beim Anwalt', offenerBetrag: 3100 },
  { kundenId: 'CL-021', firma: 'Resul Kerimi', paket: 'Coaching 90-Tage', rateMonat: 2000, reason: 'Streitfall — beim Anwalt', offenerBetrag: 5500 },
  { kundenId: 'CL-030', firma: 'CGMS Köln', paket: 'Altkunde', rateMonat: 3750, reason: 'Streitfall — beim Anwalt', offenerBetrag: 3700 },
  { kundenId: 'CL-017', firma: 'Sun Hwang', paket: 'DFY LinkedIn', rateMonat: 1500, reason: 'Zahlt nicht mehr', offenerBetrag: 0 },
  { kundenId: 'CL-020', firma: 'Enablence AI', paket: 'DFY LinkedIn', rateMonat: 2000, reason: 'Existiert nicht mehr', offenerBetrag: 0 },
  { kundenId: 'CL-018', firma: 'iklaro GmbH', paket: 'DFY LinkedIn', rateMonat: 2500, reason: 'Existiert nicht mehr', offenerBetrag: 0 },
  { kundenId: 'CL-031', firma: 'DA Direkt', paket: 'DFY LinkedIn', rateMonat: 3500, reason: 'Inaktiv', offenerBetrag: 0 },
  { kundenId: 'CL-025', firma: 'Hanse All Risk', paket: 'DFY LinkedIn', rateMonat: 1500, reason: 'Inaktiv', offenerBetrag: 0 },
  { kundenId: 'CL-012', firma: 'Ditella', paket: 'Coaching', rateMonat: 1000, reason: 'Inaktiv', offenerBetrag: 0 },
  { kundenId: 'CL-035', firma: 'ASS-KO solutions', paket: 'Software-Abo', rateMonat: 450, reason: 'Ausgelaufen', offenerBetrag: 0 },
  { kundenId: 'CL-046', firma: 'KFZ Meisterwerk', paket: 'Ads Management', rateMonat: 1000, reason: 'Gekündigt', offenerBetrag: 0 },
  { kundenId: 'CL-049', firma: 'Patrick Schnelle', paket: 'LinkedIn Profiloptimierung', rateMonat: 0, reason: 'Abgeschlossen (einmalig)', offenerBetrag: 0 },
  { kundenId: 'CL-051', firma: 'Navi8 Consulting', paket: 'LinkedIn Profiloptimierung', rateMonat: 0, reason: 'Abgeschlossen (einmalig)', offenerBetrag: 0 },
  { kundenId: 'CL-045', firma: 'OCEC Ltd.', paket: 'D4Y Leadposts', rateMonat: 2000, reason: 'Duplikat (Stefan Berns)', offenerBetrag: 0 },
]

const NON_PAYING_IDS = new Set(NON_PAYING.map(c => c.kundenId))

interface AirtableRecord {
  id: string
  fields: Record<string, any>
}

async function fetchAllRecords(): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = []
  let offset: string | undefined

  // Filter: alle außer Gekündigt und Abgeschlossen (viele Altkunden haben keinen Status gesetzt)
  const formula = encodeURIComponent(`AND({Status} != 'Gekündigt', {Status} != 'Abgeschlossen')`)

  do {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=${formula}&pageSize=100${offset ? `&offset=${offset}` : ''}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    })
    const data = await res.json()
    if (data.error) {
      console.error('Airtable API error:', data.error)
      break
    }
    if (data.records) {
      records.push(...data.records.map((r: any) => ({ id: r.id, fields: r.fields })))
    }
    offset = data.offset
  } while (offset)

  console.log(`Airtable: fetched ${records.length} active records`)
  if (records.length > 0) {
    console.log('Airtable: sample record fields:', Object.keys(records[0].fields))
  }

  return records
}

function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function computeCashInForMonth(records: AirtableRecord[], targetYear: number, targetMonth: number): MonthCashIn {
  const customers: CustomerCashIn[] = []
  const targetKey = getMonthKey(targetYear, targetMonth)

  for (const rec of records) {
    const f = rec.fields
    const firma = f['Firma'] || 'Unbekannt'
    const kundenId = (f['Kunden-ID'] || f['\ufeffKunden-ID'] || '').replace(/\ufeff/g, '')
    const paket = typeof f['Paket'] === 'object' ? f['Paket']?.name || '' : f['Paket'] || ''
    const preisMonat = f['Preis/Monat (€)'] || 0
    const ratenhoehe = f['Ratenhöhe (€)'] || 0
    const setupZahlung = f['SetUp Zahlung'] || 0
    const vertragsbeginnStr = f['Vertragsbeginn']
    const zahlungslaufzeit = f['Zahlungslaufzeit (Monate)'] || f['Vertragslaufzeit (Monate)'] || 0
    const umsatztyp = typeof f['Umsatztyp'] === 'object' ? f['Umsatztyp']?.name || '' : f['Umsatztyp'] || ''

    // Skip non-paying customers
    if (NON_PAYING_IDS.has(kundenId.toUpperCase())) continue

    const monatlicheRate = ratenhoehe > 0 ? ratenhoehe : preisMonat

    if (!vertragsbeginnStr) {
      // Altkunden ohne Vertragsbeginn: als dauerhaft aktiv behandeln
      if (monatlicheRate > 0) {
        customers.push({ kundenId, firma, paket, cashInNetto: monatlicheRate, umsatztyp: umsatztyp || 'Bestand', isSetup: false })
      }
      continue
    }

    const vertragsbeginn = new Date(vertragsbeginnStr + 'T00:00:00')
    const startYear = vertragsbeginn.getFullYear()
    const startMonth = vertragsbeginn.getMonth() + 1
    const startKey = getMonthKey(startYear, startMonth)

    // Alle Kunden: prüfen ob Zielmonat innerhalb Zahlungslaufzeit
    const laufzeit = zahlungslaufzeit > 0 ? zahlungslaufzeit : (umsatztyp === 'Einmalig' ? 1 : 120)
    const endDate = addMonths(vertragsbeginn, laufzeit)
    const endYear = endDate.getFullYear()
    const endMonth = endDate.getMonth() + 1
    const endKey = getMonthKey(endYear, endMonth)

    if (targetKey >= startKey && targetKey < endKey && monatlicheRate > 0) {
      customers.push({ kundenId, firma, paket, cashInNetto: monatlicheRate, umsatztyp: umsatztyp || 'Recurring', isSetup: false })
    }

    // SetUp: einmalig im Startmonat zusätzlich
    if (startKey === targetKey && setupZahlung > 0) {
      customers.push({ kundenId, firma, paket: `${paket} (SetUp)`, cashInNetto: setupZahlung, umsatztyp: 'SetUp', isSetup: true })
    }
  }

  customers.sort((a, b) => b.cashInNetto - a.cashInNetto)
  const totalNetto = customers.reduce((s, c) => s + c.cashInNetto, 0)

  return {
    month: targetMonth,
    year: targetYear,
    label: `${MONTH_NAMES[targetMonth - 1]} ${targetYear}`,
    customers,
    totalNetto,
    totalBrutto: Math.round(totalNetto * 1.19),
  }
}

interface ConfigCustomer {
  firma: string
  paket: string
  rate_monat: number
  cash_in_monat?: number
  cl_id: string
}

function loadDeliveryConfig(): ConfigCustomer[] {
  try {
    const fs = require('fs')
    const path = require('path')
    const configPath = path.join(process.cwd(), 'app', 'delivery-config.json')
    const raw = fs.readFileSync(configPath, 'utf-8')
    const config = JSON.parse(raw)
    return (config.customers || []).map((c: any) => ({
      firma: c.firma,
      paket: c.paket,
      rate_monat: c.rate_monat,
      cash_in_monat: c.cash_in_monat,
      cl_id: c.cl_id,
    }))
  } catch {
    return []
  }
}

export async function fetchAirtableCashIn(): Promise<AirtableCashInData> {
  if (!AIRTABLE_API_KEY) {
    return { months: [], nonPaying: NON_PAYING, lastUpdated: new Date().toISOString() }
  }

  try {
    const records = await fetchAllRecords()
    const configCustomers = loadDeliveryConfig()
    const now = new Date()
    const months: MonthCashIn[] = []

    // Aktuellen Monat + 1 Monat voraus + 6 Monate zurück
    for (let offset = -6; offset <= 1; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
      const month = computeCashInForMonth(records, d.getFullYear(), d.getMonth() + 1)

      // For current + future months: merge with delivery-config using Kunden-ID matching
      if (offset >= 0) {
        const airtableIds = new Set(month.customers.map(c => c.kundenId.toUpperCase()))

        // 1. Apply cash_in_monat overrides from config (match by Kunden-ID)
        for (const c of month.customers) {
          const configMatch = configCustomers.find(cc => cc.cl_id.toUpperCase() === c.kundenId.toUpperCase())
          if (configMatch?.cash_in_monat) {
            c.cashInNetto = configMatch.cash_in_monat
          }
        }

        // 2. Add config customers missing from Airtable (by Kunden-ID)
        for (const cc of configCustomers) {
          if (!airtableIds.has(cc.cl_id.toUpperCase()) && !NON_PAYING_IDS.has(cc.cl_id.toUpperCase())) {
            const cashIn = cc.cash_in_monat || cc.rate_monat
            if (cashIn > 0) {
              month.customers.push({
                kundenId: cc.cl_id,
                firma: cc.firma,
                paket: cc.paket,
                cashInNetto: cashIn,
                umsatztyp: 'Config',
                isSetup: false,
              })
            }
          }
        }

        month.customers.sort((a, b) => b.cashInNetto - a.cashInNetto)
        month.totalNetto = month.customers.reduce((s, c) => s + c.cashInNetto, 0)
        month.totalBrutto = Math.round(month.totalNetto * 1.19)
      }

      months.push(month)
    }

    return { months, nonPaying: NON_PAYING, lastUpdated: new Date().toISOString() }
  } catch (err) {
    console.error('Airtable Cash-In fetch error:', err)
    return { months: [], nonPaying: NON_PAYING, lastUpdated: new Date().toISOString() }
  }
}
