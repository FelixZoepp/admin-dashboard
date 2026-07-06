import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export interface EodReport {
  date: string
  accountable: number | null
  performanceSatisfaction: number | null
  onTrackWeekly: number | null
  onTrackMonthly: number | null
  tipsApplied: number | null
  gesamtReview: string
  reviewCallArt: string
  status: string
}

export interface EodVertriebler {
  name: string
  reports: EodReport[]
  avgAccountable: number
  avgPerformance: number
  avgOnTrackWeekly: number
  avgOnTrackMonthly: number
  avgTipsApplied: number
  overallAvg: number
  trend7d: number // change in overallAvg last 7d vs prior 7d (positive = improving)
  totalReports: number
}

export interface EodReportData {
  vertriebler: EodVertriebler[]
  lastUpdated: string
}

function avg(nums: (number | null)[]): number {
  const valid = nums.filter((n): n is number => n !== null && !isNaN(n))
  if (valid.length === 0) return 0
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10
}

export async function fetchMondayEodData(): Promise<EodReportData> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { vertriebler: [], lastUpdated: new Date().toISOString() }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  const { data: rows } = await supabase
    .from('eod_reports_vertrieb')
    .select('*')
    .order('report_date', { ascending: true })

  if (!rows || rows.length === 0) {
    return { vertriebler: [], lastUpdated: new Date().toISOString() }
  }

  // Group by vertriebler_name
  const grouped: Record<string, typeof rows> = {}
  for (const row of rows) {
    const name = row.vertriebler_name || 'Unbekannt'
    if (!grouped[name]) grouped[name] = []
    grouped[name].push(row)
  }

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const d7ago = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]
  const d14ago = new Date(now.getTime() - 14 * 86400000).toISOString().split('T')[0]

  const vertriebler: EodVertriebler[] = Object.entries(grouped).map(([name, entries]) => {
    const reports: EodReport[] = entries.map((e) => ({
      date: e.report_date,
      accountable: e.accountable,
      performanceSatisfaction: e.performance_satisfaction,
      onTrackWeekly: e.on_track_weekly,
      onTrackMonthly: e.on_track_monthly,
      tipsApplied: e.tips_applied,
      gesamtReview: e.gesamt_review || '',
      reviewCallArt: e.review_call_art || '',
      status: e.status || '',
    }))

    const avgAccountable = avg(reports.map((r) => r.accountable))
    const avgPerformance = avg(reports.map((r) => r.performanceSatisfaction))
    const avgOnTrackWeekly = avg(reports.map((r) => r.onTrackWeekly))
    const avgOnTrackMonthly = avg(reports.map((r) => r.onTrackMonthly))
    const avgTipsApplied = avg(reports.map((r) => r.tipsApplied))
    const overallAvg = Math.round(((avgAccountable + avgPerformance + avgOnTrackWeekly + avgOnTrackMonthly + avgTipsApplied) / 5) * 10) / 10

    // 7-day trend: compare last 7 days avg vs prior 7 days avg
    const last7 = reports.filter((r) => r.date >= d7ago && r.date <= today)
    const prior7 = reports.filter((r) => r.date >= d14ago && r.date < d7ago)

    const overallForReports = (rs: EodReport[]) => {
      if (rs.length === 0) return 0
      const dims = [
        avg(rs.map((r) => r.accountable)),
        avg(rs.map((r) => r.performanceSatisfaction)),
        avg(rs.map((r) => r.onTrackWeekly)),
        avg(rs.map((r) => r.onTrackMonthly)),
        avg(rs.map((r) => r.tipsApplied)),
      ]
      return dims.reduce((a, b) => a + b, 0) / 5
    }

    const trend7d = Math.round((overallForReports(last7) - overallForReports(prior7)) * 10) / 10

    return {
      name,
      reports,
      avgAccountable,
      avgPerformance,
      avgOnTrackWeekly,
      avgOnTrackMonthly,
      avgTipsApplied,
      overallAvg,
      trend7d,
      totalReports: reports.length,
    }
  })

  vertriebler.sort((a, b) => a.name.localeCompare(b.name))

  return { vertriebler, lastUpdated: new Date().toISOString() }
}
