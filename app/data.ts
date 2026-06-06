import { getAirtableMetrics, AirtableMetrics } from './airtable-data'
import { fetchCalendlyData, CalendlyMetrics } from './calendly-data'
import { getNilsMetrics } from './clockodo-data'
import { getDeliveryMetrics } from './delivery-data'
import { fetchOutreachData, OutreachMetrics } from './outreach-data'
import { fetchMarketingData, MarketingMetrics } from './marketing-data'
import { fetchCallAnalysisData, CallAnalysisMetrics } from './call-analysis-data'
import { getFacebookMetrics, FacebookMetrics } from './facebook-data'
import { fetchOpenerTracking, OpenerTrackingData } from './opener-tracking-data'

const CLOSE_API_BASE = 'https://api.close.com/api/v1'

// Pipeline status IDs
const PIPELINE_STATUSES: Record<string, string> = {
  'stat_SJMKmHyG1PUg5y6pcFZiEHKEIWVrFf7IDMpF1O31AgA': 'Setting - Terminiert',
  'stat_09b2m2xI4kxcxHjgE3Xbb3n7rzE3ygpmBX4zIXR1I5f': 'Setting - No Show',
  'stat_esHRwS41irQis8aYyfk55CRjyrV5bhEB6c03qWdU3So': 'Setting - Follow Up',
  'stat_G4vinr4M5aNginkr1nNkxS7Mt2sEFFELsmOfrBMGCG4': 'Closing - Terminiert',
  'stat_XTjldovdZz1SvfOfi8nzTCbm5o9mUAVDwZ6jdSZ1V3R': 'Closing - No Show',
  'stat_WJks2iEcai6sgu3dokyOSKud5oWTIWKo3IQaDSO9aDZ': 'Closing - Follow Up',
  'stat_yIC8eUAp0OBYggJ1qqasmM3iosOh9rnrsEXJEtzSBpe': 'Angebot verschickt',
  'stat_jwxdfe98lRYRhNRE9lPxo0oJ8tJIcJ7lCIVUTnVRzY2': 'CC2 - Terminiert',
  'stat_dXsj5FLoE3RoAaop1P5GmYc8uyKn10UGpsd1YBHwew9': 'Close (won)',
  'stat_hJ7EJJIKWl55KVG5Kjs91jxOaM1AsP65LSXDd2wh7Fe': 'Verloren (lost)',
}

// Lead status IDs
const LEAD_STATUSES: Record<string, string> = {
  'stat_sgDNPr29uwT7tMPTxzQKW6DDCjbM2JMZzdX3UpeRGLb': 'Leadpool',
  'stat_Qzunur5ekjXNVsgsWoZbgSAlpdnnLAIQkVnz1ihrElY': 'Interessiert',
  'stat_VOYlu7IDrVfM2b7sJEuSZh7yg8l8iROyaqkFl72h8gD': 'Kein Interesse/Bedarf',
  'stat_KOgUVO1WFOP8s8ONyvCrUMPgTeuplY3YH7nRqUhTUvO': 'Bad Data',
  'stat_VRW9P4kJbS2UIZ3inNXaSwiq9gGXqKavqorykXGKog7': 'Schwer erreichbar',
  'stat_E0PMV0VE8R9KIyqq8aGpBMyvBqjmaih50lXRczPpQ2L': 'Setting',
  'stat_BqlpXrf3Xh0QnPwZ3ND2a9dbaola4XCIzmFRlgWFnXW': 'Closing',
  'stat_8dSmRG4WxUrYGItFQyAy0B4lksHZYeaxnkmUiqKbuCu': 'Disqualifiziert',
  'stat_WR3PeRWIVjd420Rr7mn9mPKR44BvHAZ6kMXGaY5DNvm': 'High Prio',
  'stat_MJup3ZQf4bJ5MOOrx4H9ROJbwi74x3WTkoRNy3vOR1a': 'Nurture',
  'stat_rLRfgTDAiphn7YtSgZcMvw8dZcvgJy8Msi35wkSptkx': 'Unqualifiziert',
  'stat_p7s3wz4JnH4ftamYyGTIHf8I3Gy9fBuxqhIfKufqmGG': 'Kunde',
}

const WON_STATUS_ID = 'stat_dXsj5FLoE3RoAaop1P5GmYc8uyKn10UGpsd1YBHwew9'
const LOST_STATUS_ID = 'stat_hJ7EJJIKWl55KVG5Kjs91jxOaM1AsP65LSXDd2wh7Fe'

const ACTIVE_PIPELINE_STATUS_IDS = Object.keys(PIPELINE_STATUSES).filter(
  (id) => id !== WON_STATUS_ID && id !== LOST_STATUS_ID
)

function getAuthHeader(): string {
  const apiKey = process.env.CLOSE_API_KEY
  if (!apiKey) return ''
  return 'Basic ' + Buffer.from(apiKey + ':').toString('base64')
}

async function closeApiFetch(endpoint: string, options?: RequestInit) {
  const url = endpoint.startsWith('http') ? endpoint : `${CLOSE_API_BASE}${endpoint}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
      ...options?.headers,
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Close API error ${res.status}: ${text}`)
  }
  return res.json()
}

async function fetchOppStatusChanges(dateGte: string): Promise<any[]> {
  const changes: any[] = []
  let hasMore = true
  let skip = 0
  const limit = 100

  while (hasMore) {
    const data = await closeApiFetch(
      `/activity/status_change/opportunity/?date_created__gte=${dateGte}&_skip=${skip}&_limit=${limit}&_order_by=-date_created&_fields=id,date_created,old_status_id,new_status_id,old_status_label,new_status_label`
    )
    changes.push(...data.data)
    hasMore = data.has_more
    skip += limit
  }

  return changes
}

interface StatusTransition {
  fromLabel: string
  toLabel: string
  count: number
}

interface PipelineQuality {
  settingTransitions: StatusTransition[]
  settingTotal: number
  settingNoShowCount: number
  settingNoShowRate: number
  settingToClosingCount: number
  settingToClosingRate: number
  settingLostCount: number
  settingLostRate: number
  settingFollowUpCount: number
  settingFollowUpRate: number
  closingTransitions: StatusTransition[]
  closingTotal: number
  closingNoShowCount: number
  closingNoShowRate: number
  closingWonCount: number
  closingWonRate: number
  closingLostCount: number
  closingLostRate: number
  closingFollowUpCount: number
  closingFollowUpRate: number
  closingAngebotCount: number
  closingCC2Count: number
  noShowRecovery: StatusTransition[]
}

function computePipelineQuality(changes: any[]): PipelineQuality {
  const SETTING_TERMINIERT = 'stat_SJMKmHyG1PUg5y6pcFZiEHKEIWVrFf7IDMpF1O31AgA'
  const SETTING_NO_SHOW = 'stat_09b2m2xI4kxcxHjgE3Xbb3n7rzE3ygpmBX4zIXR1I5f'
  const SETTING_FOLLOW_UP = 'stat_esHRwS41irQis8aYyfk55CRjyrV5bhEB6c03qWdU3So'
  const CLOSING_TERMINIERT = 'stat_G4vinr4M5aNginkr1nNkxS7Mt2sEFFELsmOfrBMGCG4'
  const CLOSING_NO_SHOW = 'stat_XTjldovdZz1SvfOfi8nzTCbm5o9mUAVDwZ6jdSZ1V3R'
  const CLOSING_FOLLOW_UP = 'stat_WJks2iEcai6sgu3dokyOSKud5oWTIWKo3IQaDSO9aDZ'
  const ANGEBOT = 'stat_yIC8eUAp0OBYggJ1qqasmM3iosOh9rnrsEXJEtzSBpe'
  const CC2 = 'stat_jwxdfe98lRYRhNRE9lPxo0oJ8tJIcJ7lCIVUTnVRzY2'
  const WON = 'stat_dXsj5FLoE3RoAaop1P5GmYc8uyKn10UGpsd1YBHwew9'
  const LOST = 'stat_hJ7EJJIKWl55KVG5Kjs91jxOaM1AsP65LSXDd2wh7Fe'

  // Group transitions by from → to
  function groupTransitions(fromId: string): StatusTransition[] {
    const map: Record<string, { label: string; count: number }> = {}
    for (const c of changes) {
      if (c.old_status_id === fromId) {
        const key = c.new_status_id
        if (!map[key]) map[key] = { label: c.new_status_label || 'Unbekannt', count: 0 }
        map[key].count++
      }
    }
    return Object.values(map)
      .map(v => ({ fromLabel: '', toLabel: v.label, count: v.count }))
      .sort((a, b) => b.count - a.count)
  }

  // Setting transitions
  const settingChanges = groupTransitions(SETTING_TERMINIERT)
  const settingTotal = settingChanges.reduce((s, t) => s + t.count, 0)
  const settingNoShowCount = changes.filter(c => c.old_status_id === SETTING_TERMINIERT && c.new_status_id === SETTING_NO_SHOW).length
  const settingToClosingCount = changes.filter(c => c.old_status_id === SETTING_TERMINIERT && c.new_status_id === CLOSING_TERMINIERT).length
  const settingLostCount = changes.filter(c => c.old_status_id === SETTING_TERMINIERT && c.new_status_id === LOST).length
  const settingFollowUpCount = changes.filter(c => c.old_status_id === SETTING_TERMINIERT && c.new_status_id === SETTING_FOLLOW_UP).length

  // Closing transitions
  const closingChanges = groupTransitions(CLOSING_TERMINIERT)
  const closingTotal = closingChanges.reduce((s, t) => s + t.count, 0)
  const closingNoShowCount = changes.filter(c => c.old_status_id === CLOSING_TERMINIERT && c.new_status_id === CLOSING_NO_SHOW).length
  const closingWonCount = changes.filter(c => c.old_status_id === CLOSING_TERMINIERT && c.new_status_id === WON).length
  const closingLostCount = changes.filter(c => c.old_status_id === CLOSING_TERMINIERT && c.new_status_id === LOST).length
  const closingFollowUpCount = changes.filter(c => c.old_status_id === CLOSING_TERMINIERT && c.new_status_id === CLOSING_FOLLOW_UP).length
  const closingAngebotCount = changes.filter(c => c.old_status_id === CLOSING_TERMINIERT && c.new_status_id === ANGEBOT).length
  const closingCC2Count = changes.filter(c => c.old_status_id === CLOSING_TERMINIERT && c.new_status_id === CC2).length

  // No-Show recovery
  const noShowRecovery: StatusTransition[] = []
  const settingNoShowRecovery = groupTransitions(SETTING_NO_SHOW)
  for (const t of settingNoShowRecovery) {
    noShowRecovery.push({ fromLabel: 'Setting No Show', toLabel: t.toLabel, count: t.count })
  }
  const closingNoShowRecovery = groupTransitions(CLOSING_NO_SHOW)
  for (const t of closingNoShowRecovery) {
    noShowRecovery.push({ fromLabel: 'Closing No Show', toLabel: t.toLabel, count: t.count })
  }

  const rate = (n: number, total: number) => total > 0 ? Math.round((n / total) * 1000) / 10 : 0

  return {
    settingTransitions: settingChanges,
    settingTotal,
    settingNoShowCount,
    settingNoShowRate: rate(settingNoShowCount, settingTotal),
    settingToClosingCount,
    settingToClosingRate: rate(settingToClosingCount, settingTotal),
    settingLostCount,
    settingLostRate: rate(settingLostCount, settingTotal),
    settingFollowUpCount,
    settingFollowUpRate: rate(settingFollowUpCount, settingTotal),
    closingTransitions: closingChanges,
    closingTotal,
    closingNoShowCount,
    closingNoShowRate: rate(closingNoShowCount, closingTotal),
    closingWonCount,
    closingWonRate: rate(closingWonCount, closingTotal),
    closingLostCount,
    closingLostRate: rate(closingLostCount, closingTotal),
    closingFollowUpCount,
    closingFollowUpRate: rate(closingFollowUpCount, closingTotal),
    closingAngebotCount,
    closingCC2Count,
    noShowRecovery,
  }
}

async function fetchAllOpportunities() {
  const opportunities: any[] = []
  let hasMore = true
  let skip = 0
  const limit = 100

  while (hasMore) {
    const data = await closeApiFetch(`/opportunity/?_skip=${skip}&_limit=${limit}&_fields=id,status_id,value,lead_name,date_won,date_created,date_lost,user_name,confidence`)
    opportunities.push(...data.data)
    hasMore = data.has_more
    skip += limit
  }

  return opportunities
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function getISOWeekStart(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayOfWeek = jan4.getUTCDay() || 7
  const mondayOfWeek1 = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000)
  return new Date(mondayOfWeek1.getTime() + (week - 1) * 7 * 86400000)
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

// Lead display order with colors
const LEAD_DISPLAY_ORDER = [
  { id: 'stat_sgDNPr29uwT7tMPTxzQKW6DDCjbM2JMZzdX3UpeRGLb', color: 'accent-blue', label: 'Leadpool' },
  { id: 'stat_Qzunur5ekjXNVsgsWoZbgSAlpdnnLAIQkVnz1ihrElY', color: 'accent-yellow', label: 'Interessiert' },
  { id: 'stat_WR3PeRWIVjd420Rr7mn9mPKR44BvHAZ6kMXGaY5DNvm', color: 'accent-orange', label: 'High Prio' },
  { id: 'stat_E0PMV0VE8R9KIyqq8aGpBMyvBqjmaih50lXRczPpQ2L', color: 'accent-purple', label: 'Setting' },
  { id: 'stat_BqlpXrf3Xh0QnPwZ3ND2a9dbaola4XCIzmFRlgWFnXW', color: 'accent-green', label: 'Closing' },
  { id: 'stat_p7s3wz4JnH4ftamYyGTIHf8I3Gy9fBuxqhIfKufqmGG', color: 'accent-green', label: 'Kunde' },
  { id: 'stat_VOYlu7IDrVfM2b7sJEuSZh7yg8l8iROyaqkFl72h8gD', color: 'accent-red', label: 'Kein Interesse' },
  { id: 'stat_8dSmRG4WxUrYGItFQyAy0B4lksHZYeaxnkmUiqKbuCu', color: 'accent-red', label: 'Disqualifiziert' },
  { id: 'stat_VRW9P4kJbS2UIZ3inNXaSwiq9gGXqKavqorykXGKog7', color: 'text-muted', label: 'Schwer erreichbar' },
  { id: 'stat_KOgUVO1WFOP8s8ONyvCrUMPgTeuplY3YH7nRqUhTUvO', color: 'text-muted', label: 'Bad Data' },
  { id: 'stat_rLRfgTDAiphn7YtSgZcMvw8dZcvgJy8Msi35wkSptkx', color: 'text-muted', label: 'Unqualifiziert' },
  { id: 'stat_MJup3ZQf4bJ5MOOrx4H9ROJbwi74x3WTkoRNy3vOR1a', color: 'accent-purple', label: 'Nurture' },
]

export async function fetchCloseData() {
  try {
    if (!process.env.CLOSE_API_KEY) {
      return { error: 'CLOSE_API_KEY not configured' }
    }

    const now = new Date()
    const currentWeek = getISOWeekNumber(now)
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const currentDay = now.getDate()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()

    // Fetch opportunities
    const opportunities = await fetchAllOpportunities()

    // Process opportunities
    const wonDeals = opportunities.filter((o: any) => o.status_id === WON_STATUS_ID)
    const lostDeals = opportunities.filter((o: any) => o.status_id === LOST_STATUS_ID)
    const activeDeals = opportunities.filter((o: any) =>
      ACTIVE_PIPELINE_STATUS_IDS.includes(o.status_id)
    )

    // Won deals this month
    const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
    const wonThisMonth = wonDeals
      .filter((o: any) => o.date_won && o.date_won >= monthStart)
      .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))

    // Revenue
    const revenueMTD = wonThisMonth.reduce((sum: number, o: any) => sum + (o.value || 0), 0) / 100
    const totalRevenue = wonDeals.reduce((sum: number, o: any) => sum + (o.value || 0), 0) / 100
    const totalLostValue = lostDeals.reduce((sum: number, o: any) => sum + (o.value || 0), 0) / 100

    // Pipeline value
    const pipelineValue = activeDeals.reduce((sum: number, o: any) => sum + (o.value || 0), 0) / 100

    // Closing rate
    const closedTotal = wonDeals.length + lostDeals.length
    const closingRate = closedTotal > 0 ? Math.round((wonDeals.length / closedTotal) * 100) : 0

    // Average deal size
    const avgDealSize = wonDeals.length > 0 ? Math.round(totalRevenue / wonDeals.length) : 0

    // Pipeline breakdown by status
    const pipelineByStatus: Record<string, { count: number; value: number; label: string }> = {}
    for (const deal of activeDeals) {
      const statusId = deal.status_id
      const label = PIPELINE_STATUSES[statusId] || 'Unbekannt'
      if (!pipelineByStatus[statusId]) {
        pipelineByStatus[statusId] = { count: 0, value: 0, label }
      }
      pipelineByStatus[statusId].count++
      pipelineByStatus[statusId].value += (deal.value || 0) / 100
    }

    const pipelineSorted = Object.values(pipelineByStatus).sort((a, b) =>
      b.value - a.value || b.count - a.count
    )

    // Pipeline deals with value
    const pipelineDealsWithValue = activeDeals
      .filter((o: any) => o.value && o.value > 0)
      .map((o: any) => ({
        leadName: o.lead_name || 'Unbekannt',
        status: PIPELINE_STATUSES[o.status_id] || 'Unbekannt',
        value: o.value / 100,
      }))
      .sort((a: any, b: any) => b.value - a.value)

    // Monthly revenue aggregation
    const monthlyRevenue: Record<string, number> = {}
    for (const deal of wonDeals) {
      if (deal.date_won) {
        const monthKey = deal.date_won.substring(0, 7)
        monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + (deal.value || 0) / 100
      }
    }

    const monthlySorted = Object.entries(monthlyRevenue)
      .sort(([a], [b]) => b.localeCompare(a))

    // Forecast
    const linearForecast = currentDay > 0 ? Math.round((revenueMTD / currentDay) * daysInMonth) : 0
    const pipelineWeightedForecast = Math.round(linearForecast + (pipelineValue * closingRate / 100))

    // Average of last 3 months
    const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
    const last3Months = monthlySorted
      .filter(([key]) => key < currentMonthKey)
      .slice(0, 3)
    const avg3Months = last3Months.length > 0
      ? Math.round(last3Months.reduce((sum, [, val]) => sum + val, 0) / last3Months.length)
      : 0

    // Fetch lead counts via search API
    let leadStatusCounts: { label: string; count: number; color: string }[] = []
    let totalLeads = 0

    try {
      const searchResult = await closeApiFetch('/data/search/', {
        method: 'POST',
        body: JSON.stringify({
          type: 'lead',
          query: { type: 'and', queries: [] },
          results_limit: 0,
          include_counts: true,
        }),
      })
      totalLeads = searchResult.total_results || 0
    } catch {
      totalLeads = 0
    }

    // Fetch counts per lead status in parallel
    const countPromises = LEAD_DISPLAY_ORDER.map(async (status) => {
      try {
        const result = await closeApiFetch('/data/search/', {
          method: 'POST',
          body: JSON.stringify({
            type: 'lead',
            query: {
              type: 'and',
              queries: [{
                type: 'object_type',
                object_type: 'lead',
                related_object_type: null,
                this_object_type: 'lead',
                condition: {
                  type: 'text',
                  mode: 'is',
                  values: [status.id],
                },
                field: { field_name: 'status_id', object_type: 'lead' },
              }],
            },
            results_limit: 50,
            include_counts: true,
            _fields: { lead: ['id', 'display_name', 'date_created'] },
          }),
        })
        const leads = (result.data || []).map((l: any) => ({
          name: l.display_name || 'Unbekannt',
          date: l.date_created || '',
        }))
        return { label: status.label, count: result.total_results || 0, color: status.color, leads }
      } catch {
        return { label: status.label, count: 0, color: status.color, leads: [] }
      }
    })

    leadStatusCounts = await Promise.all(countPromises)

    // Fetch weekly call activity for last 8 weeks
    const weeksBack = 8
    const weeklyCallData: { week: string; calls: number }[] = []

    for (let w = weeksBack - 1; w >= 0; w--) {
      const wStart = getISOWeekStart(currentYear, currentWeek - w)
      const wEnd = new Date(wStart.getTime() + 7 * 86400000)
      const weekNum = currentWeek - w

      try {
        const weekActivity = await closeApiFetch('/report/activity/overview/', {
          method: 'POST',
          body: JSON.stringify({
            date_start: formatDateISO(wStart),
            date_end: formatDateISO(wEnd),
          }),
        })

        const calls = weekActivity?.aggregations?.calls_made || 0
        weeklyCallData.push({
          week: `KW${weekNum > 0 ? weekNum : weekNum + 52}`,
          calls,
        })
      } catch {
        weeklyCallData.push({
          week: `KW${weekNum > 0 ? weekNum : weekNum + 52}`,
          calls: 0,
        })
      }
    }

    // === Custom Activity Counts (Sales Funnel) ===
    const CUSTOM_ACTIVITY_TYPES = {
      coldCall: 'actitype_1opHQI1ygoGZjsIG0z7SkR',    // Gesprächsprotokoll (Cold Call)
      setting: 'actitype_4VVTPxLTlLNPNsMsc7tgxC',      // Gesprächsprotokoll (Setting)
      closing: 'actitype_7QI2uISXKjTGXHK0AYmckm',      // Gesprächsprotokoll (Closing)
      followUp: 'actitype_3EqH37y6lgLrS9vufk3MU4',     // Gesprächsprotokoll (Follow-Up)
    }

    const weekStartISO_full = getISOWeekStart(currentYear, currentWeek).toISOString()
    const nowISO_full = now.toISOString()

    // Custom field IDs for reach detection
    const COLD_CALL_NIEMAND_ERREICHT = 'custom.cf_U3JJwHBkSgOGtEKO4wd7b5EeLbUyv0uBXAQuG3GgEu6' // ❌Niemand erreicht = "Ja"
    const COLD_CALL_ENTSCHEIDER = 'custom.cf_0qd3PlDb9re1MU97cxNV7MJUXjHVYGmuifQc5CsTrN1' // 🔍Entscheider (choices)
    const COLD_CALL_EINWAND = 'custom.cf_LrfCv9jCiQOAkx4EaBAa3E3rzA5NIfa4CIfWT2rwuhe' // 🛑 Einwand (choices)
    const FOLLOW_UP_NAECHSTER_SCHRITT = 'custom.cf_JKIoBAGq8wjSE0mo8C6lyWjMZHRw8WlwNJrqb0LpWeN' // Nächster Schritt (Follow-Up)
    const SETTING_NAECHSTER_SCHRITT = 'custom.cf_xPhL5XUDQ8i4gCcUF4pz5uMaHUoIMwZXB3af8Xv0A6B' // Nächster Schritt (Setting)

    // Fetch ALL custom activities for last 90 days (covers current + previous months for reports)
    const todayDateISO = formatDateISO(now)
    const weekStartDate = formatDateISO(getISOWeekStart(currentYear, currentWeek))
    const activitiesSince = formatDateISO(new Date(now.getTime() - 90 * 86400000))

    let allCustomActivities: any[] = []
    try {
      let hasMore = true
      let skip = 0
      const limit = 100
      while (hasMore) {
        const data = await closeApiFetch(
          `/activity/custom/?date_created__gte=${activitiesSince}&_skip=${skip}&_limit=${limit}&_order_by=-date_created&_fields=id,custom_activity_type_id,date_created,user_name,${COLD_CALL_NIEMAND_ERREICHT},${COLD_CALL_ENTSCHEIDER},${COLD_CALL_EINWAND},${FOLLOW_UP_NAECHSTER_SCHRITT},${SETTING_NAECHSTER_SCHRITT}`
        )
        allCustomActivities.push(...data.data)
        hasMore = data.has_more
        skip += limit
      }
    } catch {
      allCustomActivities = []
    }

    // Fetch opportunity status changes for pipeline quality analysis
    let allStatusChanges: any[] = []
    let weekStatusChanges: any[] = []
    let monthStatusChanges: any[] = []
    try {
      allStatusChanges = await fetchOppStatusChanges(activitiesSince)
      weekStatusChanges = allStatusChanges.filter((c: any) => c.date_created >= weekStartDate)
      monthStatusChanges = allStatusChanges.filter((c: any) => c.date_created >= monthStart)
    } catch {
      allStatusChanges = []
    }

    const pipelineQualityAllTime = computePipelineQuality(allStatusChanges)
    const pipelineQualityWeek = computePipelineQuality(weekStatusChanges)
    const pipelineQualityMonth = computePipelineQuality(monthStatusChanges)

    // Helper: filter activities by type and date
    function filterActivities(typeId: string, dateGte: string) {
      return allCustomActivities.filter((a: any) =>
        a.custom_activity_type_id === typeId && a.date_created >= dateGte
      )
    }

    // Count custom activity protocols by type and period (for Entscheider, Settings, Closings)
    const coldCallToday = filterActivities(CUSTOM_ACTIVITY_TYPES.coldCall, todayDateISO).length
    const coldCallWeek = filterActivities(CUSTOM_ACTIVITY_TYPES.coldCall, weekStartDate).length
    const coldCallMonth = filterActivities(CUSTOM_ACTIVITY_TYPES.coldCall, monthStart).length
    const followUpToday = filterActivities(CUSTOM_ACTIVITY_TYPES.followUp, todayDateISO).length
    const followUpWeek = filterActivities(CUSTOM_ACTIVITY_TYPES.followUp, weekStartDate).length
    const followUpMonth = filterActivities(CUSTOM_ACTIVITY_TYPES.followUp, monthStart).length

    // Anwahlen = ECHTE Calls aus Close via /activity/call/ endpoint
    // Fetch per period to keep pagination manageable
    async function fetchCallsForPeriod(dateStart: string): Promise<any[]> {
      const calls: any[] = []
      try {
        let hasMore = true
        let skip = 0
        const limit = 100
        while (hasMore) {
          const data = await closeApiFetch(
            `/activity/call/?date_created__gte=${dateStart}&_skip=${skip}&_limit=${limit}&_order_by=-date_created&_fields=id,date_created,user_id,user_name`
          )
          calls.push(...data.data)
          hasMore = data.has_more
          skip += limit
        }
      } catch { /* empty */ }
      return calls
    }

    // Fetch all calls for this month (covers today + week + month)
    const allMonthCalls = await fetchCallsForPeriod(monthStart)

    const anwahlenToday = allMonthCalls.filter((a: any) => a.date_created >= todayDateISO).length
    const anwahlenWeek = allMonthCalls.filter((a: any) => a.date_created >= weekStartDate).length
    const anwahlenMonth = allMonthCalls.length

    // Per-user call counts for team performance
    function countCallsByUser(calls: any[]): Record<string, number> {
      const byUser: Record<string, number> = {}
      for (const c of calls) {
        const name = c.user_name || 'Unbekannt'
        byUser[name] = (byUser[name] || 0) + 1
      }
      return byUser
    }
    const callsByUserMonth = countCallsByUser(allMonthCalls)

    // Entscheider erreicht = Cold Calls wo Entscheider-Feld gesetzt ist (nicht leer) UND nicht "Niemand erreicht"
    function countEntscheiderErreicht(typeId: string, dateGte: string): number {
      const acts = filterActivities(typeId, dateGte)
      if (typeId === CUSTOM_ACTIVITY_TYPES.coldCall) {
        return acts.filter((a: any) => a[COLD_CALL_ENTSCHEIDER] && a[COLD_CALL_NIEMAND_ERREICHT] !== 'Ja').length
      } else {
        return acts.filter((a: any) => a[FOLLOW_UP_NAECHSTER_SCHRITT] && a[FOLLOW_UP_NAECHSTER_SCHRITT] !== '5. Nicht erreicht').length
      }
    }

    const entscheiderTodayCount = countEntscheiderErreicht(CUSTOM_ACTIVITY_TYPES.coldCall, todayDateISO) + countEntscheiderErreicht(CUSTOM_ACTIVITY_TYPES.followUp, todayDateISO)
    const entscheiderWeekCount = countEntscheiderErreicht(CUSTOM_ACTIVITY_TYPES.coldCall, weekStartDate) + countEntscheiderErreicht(CUSTOM_ACTIVITY_TYPES.followUp, weekStartDate)
    const entscheiderMonthCount = countEntscheiderErreicht(CUSTOM_ACTIVITY_TYPES.coldCall, monthStart) + countEntscheiderErreicht(CUSTOM_ACTIVITY_TYPES.followUp, monthStart)

    // Entscheider outcome breakdown — ALL outcomes so totals match "Entscheider erreicht"
    const ENTSCHEIDER_SUCCESS = new Set(['Setting vereinbart am:'])
    const FOLLOWUP_SETTING_SUCCESS = new Set(['2. Setting gelegt am:', '3. Closing gelegt am:'])

    function getEntscheiderOutcomes(dateGte: string): Record<string, number> {
      const coldCalls = filterActivities(CUSTOM_ACTIVITY_TYPES.coldCall, dateGte)
        .filter((a: any) => a[COLD_CALL_ENTSCHEIDER] && a[COLD_CALL_NIEMAND_ERREICHT] !== 'Ja')
      const followUps = filterActivities(CUSTOM_ACTIVITY_TYPES.followUp, dateGte)
        .filter((a: any) => a[FOLLOW_UP_NAECHSTER_SCHRITT] && a[FOLLOW_UP_NAECHSTER_SCHRITT] !== '5. Nicht erreicht')

      const outcomes: Record<string, number> = {}
      for (const a of coldCalls) {
        const outcome = a[COLD_CALL_ENTSCHEIDER] || 'Nicht erfasst'
        outcomes[outcome] = (outcomes[outcome] || 0) + 1
      }
      for (const a of followUps) {
        const outcome = a[FOLLOW_UP_NAECHSTER_SCHRITT] || 'Nicht erfasst'
        outcomes[outcome] = (outcomes[outcome] || 0) + 1
      }
      return outcomes
    }

    const entscheiderOutcomesToday = getEntscheiderOutcomes(todayDateISO)
    const entscheiderOutcomesWeek = getEntscheiderOutcomes(weekStartDate)
    const entscheiderOutcomesMonth = getEntscheiderOutcomes(monthStart)

    // Setting outcome breakdown — ALL outcomes so totals match
    const SETTING_SUCCESS = new Set(['2. Closing gelegt auf:'])

    function getSettingOutcomes(dateGte: string): Record<string, number> {
      const settings = filterActivities(CUSTOM_ACTIVITY_TYPES.setting, dateGte)
      const outcomes: Record<string, number> = {}
      for (const a of settings) {
        const outcome = a[SETTING_NAECHSTER_SCHRITT] || 'Nicht erfasst'
        outcomes[outcome] = (outcomes[outcome] || 0) + 1
      }
      return outcomes
    }

    const settingOutcomesToday = getSettingOutcomes(todayDateISO)
    const settingOutcomesWeek = getSettingOutcomes(weekStartDate)
    const settingOutcomesMonth = getSettingOutcomes(monthStart)

    // Einwand breakdown — what specific objection did the Entscheider have?
    function getEinwandBreakdown(dateGte: string): Record<string, number> {
      const coldCalls = filterActivities(CUSTOM_ACTIVITY_TYPES.coldCall, dateGte)
      const outcomes: Record<string, number> = {}
      for (const a of coldCalls) {
        const einwand = a[COLD_CALL_EINWAND]
        if (einwand) {
          outcomes[einwand] = (outcomes[einwand] || 0) + 1
        }
      }
      return outcomes
    }

    const einwandToday = getEinwandBreakdown(todayDateISO)
    const einwandWeek = getEinwandBreakdown(weekStartDate)
    const einwandMonth = getEinwandBreakdown(monthStart)

    // Setting quality metrics
    const settingProtocolsMonth = filterActivities(CUSTOM_ACTIVITY_TYPES.setting, monthStart).length
    const settingProtocolsWeek = filterActivities(CUSTOM_ACTIVITY_TYPES.setting, weekStartDate).length

    // Team roles
    const OPENER_NAMES = ['Taha Keremoglu', 'Johannes Bohn']
    const SETTER_NAMES = ['Felix Zoepp']
    const CLOSER_NAMES = ['Felix Zoepp']

    // Extended team performance with opener-specific KPIs
    interface TeamMemberPerformance {
      name: string
      role: 'opener' | 'setter' | 'closer' | 'opener+setter' | 'setter+closer' | 'all'
      calls: number
      coldCallProtocols: number
      followUpProtocols: number
      entscheiderErreicht: number
      settingsGelegt: number
      closingsGelegt: number
      callsPerEntscheider: number
      callsPerSetting: number
    }

    function getTeamPerformance(dateGte: string, callsByUser: Record<string, number>): TeamMemberPerformance[] {
      const coldCalls = filterActivities(CUSTOM_ACTIVITY_TYPES.coldCall, dateGte)
      const followUps = filterActivities(CUSTOM_ACTIVITY_TYPES.followUp, dateGte)
      const settingActs = filterActivities(CUSTOM_ACTIVITY_TYPES.setting, dateGte)

      const memberMap: Record<string, Omit<TeamMemberPerformance, 'callsPerEntscheider' | 'callsPerSetting'>> = {}

      function ensure(name: string) {
        if (!memberMap[name]) {
          let role: TeamMemberPerformance['role'] = 'all'
          const isOpener = OPENER_NAMES.includes(name)
          const isSetter = SETTER_NAMES.includes(name)
          const isCloser = CLOSER_NAMES.includes(name)
          if (isOpener && !isSetter && !isCloser) role = 'opener'
          else if (isSetter && isCloser) role = 'setter+closer'
          else if (isSetter) role = 'setter'
          else if (isCloser) role = 'closer'
          memberMap[name] = { name, role, calls: 0, coldCallProtocols: 0, followUpProtocols: 0, entscheiderErreicht: 0, settingsGelegt: 0, closingsGelegt: 0 }
        }
      }

      // Calls per member
      for (const [name, count] of Object.entries(callsByUser)) {
        ensure(name)
        memberMap[name].calls = count
      }

      // Cold Call protocols per member
      for (const a of coldCalls) {
        const name = a.user_name || 'Unbekannt'
        ensure(name)
        memberMap[name].coldCallProtocols++
        // Entscheider erreicht
        if (a[COLD_CALL_ENTSCHEIDER] && a[COLD_CALL_NIEMAND_ERREICHT] !== 'Ja') {
          memberMap[name].entscheiderErreicht++
        }
        // Settings gelegt from cold calls
        if (a[COLD_CALL_ENTSCHEIDER] === 'Setting vereinbart am:') {
          memberMap[name].settingsGelegt++
        }
      }

      // Follow-Up protocols per member
      for (const a of followUps) {
        const name = a.user_name || 'Unbekannt'
        ensure(name)
        memberMap[name].followUpProtocols++
        // Entscheider erreicht from follow-ups
        if (a[FOLLOW_UP_NAECHSTER_SCHRITT] && a[FOLLOW_UP_NAECHSTER_SCHRITT] !== '5. Nicht erreicht') {
          memberMap[name].entscheiderErreicht++
        }
        // Settings from follow-ups
        if (a[FOLLOW_UP_NAECHSTER_SCHRITT] === '2. Setting gelegt am:') {
          memberMap[name].settingsGelegt++
        }
        // Closings from follow-ups
        if (a[FOLLOW_UP_NAECHSTER_SCHRITT] === '3. Closing gelegt am:') {
          memberMap[name].closingsGelegt++
        }
      }

      // Closings from setting protocols
      for (const a of settingActs.filter((a: any) => a[SETTING_NAECHSTER_SCHRITT] === '2. Closing gelegt auf:')) {
        const name = a.user_name || 'Unbekannt'
        ensure(name)
        memberMap[name].closingsGelegt++
      }

      return Object.values(memberMap)
        .map(m => ({
          ...m,
          callsPerEntscheider: m.entscheiderErreicht > 0 ? Math.round((m.calls / m.entscheiderErreicht) * 10) / 10 : 0,
          callsPerSetting: m.settingsGelegt > 0 ? Math.round((m.calls / m.settingsGelegt) * 10) / 10 : 0,
        }))
        .sort((a, b) => b.settingsGelegt - a.settingsGelegt || b.calls - a.calls)
    }

    const teamPerformanceToday = getTeamPerformance(todayDateISO,
      countCallsByUser(allMonthCalls.filter((a: any) => a.date_created >= todayDateISO))
    )
    const teamPerformanceWeek = getTeamPerformance(weekStartDate,
      countCallsByUser(allMonthCalls.filter((a: any) => a.date_created >= weekStartDate))
    )
    const teamPerformanceMonth = getTeamPerformance(monthStart, callsByUserMonth)
    // teamPerformanceAllTime is computed after year data is fetched (see below)

    // Settings gelegt = Cold Call mit Entscheider "Setting vereinbart am:" + Follow-Up mit "2. Setting gelegt am:"
    function countSettingsGelegt(dateGte: string): number {
      const coldCalls = filterActivities(CUSTOM_ACTIVITY_TYPES.coldCall, dateGte)
      const followUps = filterActivities(CUSTOM_ACTIVITY_TYPES.followUp, dateGte)
      const fromColdCalls = coldCalls.filter((a: any) => a[COLD_CALL_ENTSCHEIDER] === 'Setting vereinbart am:').length
      const fromFollowUps = followUps.filter((a: any) => {
        const step = a[FOLLOW_UP_NAECHSTER_SCHRITT]
        return step === '2. Setting gelegt am:'
      }).length
      return fromColdCalls + fromFollowUps
    }

    const settingsGelegtToday = countSettingsGelegt(todayDateISO)
    const settingsGelegtWeek = countSettingsGelegt(weekStartDate)
    const settingsGelegtMonth = countSettingsGelegt(monthStart)

    // Closings gelegt = Setting mit "2. Closing gelegt auf:" + Follow-Up mit "3. Closing gelegt am:"
    function countClosingsGelegt(dateGte: string): number {
      const settings = filterActivities(CUSTOM_ACTIVITY_TYPES.setting, dateGte)
      const followUps = filterActivities(CUSTOM_ACTIVITY_TYPES.followUp, dateGte)
      const fromSettings = settings.filter((a: any) => a[SETTING_NAECHSTER_SCHRITT] === '2. Closing gelegt auf:').length
      const fromFollowUps = followUps.filter((a: any) => a[FOLLOW_UP_NAECHSTER_SCHRITT] === '3. Closing gelegt am:').length
      return fromSettings + fromFollowUps
    }

    const closingsGelegtToday = countClosingsGelegt(todayDateISO)
    const closingsGelegtWeek = countClosingsGelegt(weekStartDate)
    const closingsGelegtMonth = countClosingsGelegt(monthStart)

    // Funnel efficiency ratios (month-based)
    const funnelRatios = {
      anwahlenProEntscheider: entscheiderMonthCount > 0 ? Math.round((anwahlenMonth / entscheiderMonthCount) * 10) / 10 : 0,
      anwahlenProSetting: settingsGelegtMonth > 0 ? Math.round((anwahlenMonth / settingsGelegtMonth) * 10) / 10 : 0,
      settingsProClosing: closingsGelegtMonth > 0 ? Math.round((settingsGelegtMonth / closingsGelegtMonth) * 10) / 10 : 0,
      closingsProWon: wonThisMonth.length > 0 ? Math.round((closingsGelegtMonth / wonThisMonth.length) * 10) / 10 : 0,
      anwahlenProWon: wonThisMonth.length > 0 ? Math.round((anwahlenMonth / wonThisMonth.length) * 10) / 10 : 0,
      entscheiderProSetting: settingsGelegtMonth > 0 ? Math.round((entscheiderMonthCount / settingsGelegtMonth) * 10) / 10 : 0,
    }

    // Won deals for week period
    const weekStartISODate = formatDateISO(getISOWeekStart(currentYear, currentWeek))
    const wonThisWeek = wonDeals.filter((o: any) => o.date_won && o.date_won >= weekStartISODate)
    const wonRevenueWeek = wonThisWeek.reduce((sum: number, o: any) => sum + (o.value || 0), 0) / 100
    const wonRevenueMonth = revenueMTD

    // Pipeline snapshot counts
    const pipelineSnapshot = {
      settingTerminiert: 0,
      settingNoShow: 0,
      settingFollowUp: 0,
      closingTerminiert: 0,
      closingNoShow: 0,
      closingFollowUp: 0,
      angebotVerschickt: 0,
      cc2Terminiert: 0,
    }
    const snapshotMapping: Record<string, keyof typeof pipelineSnapshot> = {
      'stat_SJMKmHyG1PUg5y6pcFZiEHKEIWVrFf7IDMpF1O31AgA': 'settingTerminiert',
      'stat_09b2m2xI4kxcxHjgE3Xbb3n7rzE3ygpmBX4zIXR1I5f': 'settingNoShow',
      'stat_esHRwS41irQis8aYyfk55CRjyrV5bhEB6c03qWdU3So': 'settingFollowUp',
      'stat_G4vinr4M5aNginkr1nNkxS7Mt2sEFFELsmOfrBMGCG4': 'closingTerminiert',
      'stat_XTjldovdZz1SvfOfi8nzTCbm5o9mUAVDwZ6jdSZ1V3R': 'closingNoShow',
      'stat_WJks2iEcai6sgu3dokyOSKud5oWTIWKo3IQaDSO9aDZ': 'closingFollowUp',
      'stat_yIC8eUAp0OBYggJ1qqasmM3iosOh9rnrsEXJEtzSBpe': 'angebotVerschickt',
      'stat_jwxdfe98lRYRhNRE9lPxo0oJ8tJIcJ7lCIVUTnVRzY2': 'cc2Terminiert',
    }
    for (const deal of activeDeals) {
      const key = snapshotMapping[deal.status_id]
      if (key) pipelineSnapshot[key]++
    }

    // Settings gelegt = Opps currently in any Setting stage (booked from Cold Calls/Follow-Ups)
    const totalSettingsGelegt = pipelineSnapshot.settingTerminiert + pipelineSnapshot.settingNoShow + pipelineSnapshot.settingFollowUp
    // Closings gelegt = Opps currently in any Closing stage (booked from Settings)
    const totalClosingsGelegt = pipelineSnapshot.closingTerminiert + pipelineSnapshot.closingNoShow + pipelineSnapshot.closingFollowUp + pipelineSnapshot.angebotVerschickt + pipelineSnapshot.cc2Terminiert

    // Conversion rates (month-based, using custom activity data)
    const quotenErreichquote = anwahlenMonth > 0 ? Math.round((entscheiderMonthCount / anwahlenMonth) * 1000) / 10 : 0
    const quotenSettingQuote = entscheiderMonthCount > 0 ? Math.round((settingsGelegtMonth / entscheiderMonthCount) * 1000) / 10 : 0
    const quotenClosingQuote = settingsGelegtMonth > 0 ? Math.round((closingsGelegtMonth / settingsGelegtMonth) * 1000) / 10 : 0
    const quotenAbschlussQuote = closingsGelegtMonth > 0 ? Math.round((wonThisMonth.length / closingsGelegtMonth) * 1000) / 10 : 0
    const quotenOverall = anwahlenMonth > 0 ? Math.round((wonThisMonth.length / anwahlenMonth) * 1000) / 10 : 0

    // All-time / Year funnel — fetch calls + activities from Jan 1st of current year
    const yearStartISO_calc = `${currentYear}-01-01`

    // Fetch year activities separately (custom activities beyond 90 days)
    let yearCustomActivities: any[] = []
    try {
      let hasMore = true
      let skip = 0
      const limit = 100
      while (hasMore) {
        const data = await closeApiFetch(
          `/activity/custom/?date_created__gte=${yearStartISO_calc}&_skip=${skip}&_limit=${limit}&_order_by=-date_created&_fields=id,custom_activity_type_id,date_created,user_name,${COLD_CALL_NIEMAND_ERREICHT},${COLD_CALL_ENTSCHEIDER},${COLD_CALL_EINWAND},${FOLLOW_UP_NAECHSTER_SCHRITT},${SETTING_NAECHSTER_SCHRITT}`
        )
        yearCustomActivities.push(...data.data)
        hasMore = data.has_more
        skip += limit
      }
    } catch {
      yearCustomActivities = []
    }

    function filterYearActivities(typeId: string) {
      return yearCustomActivities.filter((a: any) => a.custom_activity_type_id === typeId)
    }

    const allTimeCalls = await fetchCallsForPeriod(yearStartISO_calc)
    const anwahlenAllTime = allTimeCalls.length

    // Entscheider erreicht (year)
    const yearColdCalls = filterYearActivities(CUSTOM_ACTIVITY_TYPES.coldCall)
    const yearFollowUps = filterYearActivities(CUSTOM_ACTIVITY_TYPES.followUp)
    const yearSettings = filterYearActivities(CUSTOM_ACTIVITY_TYPES.setting)
    const entscheiderAllTime = yearColdCalls.filter((a: any) => a[COLD_CALL_ENTSCHEIDER] && a[COLD_CALL_NIEMAND_ERREICHT] !== 'Ja').length
      + yearFollowUps.filter((a: any) => a[FOLLOW_UP_NAECHSTER_SCHRITT] && a[FOLLOW_UP_NAECHSTER_SCHRITT] !== '5. Nicht erreicht').length
    const coldCallAllTime = yearColdCalls.length
    const followUpAllTime = yearFollowUps.length

    // Settings gelegt (year)
    const settingsGelegtAllTime = yearColdCalls.filter((a: any) => a[COLD_CALL_ENTSCHEIDER] === 'Setting vereinbart am:').length
      + yearFollowUps.filter((a: any) => a[FOLLOW_UP_NAECHSTER_SCHRITT] === '2. Setting gelegt am:').length

    // Closings gelegt (year)
    const closingsGelegtAllTime = yearSettings.filter((a: any) => a[SETTING_NAECHSTER_SCHRITT] === '2. Closing gelegt auf:').length
      + yearFollowUps.filter((a: any) => a[FOLLOW_UP_NAECHSTER_SCHRITT] === '3. Closing gelegt am:').length

    const wonThisYear = wonDeals.filter((o: any) => o.date_won && o.date_won >= yearStartISO_calc)
    const wonRevenueYear = wonThisYear.reduce((sum: number, o: any) => sum + (o.value || 0), 0) / 100

    const quotenAllTimeErreichquote = anwahlenAllTime > 0 ? Math.round((entscheiderAllTime / anwahlenAllTime) * 1000) / 10 : 0
    const quotenAllTimeSettingQuote = entscheiderAllTime > 0 ? Math.round((settingsGelegtAllTime / entscheiderAllTime) * 1000) / 10 : 0
    const quotenAllTimeClosingQuote = settingsGelegtAllTime > 0 ? Math.round((closingsGelegtAllTime / settingsGelegtAllTime) * 1000) / 10 : 0
    const quotenAllTimeAbschlussQuote = closingsGelegtAllTime > 0 ? Math.round((wonThisYear.length / closingsGelegtAllTime) * 1000) / 10 : 0
    const quotenAllTimeOverall = anwahlenAllTime > 0 ? Math.round((wonThisYear.length / anwahlenAllTime) * 1000) / 10 : 0

    // Year-level entscheider outcomes (ALL for full transparency)
    const entscheiderOutcomesYear: Record<string, number> = {}
    for (const a of yearColdCalls.filter((a: any) => a[COLD_CALL_ENTSCHEIDER] && a[COLD_CALL_NIEMAND_ERREICHT] !== 'Ja')) {
      const outcome = a[COLD_CALL_ENTSCHEIDER] || 'Nicht erfasst'
      entscheiderOutcomesYear[outcome] = (entscheiderOutcomesYear[outcome] || 0) + 1
    }
    for (const a of yearFollowUps.filter((a: any) => a[FOLLOW_UP_NAECHSTER_SCHRITT] && a[FOLLOW_UP_NAECHSTER_SCHRITT] !== '5. Nicht erreicht')) {
      const outcome = a[FOLLOW_UP_NAECHSTER_SCHRITT] || 'Nicht erfasst'
      entscheiderOutcomesYear[outcome] = (entscheiderOutcomesYear[outcome] || 0) + 1
    }

    // Year-level Einwand breakdown
    const einwandYear: Record<string, number> = {}
    for (const a of yearColdCalls) {
      const einwand = a[COLD_CALL_EINWAND]
      if (einwand) {
        einwandYear[einwand] = (einwandYear[einwand] || 0) + 1
      }
    }

    // Year-level setting outcomes (ALL)
    const settingOutcomesYear: Record<string, number> = {}
    for (const a of yearSettings) {
      const outcome = a[SETTING_NAECHSTER_SCHRITT] || 'Nicht erfasst'
      settingOutcomesYear[outcome] = (settingOutcomesYear[outcome] || 0) + 1
    }

    // Alltime team performance (using year data)
    const teamPerformanceAllTime = (() => {
      const callsByUser = countCallsByUser(allTimeCalls)

      const memberMap: Record<string, Omit<TeamMemberPerformance, 'callsPerEntscheider' | 'callsPerSetting'>> = {}

      function ensure(name: string) {
        if (!memberMap[name]) {
          let role: TeamMemberPerformance['role'] = 'all'
          const isOpener = OPENER_NAMES.includes(name)
          const isSetter = SETTER_NAMES.includes(name)
          const isCloser = CLOSER_NAMES.includes(name)
          if (isOpener && !isSetter && !isCloser) role = 'opener'
          else if (isSetter && isCloser) role = 'setter+closer'
          else if (isSetter) role = 'setter'
          else if (isCloser) role = 'closer'
          memberMap[name] = { name, role, calls: 0, coldCallProtocols: 0, followUpProtocols: 0, entscheiderErreicht: 0, settingsGelegt: 0, closingsGelegt: 0 }
        }
      }

      for (const [name, count] of Object.entries(callsByUser)) { ensure(name); memberMap[name].calls = count }
      for (const a of yearColdCalls) {
        const name = a.user_name || 'Unbekannt'; ensure(name)
        memberMap[name].coldCallProtocols++
        if (a[COLD_CALL_ENTSCHEIDER] && a[COLD_CALL_NIEMAND_ERREICHT] !== 'Ja') memberMap[name].entscheiderErreicht++
        if (a[COLD_CALL_ENTSCHEIDER] === 'Setting vereinbart am:') memberMap[name].settingsGelegt++
      }
      for (const a of yearFollowUps) {
        const name = a.user_name || 'Unbekannt'; ensure(name)
        memberMap[name].followUpProtocols++
        if (a[FOLLOW_UP_NAECHSTER_SCHRITT] && a[FOLLOW_UP_NAECHSTER_SCHRITT] !== '5. Nicht erreicht') memberMap[name].entscheiderErreicht++
        if (a[FOLLOW_UP_NAECHSTER_SCHRITT] === '2. Setting gelegt am:') memberMap[name].settingsGelegt++
        if (a[FOLLOW_UP_NAECHSTER_SCHRITT] === '3. Closing gelegt am:') memberMap[name].closingsGelegt++
      }
      for (const a of yearSettings.filter((a: any) => a[SETTING_NAECHSTER_SCHRITT] === '2. Closing gelegt auf:')) {
        const name = a.user_name || 'Unbekannt'; ensure(name)
        memberMap[name].closingsGelegt++
      }

      return Object.values(memberMap)
        .map(m => ({ ...m, callsPerEntscheider: m.entscheiderErreicht > 0 ? Math.round((m.calls / m.entscheiderErreicht) * 10) / 10 : 0, callsPerSetting: m.settingsGelegt > 0 ? Math.round((m.calls / m.settingsGelegt) * 10) / 10 : 0 }))
        .sort((a, b) => b.settingsGelegt - a.settingsGelegt || b.calls - a.calls)
    })()

    // Erstdeal vs Upsell breakdown per period
    // A deal is an upsell if the same lead_name has a PREVIOUS won deal
    function splitErstdealUpsell(deals: any[]) {
      // Sort by date to determine first deal per customer
      const sorted = [...deals].sort((a, b) => (a.date_won || '').localeCompare(b.date_won || ''))
      const seen = new Set<string>()
      let erstdeals = 0, upsells = 0, erstdealRevenue = 0, upsellRevenue = 0
      for (const d of sorted) {
        const name = d.lead_name || 'Unbekannt'
        const val = (d.value || 0) / 100
        // Check if this customer already has a won deal (either in this set or in all wonDeals before this date)
        const hasEarlierDeal = wonDeals.some((w: any) =>
          w.lead_name === name && w.status_id === WON_STATUS_ID && w.date_won && d.date_won && w.date_won < d.date_won
        ) || seen.has(name)
        if (hasEarlierDeal) {
          upsells++
          upsellRevenue += val
        } else {
          erstdeals++
          erstdealRevenue += val
        }
        seen.add(name)
      }
      const upsellRate = (erstdeals + upsells) > 0 ? Math.round((upsells / (erstdeals + upsells)) * 100) : 0
      return { erstdeals, upsells, erstdealRevenue, upsellRevenue, upsellRate }
    }

    const wonWeekSplit = splitErstdealUpsell(wonThisWeek)
    const wonMonthSplit = splitErstdealUpsell(wonThisMonth)
    const wonYearSplit = splitErstdealUpsell(wonThisYear)

    const salesFunnel = {
      today: {
        anwahlen: anwahlenToday,
        entscheiderErreicht: entscheiderTodayCount,
        coldCalls: coldCallToday,
        followUps: followUpToday,
        settingsGelegt: settingsGelegtToday,
        closingsGelegt: closingsGelegtToday,
        wonDeals: 0,
        wonRevenue: 0,
        erstdeals: 0, upsells: 0, erstdealRevenue: 0, upsellRevenue: 0, upsellRate: 0,
      },
      week: {
        anwahlen: anwahlenWeek,
        entscheiderErreicht: entscheiderWeekCount,
        coldCalls: coldCallWeek,
        followUps: followUpWeek,
        settingsGelegt: settingsGelegtWeek,
        closingsGelegt: closingsGelegtWeek,
        wonDeals: wonThisWeek.length,
        wonRevenue: wonRevenueWeek,
        ...wonWeekSplit,
      },
      month: {
        anwahlen: anwahlenMonth,
        entscheiderErreicht: entscheiderMonthCount,
        coldCalls: coldCallMonth,
        followUps: followUpMonth,
        settingsGelegt: settingsGelegtMonth,
        closingsGelegt: closingsGelegtMonth,
        wonDeals: wonThisMonth.length,
        wonRevenue: wonRevenueMonth,
        ...wonMonthSplit,
      },
      alltime: {
        anwahlen: anwahlenAllTime,
        entscheiderErreicht: entscheiderAllTime,
        coldCalls: coldCallAllTime,
        followUps: followUpAllTime,
        settingsGelegt: settingsGelegtAllTime,
        closingsGelegt: closingsGelegtAllTime,
        wonDeals: wonThisYear.length,
        wonRevenue: wonRevenueYear,
        ...wonYearSplit,
      },
      quoten: {
        erreichquote: quotenErreichquote,
        settingQuote: quotenSettingQuote,
        closingQuote: quotenClosingQuote,
        abschlussQuote: quotenAbschlussQuote,
        overallAnwahlenToWon: quotenOverall,
      },
      quotenAllTime: {
        erreichquote: quotenAllTimeErreichquote,
        settingQuote: quotenAllTimeSettingQuote,
        closingQuote: quotenAllTimeClosingQuote,
        abschlussQuote: quotenAllTimeAbschlussQuote,
        overallAnwahlenToWon: quotenAllTimeOverall,
      },
      pipeline: pipelineSnapshot,
    }

    // === Conversion Funnel ===
    const SETTING_IDS = [
      'stat_SJMKmHyG1PUg5y6pcFZiEHKEIWVrFf7IDMpF1O31AgA',
      'stat_09b2m2xI4kxcxHjgE3Xbb3n7rzE3ygpmBX4zIXR1I5f',
      'stat_esHRwS41irQis8aYyfk55CRjyrV5bhEB6c03qWdU3So',
    ]
    const CLOSING_IDS = [
      'stat_G4vinr4M5aNginkr1nNkxS7Mt2sEFFELsmOfrBMGCG4',
      'stat_XTjldovdZz1SvfOfi8nzTCbm5o9mUAVDwZ6jdSZ1V3R',
      'stat_WJks2iEcai6sgu3dokyOSKud5oWTIWKo3IQaDSO9aDZ',
    ]
    const ANGEBOT_ID = 'stat_yIC8eUAp0OBYggJ1qqasmM3iosOh9rnrsEXJEtzSBpe'
    const CC2_ID = 'stat_jwxdfe98lRYRhNRE9lPxo0oJ8tJIcJ7lCIVUTnVRzY2'

    const totalOpportunities = opportunities.length
    const reachedSetting = totalOpportunities // all start here
    // Everything that moved past Setting stage
    const reachedClosing = opportunities.filter((o: any) =>
      CLOSING_IDS.includes(o.status_id) ||
      o.status_id === ANGEBOT_ID ||
      o.status_id === CC2_ID ||
      o.status_id === WON_STATUS_ID ||
      o.status_id === LOST_STATUS_ID
    ).length

    const settingToClosingRate = reachedSetting > 0 ? Math.round((reachedClosing / reachedSetting) * 1000) / 10 : 0
    const closingToWonRate = reachedClosing > 0 ? Math.round((wonDeals.length / reachedClosing) * 1000) / 10 : 0
    const overallConversionRate = totalOpportunities > 0 ? Math.round((wonDeals.length / totalOpportunities) * 1000) / 10 : 0

    const conversionFunnel = {
      totalOpportunities,
      reachedSetting,
      reachedClosing,
      wonCount: wonDeals.length,
      lostCount: lostDeals.length,
      settingToClosingRate,
      closingToWonRate,
      overallConversionRate,
    }

    // === Waterfall ===
    const settingsPerClose = wonDeals.length > 0 ? Math.round((reachedSetting / wonDeals.length) * 10) / 10 : 0
    const closingsPerClose = wonDeals.length > 0 ? Math.round((reachedClosing / wonDeals.length) * 10) / 10 : 0

    // Average deal cycle: days from date_created to date_won for won deals
    let avgDealCycle = 0
    const wonWithDates = wonDeals.filter((o: any) => o.date_created && o.date_won)
    if (wonWithDates.length > 0) {
      const totalDays = wonWithDates.reduce((sum: number, o: any) => {
        const created = new Date(o.date_created).getTime()
        const won = new Date(o.date_won).getTime()
        return sum + (won - created) / 86400000
      }, 0)
      avgDealCycle = Math.round(totalDays / wonWithDates.length)
    }

    const waterfall = {
      settingsPerClose,
      closingsPerClose,
      totalOpps: totalOpportunities,
      avgDealCycle,
    }

    // Derived values
    const leadpoolCount = leadStatusCounts.find(s => s.label === 'Leadpool')?.count || 0
    const totalCalls8W = weeklyCallData.reduce((sum, w) => sum + w.calls, 0)
    const kundenCount = leadStatusCounts.find(s => s.label === 'Kunde')?.count || 0

    // Won deals formatted (current month only - for backwards compat)
    const wonDealsDisplay = wonThisMonth.map((o: any) => ({
      name: o.lead_name || 'Unbekannt',
      value: (o.value || 0) / 100,
      date: o.date_won || o.date_created || '',
      user: o.user_name || '',
    }))

    // ALL won deals with dates (for period filtering on client)
    const allWonDeals = wonDeals.map((o: any) => ({
      name: o.lead_name || 'Unbekannt',
      value: (o.value || 0) / 100,
      date: o.date_won || o.date_created || '',
      user: o.user_name || '',
    })).sort((a: any, b: any) => b.date.localeCompare(a.date))

    // ALL lost deals with dates
    const allLostDeals = lostDeals.map((o: any) => ({
      name: o.lead_name || 'Unbekannt',
      value: (o.value || 0) / 100,
      date: o.date_lost || o.date_created || '',
    })).sort((a: any, b: any) => b.date.localeCompare(a.date))

    // === Customer Analytics ===

    // Group won deals by lead_name to identify customers
    const customerMap: Record<string, {
      name: string;
      deals: { value: number; date: string; valuePeriod: string }[];
      totalRevenue: number;
      firstDeal: string;
      latestDeal: string;
      dealCount: number
    }> = {}

    for (const deal of wonDeals) {
      const name = deal.lead_name || 'Unbekannt'
      if (!customerMap[name]) {
        customerMap[name] = { name, deals: [], totalRevenue: 0, firstDeal: '', latestDeal: '', dealCount: 0 }
      }
      const entry = customerMap[name]
      const val = (deal.value || 0) / 100
      const date = deal.date_won || deal.date_created || ''
      entry.deals.push({ value: val, date, valuePeriod: deal.value_period || 'one_time' })
      entry.totalRevenue += val
      entry.dealCount++
      if (!entry.firstDeal || date < entry.firstDeal) entry.firstDeal = date
      if (!entry.latestDeal || date > entry.latestDeal) entry.latestDeal = date
    }

    const customers = Object.values(customerMap).sort((a, b) => b.totalRevenue - a.totalRevenue)

    // Upsell customers (more than 1 deal)
    const upsellCustomers = customers.filter(c => c.dealCount > 1)
    const singleDealCustomers = customers.filter(c => c.dealCount === 1)
    const upsellRate = customers.length > 0 ? Math.round((upsellCustomers.length / customers.length) * 100) : 0

    // Average CLV
    const avgCLV = customers.length > 0 ? Math.round(customers.reduce((s, c) => s + c.totalRevenue, 0) / customers.length) : 0

    // Revenue concentration (top 3 customers as % of total)
    const top3Revenue = customers.slice(0, 3).reduce((s, c) => s + c.totalRevenue, 0)
    const revenueConcentration = totalRevenue > 0 ? Math.round((top3Revenue / totalRevenue) * 100) : 0

    // Inactive customers (no deal in last 90 days = potential churn)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString().split('T')[0]
    const inactiveCustomers = customers.filter(c => c.latestDeal < ninetyDaysAgo)
    const activeCustomers = customers.filter(c => c.latestDeal >= ninetyDaysAgo)
    const churnRate = customers.length > 0 ? Math.round((inactiveCustomers.length / customers.length) * 100) : 0

    // Avg time between deals for upsell customers (in days)
    let avgTimeBetweenDeals = 0
    if (upsellCustomers.length > 0) {
      const totalDays = upsellCustomers.reduce((sum, c) => {
        const first = new Date(c.firstDeal).getTime()
        const last = new Date(c.latestDeal).getTime()
        return sum + (last - first) / 86400000
      }, 0)
      avgTimeBetweenDeals = Math.round(totalDays / upsellCustomers.length)
    }

    // Revenue from upsells vs first deals
    const upsellRevenue = upsellCustomers.reduce((s, c) => s + c.totalRevenue, 0)
    const upsellRevenueShare = totalRevenue > 0 ? Math.round((upsellRevenue / totalRevenue) * 100) : 0

    // Today's date as ISO string for client filtering
    const todayISO = formatDateISO(now)
    const weekStartISO = formatDateISO(getISOWeekStart(currentYear, currentWeek))
    const yearStartISO = `${currentYear}-01-01`

    // Month names
    const monthNames: Record<string, string> = {
      '01': 'Jan', '02': 'Feb', '03': 'Mrz', '04': 'Apr',
      '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Aug',
      '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Dez',
    }

    const monthlyChartData = monthlySorted
      .slice(0, 9)
      .reverse()
      .map(([key, val]) => ({
        label: monthNames[key.split('-')[1]] || key,
        value: val,
        isCurrent: key === currentMonthKey,
      }))

    const monthLong: Record<string, string> = {
      '01': 'Januar', '02': 'Februar', '03': 'M\u00e4rz', '04': 'April',
      '05': 'Mai', '06': 'Juni', '07': 'Juli', '08': 'August',
      '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Dezember',
    }

    const historicalPerformance = monthlySorted.slice(0, 7).map(([key, val]) => {
      const [y, m] = key.split('-')
      const monthDeals = wonDeals
        .filter((o: any) => o.date_won && o.date_won.startsWith(key))
        .map((o: any) => ({
          name: o.lead_name || 'Unbekannt',
          value: (o.value || 0) / 100,
          date: o.date_won || '',
          user: o.user_name || '',
        }))
        .sort((a: any, b: any) => b.value - a.value)
      return {
        label: `${monthLong[m] || m} ${y}`,
        value: val,
        isCurrent: key === currentMonthKey,
        deals: monthDeals,
      }
    })

    // Pipeline deals grouped by status (for drill-down)
    const pipelineDealsByStatus: Record<string, { leadName: string; value: number; date: string }[]> = {}
    for (const deal of activeDeals) {
      const label = PIPELINE_STATUSES[deal.status_id] || 'Unbekannt'
      if (!pipelineDealsByStatus[label]) {
        pipelineDealsByStatus[label] = []
      }
      pipelineDealsByStatus[label].push({
        leadName: deal.lead_name || 'Unbekannt',
        value: (deal.value || 0) / 100,
        date: deal.date_created || '',
      })
    }
    // Sort deals within each status by value desc
    for (const key of Object.keys(pipelineDealsByStatus)) {
      pipelineDealsByStatus[key].sort((a, b) => b.value - a.value)
    }

    // Pipeline split: Neukunde vs. Bestandskunde (for active deals)
    // A deal is "Bestandskunde" if the same lead_name has a previous won deal
    const wonLeadNames = new Set(wonDeals.map((d: any) => d.lead_name).filter(Boolean))

    const pipelineNeukunde: { leadName: string; status: string; value: number; date: string }[] = []
    const pipelineBestandskunde: { leadName: string; status: string; value: number; date: string }[] = []

    for (const deal of activeDeals) {
      const entry = {
        leadName: deal.lead_name || 'Unbekannt',
        status: PIPELINE_STATUSES[deal.status_id] || 'Unbekannt',
        value: (deal.value || 0) / 100,
        date: deal.date_created || '',
      }
      if (wonLeadNames.has(deal.lead_name)) {
        pipelineBestandskunde.push(entry)
      } else {
        pipelineNeukunde.push(entry)
      }
    }
    pipelineNeukunde.sort((a, b) => b.value - a.value)
    pipelineBestandskunde.sort((a, b) => b.value - a.value)

    const pipelineNeukundeValue = pipelineNeukunde.reduce((s, d) => s + d.value, 0)
    const pipelineBestandskundeValue = pipelineBestandskunde.reduce((s, d) => s + d.value, 0)

    // Upsell detail list (all won upsell deals with dates)
    const upsellDealsList: { leadName: string; value: number; date: string }[] = []
    const seenForUpsell = new Set<string>()
    const wonSortedForUpsell = [...wonDeals].sort((a: any, b: any) => (a.date_won || '').localeCompare(b.date_won || ''))
    for (const d of wonSortedForUpsell) {
      const name = d.lead_name || 'Unbekannt'
      const hasEarlier = wonDeals.some((w: any) =>
        w.lead_name === name && w.status_id === WON_STATUS_ID && w.date_won && d.date_won && w.date_won < d.date_won
      ) || seenForUpsell.has(name)
      if (hasEarlier) {
        upsellDealsList.push({ leadName: name, value: (d.value || 0) / 100, date: d.date_won || '' })
      }
      seenForUpsell.add(name)
    }
    upsellDealsList.sort((a, b) => b.date.localeCompare(a.date))

    const formattedDate = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`

    return {
      currentWeek,
      currentDate: formattedDate,
      currentDay,
      daysInMonth,
      currentMonthName: monthLong[String(currentMonth + 1).padStart(2, '0')] || '',
      currentYear,

      callsThisWeek: anwahlenWeek,
      callsLastWeek: weeklyCallData.length > 1 ? weeklyCallData[weeklyCallData.length - 2]?.calls || 0 : 0,
      wonDealsCount: wonThisMonth.length,
      wonDealsValue: revenueMTD,
      pipelineCount: activeDeals.length,
      pipelineValue,
      closingRate,
      wonTotal: wonDeals.length,
      closedTotal,
      avgDealSize,
      totalLeads,
      leadpoolCount,
      kundenCount,
      totalRevenue,
      totalLostValue,
      lostCount: lostDeals.length,
      totalCalls8W,

      wonDealsDisplay,
      pipelineSorted,
      pipelineDealsWithValue,
      leadStatusCounts,
      weeklyCallData,
      monthlyChartData,
      historicalPerformance,

      revenueMTD,
      linearForecast,
      pipelineWeightedForecast,
      avg3Months,

      salesFunnel,
      entscheiderOutcomesToday,
      entscheiderOutcomesWeek,
      entscheiderOutcomesMonth,
      entscheiderOutcomesYear,
      einwandToday,
      einwandWeek,
      einwandMonth,
      einwandYear,
      settingOutcomesToday,
      settingOutcomesWeek,
      settingOutcomesMonth,
      settingOutcomesYear,
      settingProtocolsMonth,
      settingProtocolsWeek,
      pipelineQualityAllTime,
      pipelineQualityWeek,
      pipelineQualityMonth,
      teamPerformanceToday,
      teamPerformanceWeek,
      teamPerformanceMonth,
      teamPerformanceAllTime,
      funnelRatios,
      allCustomActivities,
      customActivityTypeIds: CUSTOM_ACTIVITY_TYPES,
      customFieldIds: { COLD_CALL_NIEMAND_ERREICHT, COLD_CALL_ENTSCHEIDER, FOLLOW_UP_NAECHSTER_SCHRITT, SETTING_NAECHSTER_SCHRITT },
      // Total calls for the last 90 days from activity overview
      totalCallsLast90Days: await (async () => {
        try {
          const res = await closeApiFetch('/report/activity/overview/', {
            method: 'POST',
            body: JSON.stringify({ date_start: activitiesSince, date_end: formatDateISO(now) }),
          })
          return res?.aggregations?.calls_made || 0
        } catch { return 0 }
      })(),
      callsPerMonth: await (async () => {
        // Get calls for last month and current month separately
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
        try {
          const res = await closeApiFetch('/report/activity/overview/', {
            method: 'POST',
            body: JSON.stringify({ date_start: formatDateISO(lastMonthStart), date_end: formatDateISO(lastMonthEnd) }),
          })
          return { lastMonth: res?.aggregations?.calls_made || 0, lastMonthStart: formatDateISO(lastMonthStart), lastMonthEnd: formatDateISO(lastMonthEnd) }
        } catch { return { lastMonth: 0, lastMonthStart: '', lastMonthEnd: '' } }
      })(),
      conversionFunnel,
      waterfall,
      pipelineDealsByStatus,
      pipelineNeukunde,
      pipelineBestandskunde,
      pipelineNeukundeValue,
      pipelineBestandskundeValue,
      upsellDealsList,

      customerAnalytics: {
        customers,
        totalCustomers: customers.length,
        upsellCustomers: upsellCustomers.length,
        singleDealCustomers: singleDealCustomers.length,
        upsellRate,
        avgCLV,
        revenueConcentration,
        top3Revenue,
        inactiveCustomers: inactiveCustomers.length,
        activeCustomers: activeCustomers.length,
        churnRate,
        avgTimeBetweenDeals,
        upsellRevenue,
        upsellRevenueShare,
      },

      allWonDeals,
      allLostDeals,
      todayISO,
      weekStartISO,
      monthStartISO: monthStart,
      yearStartISO,

      airtableMetrics: getAirtableMetrics(),

      calendlyMetrics: await fetchCalendlyData(),

      nilsMetrics: getNilsMetrics(),

      deliveryMetrics: getDeliveryMetrics(),

      outreachMetrics: await fetchOutreachData(),

      marketingMetrics: await fetchMarketingData(),

      facebookMetrics: getFacebookMetrics(),

      callAnalysisMetrics: await fetchCallAnalysisData(),

      openerTracking: await fetchOpenerTracking(),

      lastUpdated: new Date().toISOString(),
    }
  } catch (error: any) {
    console.error('Close API error:', error)
    return { error: error.message || 'Failed to fetch data from Close CRM' }
  }
}
