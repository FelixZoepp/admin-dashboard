import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'

export interface NilsMonthData {
  month: string       // "2026-01"
  monthLabel: string   // "Januar 2026"
  sollHours: number
  istHours: number
  erfuellungPct: number
  daysWorked: number
  avgHoursPerDay: number
  urlaub: number
  krank: number
  fehlend: number
}

export interface NilsMetrics {
  totalSoll: number
  totalIst: number
  differenz: number
  daysWorked: number
  avgHoursPerDay: number
  urlaubDays: number
  krankDays: number
  fehlendDays: number
  costPerMonth: number
  costPerHour: number
  costPerDay: number
  months: NilsMonthData[]
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Januar',
  '02': 'Februar',
  '03': 'März',
  '04': 'April',
  '05': 'Mai',
  '06': 'Juni',
  '07': 'Juli',
  '08': 'August',
  '09': 'September',
  '10': 'Oktober',
  '11': 'November',
  '12': 'Dezember',
}

function parseHMM(val: unknown): number {
  if (val == null) return 0
  // Could be a string like "8:00" or a number (Excel serial time)
  if (typeof val === 'number') {
    // Excel stores time as fraction of day — 1.0 = 24h
    return Math.round(val * 24 * 100) / 100
  }
  const s = String(val).trim()
  if (!s) return 0
  const m = s.match(/^(-?\d+):(\d{2})$/)
  if (m) {
    const sign = s.startsWith('-') ? -1 : 1
    return sign * (Math.abs(parseInt(m[1], 10)) + parseInt(m[2], 10) / 60)
  }
  const n = parseFloat(s.replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export function getNilsMetrics(): NilsMetrics {
  const filePath = path.join(process.cwd(), 'app', 'nils-stunden.xlsx')

  if (!fs.existsSync(filePath)) {
    // Return fallback data based on the known summary
    return getFallbackMetrics()
  }

  try {
    const buf = fs.readFileSync(filePath)
    const wb = XLSX.read(buf, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) return getFallbackMetrics()

    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })

    // Find header row — look for "Soll" and "Ist" columns
    let headerIdx = -1
    let datumCol = -1
    let sollCol = -1
    let istCol = -1
    let typCol = -1 // Urlaub/Krank/etc

    for (let r = 0; r < Math.min(rows.length, 15); r++) {
      const row = rows[r]
      if (!row) continue
      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c] || '').toLowerCase().trim()
        if (cell === 'datum' || cell === 'date' || cell === 'tag') datumCol = c
        if (cell === 'soll') sollCol = c
        if (cell === 'ist') istCol = c
        if (cell === 'typ' || cell === 'type' || cell === 'art' || cell === 'abwesenheit' || cell === 'status') typCol = c
      }
      if (sollCol >= 0 && istCol >= 0) {
        headerIdx = r
        break
      }
    }

    if (headerIdx < 0 || sollCol < 0 || istCol < 0) {
      return getFallbackMetrics()
    }

    // Group data by month
    const monthMap: Record<string, { soll: number; ist: number; days: number; urlaub: number; krank: number; fehlend: number }> = {}

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r]
      if (!row || row.length === 0) continue

      const soll = parseHMM(row[sollCol])
      const ist = parseHMM(row[istCol])

      // Skip rows with no data
      if (soll === 0 && ist === 0) continue

      // Parse date
      let monthKey = ''
      const rawDate = row[datumCol >= 0 ? datumCol : 0]
      if (rawDate instanceof Date) {
        monthKey = `${rawDate.getFullYear()}-${String(rawDate.getMonth() + 1).padStart(2, '0')}`
      } else if (typeof rawDate === 'number') {
        // Excel serial date
        const d = XLSX.SSF.parse_date_code(rawDate)
        if (d) monthKey = `${d.y}-${String(d.m).padStart(2, '0')}`
      } else if (typeof rawDate === 'string') {
        const m = rawDate.match(/(\d{4})-(\d{2})/) || rawDate.match(/(\d{2})\.(\d{2})\.(\d{4})/)
        if (m && m.length === 3) {
          monthKey = `${m[1]}-${m[2]}`
        } else if (m && m.length === 4) {
          monthKey = `${m[3]}-${m[2]}`
        }
      }

      if (!monthKey) continue

      if (!monthMap[monthKey]) {
        monthMap[monthKey] = { soll: 0, ist: 0, days: 0, urlaub: 0, krank: 0, fehlend: 0 }
      }

      const entry = monthMap[monthKey]
      entry.soll += soll
      entry.ist += ist

      // Check type column for absences
      const typ = typCol >= 0 ? String(row[typCol] || '').toLowerCase() : ''
      if (typ.includes('urlaub')) {
        entry.urlaub++
      } else if (typ.includes('krank')) {
        entry.krank++
      } else if (typ.includes('fehl')) {
        entry.fehlend++
      }

      if (ist > 0) entry.days++
    }

    const sortedMonths = Object.keys(monthMap).sort()
    const months: NilsMonthData[] = sortedMonths.map(key => {
      const d = monthMap[key]
      const [y, m] = key.split('-')
      const erfuellungPct = d.soll > 0 ? Math.round((d.ist / d.soll) * 100) : 0
      return {
        month: key,
        monthLabel: `${MONTH_LABELS[m] || m} ${y}`,
        sollHours: Math.round(d.soll),
        istHours: Math.round(d.ist),
        erfuellungPct,
        daysWorked: d.days,
        avgHoursPerDay: d.days > 0 ? Math.round((d.ist / d.days) * 10) / 10 : 0,
        urlaub: d.urlaub,
        krank: d.krank,
        fehlend: d.fehlend,
      }
    })

    const totalSoll = months.reduce((s, m) => s + m.sollHours, 0)
    const totalIst = months.reduce((s, m) => s + m.istHours, 0)
    const daysWorked = months.reduce((s, m) => s + m.daysWorked, 0)
    const urlaubDays = months.reduce((s, m) => s + m.urlaub, 0)
    const krankDays = months.reduce((s, m) => s + m.krank, 0)
    const fehlendDays = months.reduce((s, m) => s + m.fehlend, 0)
    const costPerMonth = 4800
    const totalMonths = months.length || 1

    return {
      totalSoll,
      totalIst,
      differenz: totalIst - totalSoll,
      daysWorked,
      avgHoursPerDay: daysWorked > 0 ? Math.round((totalIst / daysWorked) * 10) / 10 : 0,
      urlaubDays,
      krankDays,
      fehlendDays,
      costPerMonth,
      costPerHour: totalIst > 0 ? Math.round((costPerMonth * totalMonths / totalIst) * 100) / 100 : 0,
      costPerDay: daysWorked > 0 ? Math.round((costPerMonth * totalMonths / daysWorked) * 100) / 100 : 0,
      months,
    }
  } catch (err) {
    console.error('Error parsing Clockodo xlsx:', err)
    return getFallbackMetrics()
  }
}

function getFallbackMetrics(): NilsMetrics {
  return {
    totalSoll: 624,
    totalIst: 631,
    differenz: 7,
    daysWorked: 85,
    avgHoursPerDay: 7.4,
    urlaubDays: 2,
    krankDays: 2,
    fehlendDays: 1,
    costPerMonth: 4800,
    costPerHour: 30.41,
    costPerDay: 225.88,
    months: [
      { month: '2026-01', monthLabel: 'Januar 2026', sollHours: 176, istHours: 191, erfuellungPct: 109, daysWorked: 24, avgHoursPerDay: 8.0, urlaub: 0, krank: 0, fehlend: 0 },
      { month: '2026-02', monthLabel: 'Februar 2026', sollHours: 160, istHours: 156, erfuellungPct: 98, daysWorked: 21, avgHoursPerDay: 7.4, urlaub: 0, krank: 0, fehlend: 0 },
      { month: '2026-03', monthLabel: 'März 2026', sollHours: 176, istHours: 172, erfuellungPct: 98, daysWorked: 25, avgHoursPerDay: 6.9, urlaub: 0, krank: 0, fehlend: 0 },
      { month: '2026-04', monthLabel: 'April 2026', sollHours: 112, istHours: 112, erfuellungPct: 100, daysWorked: 15, avgHoursPerDay: 7.4, urlaub: 0, krank: 0, fehlend: 0 },
    ],
  }
}
