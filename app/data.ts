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
  if (!apiKey) throw new Error('CLOSE_API_KEY not set')
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
            results_limit: 0,
            include_counts: true,
          }),
        })
        return { label: status.label, count: result.total_results || 0, color: status.color }
      } catch {
        return { label: status.label, count: 0, color: status.color }
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

    // Derived values
    const leadpoolCount = leadStatusCounts.find(s => s.label === 'Leadpool')?.count || 0
    const totalCalls8W = weeklyCallData.reduce((sum, w) => sum + w.calls, 0)
    const kundenCount = leadStatusCounts.find(s => s.label === 'Kunde')?.count || 0

    // Won deals formatted
    const wonDealsDisplay = wonThisMonth.map((o: any) => ({
      name: o.lead_name || 'Unbekannt',
      value: (o.value || 0) / 100,
      date: o.date_won || o.date_created || '',
      user: o.user_name || '',
    }))

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
      return {
        label: `${monthLong[m] || m} ${y}`,
        value: val,
        isCurrent: key === currentMonthKey,
      }
    })

    const formattedDate = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`

    return {
      currentWeek,
      currentDate: formattedDate,
      currentDay,
      daysInMonth,
      currentMonthName: monthLong[String(currentMonth + 1).padStart(2, '0')] || '',
      currentYear,

      callsThisWeek: weeklyCallData.length > 0 ? weeklyCallData[weeklyCallData.length - 1]?.calls || 0 : 0,
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

      lastUpdated: new Date().toISOString(),
    }
  } catch (error: any) {
    console.error('Close API error:', error)
    return { error: error.message || 'Failed to fetch data from Close CRM' }
  }
}
