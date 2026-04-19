import fs from 'fs'
import path from 'path'

function parseEur(s: string): number {
  if (!s || !s.trim()) return 0
  return parseFloat(s.replace('€', '').replace(/\./g, '').replace(',', '.').trim()) || 0
}

function parseDate(s: string): string {
  if (!s || !s.trim()) return ''
  const parts = s.trim().split('/')
  if (parts.length !== 3) return ''
  const [d, m, y] = parts
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function parseCSV(raw: string): Record<string, string>[] {
  // Remove BOM if present
  const text = raw.replace(/^\uFEFF/, '')
  const lines: string[] = []
  let current = ''
  let inQuotes = false

  // Split into lines respecting quoted fields
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      current += ch
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current)
      current = ''
    } else if (ch === '\r' && !inQuotes) {
      // skip \r
    } else {
      current += ch
    }
  }
  if (current.trim()) lines.push(current)

  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    // Skip empty rows (all values empty)
    if (values.every(v => !v.trim())) continue
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = (values[j] || '').trim()
    }
    rows.push(row)
  }

  return rows
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

export interface AirtableCustomer {
  dealName: string
  kundenId: string
  status: 'Aktiv' | 'Gekündigt'
  produkt: string
  vertragstyp: 'Erstdeal' | 'Upsell'
  vertragssumme: number
  monatlicheRate: number
  vertragslaufzeit: number
  vertragsbeginn: string
  vertragsende: string
  kuendigungsgrund: string
  upsellDatum: string
  notizen: string
}

export interface AirtableMetrics {
  customers: AirtableCustomer[]
  totalCustomers: number
  activeCustomers: number
  churned: number
  churnRate: number
  mrr: number
  arr: number
  arpu: number
  ltv: number
  avgContractLength: number
  totalContractVolume: number
  upsellCount: number
  upsellRate: number
  churnReasons: { reason: string; count: number }[]
  productMix: { product: string; total: number; active: number; mrr: number }[]
  activeList: AirtableCustomer[]
  churnedList: AirtableCustomer[]
  upsellList: AirtableCustomer[]
}

export function getAirtableMetrics(): AirtableMetrics {
  const csvPath = path.join(process.cwd(), 'app', 'kundenbasis.csv')
  const raw = fs.readFileSync(csvPath, 'utf-8')
  const rows = parseCSV(raw)

  // Map rows to customers, skip rows without a Kunden-ID or Paket/Produkt
  const customers: AirtableCustomer[] = rows
    .filter(r => r['01_After Close Link'] && r['Paket/Produkt'])
    .map(r => ({
      dealName: r['Deal-Name'] || '',
      kundenId: r['01_After Close Link'] || '',
      status: (r['Status'] === 'Gekündigt' ? 'Gekündigt' : 'Aktiv') as 'Aktiv' | 'Gekündigt',
      produkt: r['Paket/Produkt'] || '',
      vertragstyp: (r['Vertragstyp'] === 'Upsell' ? 'Upsell' : 'Erstdeal') as 'Erstdeal' | 'Upsell',
      vertragssumme: parseEur(r['Vertragssumme (€)'] || ''),
      monatlicheRate: parseEur(r['Monatliche Rate (€)'] || ''),
      vertragslaufzeit: parseInt(r['Vertragslaufzeit'] || '0') || 0,
      vertragsbeginn: parseDate(r['Vertragsbeginn'] || ''),
      vertragsende: parseDate(r['Vertrag endet am'] || ''),
      kuendigungsgrund: r['Kündigungsgrund'] || '',
      upsellDatum: parseDate(r['Upsell am'] || ''),
      notizen: r['Notizen'] || '',
    }))

  const activeList = customers.filter(c => c.status === 'Aktiv')
  const churnedList = customers.filter(c => c.status === 'Gekündigt')
  const upsellList = customers.filter(c => c.vertragstyp === 'Upsell')

  const totalCustomers = customers.length
  const activeCustomers = activeList.length
  const churned = churnedList.length

  const churnRate = totalCustomers > 0
    ? Math.round((churned / totalCustomers) * 1000) / 10
    : 0

  const mrr = activeList.reduce((sum, c) => sum + c.monatlicheRate, 0)
  const arr = mrr * 12

  const arpu = activeCustomers > 0
    ? Math.round(mrr / activeCustomers)
    : 0

  // Total contract volume = sum of vertragssumme for all customers
  const totalContractVolume = customers.reduce((sum, c) => sum + c.vertragssumme, 0)

  // LTV = totalContractVolume / totalCustomers
  const ltv = totalCustomers > 0
    ? Math.round(totalContractVolume / totalCustomers)
    : 0

  // Average contract length
  const customersWithLength = customers.filter(c => c.vertragslaufzeit > 0)
  const avgContractLength = customersWithLength.length > 0
    ? Math.round((customersWithLength.reduce((sum, c) => sum + c.vertragslaufzeit, 0) / customersWithLength.length) * 10) / 10
    : 0

  const upsellCount = upsellList.length
  const upsellRate = totalCustomers > 0
    ? Math.round((upsellCount / totalCustomers) * 1000) / 10
    : 0

  // Churn reasons breakdown
  const reasonMap: Record<string, number> = {}
  for (const c of churnedList) {
    const reason = c.kuendigungsgrund || 'Unbekannt'
    reasonMap[reason] = (reasonMap[reason] || 0) + 1
  }
  const churnReasons = Object.entries(reasonMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)

  // Product mix with MRR
  const productMap: Record<string, { product: string; total: number; active: number; mrr: number }> = {}
  for (const c of customers) {
    if (!productMap[c.produkt]) {
      productMap[c.produkt] = { product: c.produkt, total: 0, active: 0, mrr: 0 }
    }
    productMap[c.produkt].total++
    if (c.status === 'Aktiv') {
      productMap[c.produkt].active++
      productMap[c.produkt].mrr += c.monatlicheRate
    }
  }
  const productMix = Object.values(productMap).sort((a, b) => b.mrr - a.mrr)

  return {
    customers,
    totalCustomers,
    activeCustomers,
    churned,
    churnRate,
    mrr,
    arr,
    arpu,
    ltv,
    avgContractLength,
    totalContractVolume,
    upsellCount,
    upsellRate,
    churnReasons,
    productMix,
    activeList,
    churnedList,
    upsellList,
  }
}
