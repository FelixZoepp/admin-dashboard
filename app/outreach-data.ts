// HeyReach API + Monday.com Board data for LinkedIn Outreach

const HEYREACH_BASE = 'https://api.heyreach.io/api/public'
const MONDAY_API = 'https://api.monday.com/v2'
const MONDAY_BOARD_ID = 5097670350

// Monday person IDs
const PERSON_IDS: Record<number, string> = {
  48344762: 'Felix',
  68110101: 'Marcel',
}

// Monday status index → label
const STATUS_LABELS: Record<number, string> = {
  0: 'In Bearbeitung',
  4: 'Anfrage gesendet',
  6: 'Angenommen',
  7: 'Permission-Ja',
  14: 'Erstnachricht gesendet',
  8: 'Video gesendet',
  9: 'Angeschaut',
  13: 'Video bereit',
  10: 'Geantwortet',
  11: 'Call gebucht',
  12: 'Kein Interesse',
  15: 'Abgelehnt nach Erstnachricht',
}

// Monday group IDs → phase labels
const GROUP_LABELS: Record<string, string> = {
  'topics': 'Phase 1 · Vernetzung',
  'group_mm4b1b0n': 'Phase 2 · Erstansprache',
  'group_mm4b6yzm': 'Phase 3 · Video-Produktion',
  'group_mm4bq7pm': 'Phase 4 · Versand & Tracking',
  'group_mm4bg8v3': 'Phase 5 · Follow-up & Abschluss',
}

export interface HeyReachStats {
  available: boolean
  connectionsSent: number
  connectionsAccepted: number
  connectionAcceptanceRate: number
  uniqueLeadsContacted: number
  messagesSent: number
  totalMessageStarted: number
  totalMessageReplies: number
  inmailMessagesSent: number
  profileViews: number
  postLikes: number
  follows: number
  replyRate: number
  dailyStats: {
    date: string
    connectionsSent: number
    connectionsAccepted: number
    messagesSent: number
    replies: number
    profileViews: number
  }[]
  campaigns: {
    id: number
    name: string
    status: string
    accountIds: number[]
    progress: {
      totalUsers: number
      inProgress: number
      pending: number
      finished: number
    }
  }[]
  accounts: {
    accountId: number
    connectionsSent: number
    connectionsAccepted: number
    messagesSent: number
    replies: number
    uniqueLeadsContacted: number
    acceptanceRate: number
  }[]
}

export interface MondayPipeline {
  available: boolean
  totalLeads: number
  totalConnectionsSent: number
  funnel: Record<string, number>
  phases: Record<string, number>
  milestones: {
    angenommen: number
    geantwortet: number
    termin: number
  }
  members: {
    name: string
    totalLeads: number
    anfrageGesendet: number
    angenommen: number
    erstnachrichtGesendet: number
    geantwortet: number
    callGebucht: number
    keinInteresse: number
  }[]
  recentActivity: {
    name: string
    company: string | null
    status: string
    statusColor: string
    updatedAt: string
    assignee: string | null
    group: string
  }[]
}

export interface OutreachMetrics {
  available: boolean
  heyreach: HeyReachStats
  monday: MondayPipeline
  rates: {
    acceptanceRate: number
    replyRate: number
    bookingRate: number
    overallConversion: number
  }
}

function pct(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 1000) / 10 : 0
}

// ── HeyReach ──────────────────────────────────────────────

async function fetchHeyReachCampaigns(apiKey: string): Promise<HeyReachStats['campaigns']> {
  try {
    const res = await fetch(`${HEYREACH_BASE}/campaign/GetAll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({ offset: 0, limit: 100 }),
    })

    if (!res.ok) {
      console.error('HeyReach campaigns API error:', res.status, await res.text())
      return []
    }

    const data = await res.json()
    const items = Array.isArray(data) ? data : (data?.items || data?.campaigns || [])
    return items.map((c: any) => ({
      id: c.id || 0,
      name: c.name || '',
      status: c.status || '',
      accountIds: c.campaignAccountIds || [],
      progress: {
        totalUsers: c.progressStats?.totalUsers || 0,
        inProgress: c.progressStats?.totalUsersInProgress || 0,
        pending: c.progressStats?.totalUsersPending || 0,
        finished: c.progressStats?.totalUsersFinished || 0,
      },
    }))
  } catch (error) {
    console.error('HeyReach campaigns fetch error:', error)
    return []
  }
}

const EMPTY_HEYREACH: HeyReachStats = {
  available: false,
  connectionsSent: 0, connectionsAccepted: 0, connectionAcceptanceRate: 0,
  uniqueLeadsContacted: 0, messagesSent: 0, totalMessageStarted: 0,
  totalMessageReplies: 0, inmailMessagesSent: 0, profileViews: 0,
  postLikes: 0, follows: 0, replyRate: 0,
  dailyStats: [], campaigns: [], accounts: [],
}

async function fetchAccountStats(apiKey: string, accountId: number, startDate: string, endDate: string): Promise<HeyReachStats['accounts'][0]> {
  try {
    const res = await fetch(`${HEYREACH_BASE}/stats/GetOverallStats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      body: JSON.stringify({ accountIds: [accountId], campaignIds: [], startDate, endDate }),
    })
    if (!res.ok) return { accountId, connectionsSent: 0, connectionsAccepted: 0, messagesSent: 0, replies: 0, uniqueLeadsContacted: 0, acceptanceRate: 0 }
    const data = await res.json()
    const s = data.overallStats || {}
    return {
      accountId,
      connectionsSent: s.connectionsSent || 0,
      connectionsAccepted: s.connectionsAccepted || 0,
      messagesSent: s.messagesSent || 0,
      replies: s.totalMessageReplies || 0,
      uniqueLeadsContacted: s.uniqueLeadsContacted || 0,
      acceptanceRate: Math.round((s.connectionAcceptanceRate || 0) * 1000) / 10,
    }
  } catch {
    return { accountId, connectionsSent: 0, connectionsAccepted: 0, messagesSent: 0, replies: 0, uniqueLeadsContacted: 0, acceptanceRate: 0 }
  }
}

async function fetchHeyReachStats(): Promise<HeyReachStats> {
  const apiKey = process.env.HEYREACH_API_KEY
  if (!apiKey) return { ...EMPTY_HEYREACH }

  try {
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const [statsRes, campaigns] = await Promise.all([
      fetch(`${HEYREACH_BASE}/stats/GetOverallStats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
        },
        body: JSON.stringify({ accountIds: [], campaignIds: [], startDate, endDate }),
      }),
      fetchHeyReachCampaigns(apiKey),
    ])

    if (!statsRes.ok) {
      console.error('HeyReach API error:', statsRes.status, await statsRes.text())
      return { ...EMPTY_HEYREACH }
    }

    const data = await statsRes.json()
    const overall = data.overallStats || {}
    const byDayRaw = data.byDayStats

    // byDayStats is a dict with ISO date keys, not an array
    let dailyStats: HeyReachStats['dailyStats'] = []
    if (byDayRaw && typeof byDayRaw === 'object' && !Array.isArray(byDayRaw)) {
      dailyStats = Object.entries(byDayRaw)
        .map(([dateKey, d]: [string, any]) => ({
          date: dateKey.split('T')[0],
          connectionsSent: d.connectionsSent || 0,
          connectionsAccepted: d.connectionsAccepted || 0,
          messagesSent: d.messagesSent || 0,
          replies: d.totalMessageReplies || 0,
          profileViews: d.profileViews || 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
    } else if (Array.isArray(byDayRaw)) {
      // Fallback for array format
      dailyStats = byDayRaw.map((d: any) => ({
        date: (d.date || '').split('T')[0],
        connectionsSent: d.connectionsSent || 0,
        connectionsAccepted: d.connectionsAccepted || 0,
        messagesSent: d.messagesSent || 0,
        replies: d.totalMessageReplies || 0,
        profileViews: d.profileViews || 0,
      }))
    }

    // Collect all unique account IDs from campaigns
    const allAccountIds = [...new Set(campaigns.flatMap(c => c.accountIds))]

    // Fetch per-account stats in parallel
    const accounts = allAccountIds.length > 0
      ? await Promise.all(allAccountIds.map(id => fetchAccountStats(apiKey, id, startDate, endDate)))
      : []

    const messagesSent = overall.messagesSent || 0
    const totalMessageReplies = overall.totalMessageReplies || 0

    return {
      available: true,
      connectionsSent: overall.connectionsSent || 0,
      connectionsAccepted: overall.connectionsAccepted || 0,
      connectionAcceptanceRate: Math.round((overall.connectionAcceptanceRate || 0) * 1000) / 10,
      uniqueLeadsContacted: overall.uniqueLeadsContacted || 0,
      messagesSent,
      totalMessageStarted: overall.totalMessageStarted || 0,
      totalMessageReplies,
      inmailMessagesSent: overall.inmailMessagesSent || 0,
      profileViews: overall.profileViews || 0,
      postLikes: overall.postLikes || 0,
      follows: overall.follows || 0,
      replyRate: pct(totalMessageReplies, messagesSent),
      dailyStats,
      campaigns,
      accounts,
    }
  } catch (error) {
    console.error('HeyReach fetch error:', error)
    return { ...EMPTY_HEYREACH }
  }
}

// ── Monday.com ────────────────────────────────────────────

interface MondayItem {
  id: string
  name: string
  group: { id: string; title: string }
  column_values: { id: string; text: string; value: string | null }[]
}

async function mondayQuery(query: string, token: string): Promise<any> {
  const res = await fetch(MONDAY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token,
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) {
    throw new Error(`Monday API ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

async function fetchAllMondayItems(token: string): Promise<MondayItem[]> {
  const columns = '["multiple_person_mm3xptbs", "color_mm3xcxzp", "text_mm3xp48q", "date_mm3x84fc", "color_mm4mn1s4", "color_mm4mexbj", "color_mm4matf3"]'

  // First page
  const firstQuery = `{ boards(ids: ${MONDAY_BOARD_ID}) { items_page(limit: 500) { cursor items { id name group { id title } column_values(ids: ${columns}) { id text value } } } } }`
  const firstResult = await mondayQuery(firstQuery, token)
  const firstPage = firstResult?.data?.boards?.[0]?.items_page
  if (!firstPage) return []

  const allItems: MondayItem[] = [...(firstPage.items || [])]
  let cursor = firstPage.cursor

  // Paginate
  while (cursor) {
    const nextQuery = `{ next_items_page(limit: 500, cursor: "${cursor}") { cursor items { id name group { id title } column_values(ids: ${columns}) { id text value } } } }`
    const nextResult = await mondayQuery(nextQuery, token)
    const nextPage = nextResult?.data?.next_items_page
    if (!nextPage || !nextPage.items?.length) break
    allItems.push(...nextPage.items)
    cursor = nextPage.cursor
  }

  return allItems
}

function getColumnValue(item: MondayItem, colId: string): string {
  const col = item.column_values.find(c => c.id === colId)
  return col?.text || ''
}

function getColumnRaw(item: MondayItem, colId: string): string | null {
  const col = item.column_values.find(c => c.id === colId)
  return col?.value || null
}

function getStatusIndex(item: MondayItem): number | null {
  const raw = getColumnRaw(item, 'color_mm3xcxzp')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed.index === 'number' ? parsed.index : null
  } catch {
    return null
  }
}

function getAssigneeIds(item: MondayItem): number[] {
  const raw = getColumnRaw(item, 'multiple_person_mm3xptbs')
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return (parsed.personsAndTeams || [])
      .filter((p: any) => p.kind === 'person')
      .map((p: any) => p.id as number)
  } catch {
    return []
  }
}

function getLastTouchDate(item: MondayItem): string | null {
  return getColumnValue(item, 'date_mm3x84fc') || null
}

function hasMilestone(item: MondayItem, colId: string): boolean {
  const raw = getColumnRaw(item, colId)
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw)
    // A milestone is set when the status has an index (not null/empty)
    return typeof parsed.index === 'number'
  } catch {
    return false
  }
}

async function fetchMondayPipeline(): Promise<MondayPipeline> {
  const token = process.env.MONDAY_API_TOKEN
  if (!token) {
    return {
      available: false, totalLeads: 0, totalConnectionsSent: 0, funnel: {}, phases: {},
      milestones: { angenommen: 0, geantwortet: 0, termin: 0 },
      members: [], recentActivity: [],
    }
  }

  try {
    const items = await fetchAllMondayItems(token)

    // Funnel: count items per status
    const funnel: Record<string, number> = {}
    for (const label of Object.values(STATUS_LABELS)) {
      funnel[label] = 0
    }

    // Phases: count items per group
    const phases: Record<string, number> = {}
    for (const label of Object.values(GROUP_LABELS)) {
      phases[label] = 0
    }

    // Milestones
    let milestoneAngenommen = 0
    let milestoneGeantwortet = 0
    let milestoneTermin = 0

    // Per-person tracking
    const personStats: Record<number, {
      totalLeads: number
      anfrageGesendet: number
      angenommen: number
      erstnachrichtGesendet: number
      geantwortet: number
      callGebucht: number
      keinInteresse: number
    }> = {}

    for (const pid of Object.keys(PERSON_IDS)) {
      const id = Number(pid)
      personStats[id] = {
        totalLeads: 0, anfrageGesendet: 0, angenommen: 0,
        erstnachrichtGesendet: 0, geantwortet: 0, callGebucht: 0, keinInteresse: 0,
      }
    }

    // Status indices — cumulative: once a lead passes a stage, they count for it
    // All statuses where a connection request was sent (Anfrage gesendet or beyond)
    const CONNECTION_SENT_INDICES = [4, 6, 7, 14, 8, 9, 13, 10, 11, 12, 15]
    // All statuses where connection was accepted (Angenommen or beyond, excl. Kein Interesse/Abgelehnt)
    const ACCEPTED_INDICES = [6, 7, 14, 8, 9, 13, 10, 11]
    // All statuses where Erstnachricht was sent
    const ERSTNACHRICHT_INDICES = [14, 8, 9, 13, 10, 11]
    // Geantwortet or beyond
    const GEANTWORTET_INDICES = [10, 11]
    // Call gebucht
    const CALL_INDICES = [11]
    // Kein Interesse / Abgelehnt
    const KEIN_INTERESSE_INDICES = [12, 15]

    let totalConnectionsSent = 0

    for (const item of items) {
      const statusIdx = getStatusIndex(item)
      const statusLabel = statusIdx !== null ? STATUS_LABELS[statusIdx] : null

      if (statusLabel && statusLabel in funnel) {
        funnel[statusLabel]++
      }

      // Count total connections sent (cumulative)
      if (statusIdx !== null && CONNECTION_SENT_INDICES.includes(statusIdx)) {
        totalConnectionsSent++
      }

      // Phase counting
      const groupLabel = GROUP_LABELS[item.group?.id] || item.group?.title || 'Unbekannt'
      phases[groupLabel] = (phases[groupLabel] || 0) + 1

      // Milestones (cumulative checkboxes)
      if (hasMilestone(item, 'color_mm4mn1s4')) milestoneAngenommen++
      if (hasMilestone(item, 'color_mm4mexbj')) milestoneGeantwortet++
      if (hasMilestone(item, 'color_mm4matf3')) milestoneTermin++

      // Per-person — cumulative stats based on current status
      const assignees = getAssigneeIds(item)
      for (const pid of assignees) {
        if (!personStats[pid]) {
          personStats[pid] = {
            totalLeads: 0, anfrageGesendet: 0, angenommen: 0,
            erstnachrichtGesendet: 0, geantwortet: 0, callGebucht: 0, keinInteresse: 0,
          }
        }
        personStats[pid].totalLeads++
        if (statusIdx !== null) {
          if (CONNECTION_SENT_INDICES.includes(statusIdx)) personStats[pid].anfrageGesendet++
          if (ACCEPTED_INDICES.includes(statusIdx)) personStats[pid].angenommen++
          if (ERSTNACHRICHT_INDICES.includes(statusIdx)) personStats[pid].erstnachrichtGesendet++
          if (GEANTWORTET_INDICES.includes(statusIdx)) personStats[pid].geantwortet++
          if (CALL_INDICES.includes(statusIdx)) personStats[pid].callGebucht++
          if (KEIN_INTERESSE_INDICES.includes(statusIdx)) personStats[pid].keinInteresse++
        }
      }
    }

    // Build members array
    const members = Object.entries(personStats)
      .map(([pid, stats]) => ({
        name: PERSON_IDS[Number(pid)] || `ID ${pid}`,
        ...stats,
      }))
      .sort((a, b) => b.callGebucht - a.callGebucht || b.angenommen - a.angenommen)

    // Recent activity: items sorted by Letzter Touch, take 20
    const recentActivity = items
      .map(item => {
        const statusIdx = getStatusIndex(item)
        const statusLabel = statusIdx !== null ? (STATUS_LABELS[statusIdx] || `Status ${statusIdx}`) : 'Unbekannt'
        const assignees = getAssigneeIds(item)
        const assigneeName = assignees.map(id => PERSON_IDS[id] || `ID ${id}`).join(', ') || null
        const groupLabel = GROUP_LABELS[item.group?.id] || item.group?.title || ''

        // Status color mapping
        const STATUS_COLORS: Record<number, string> = {
          0: '#fdab3d', 4: '#9d50dd', 6: '#037f4c', 7: '#579bfc',
          14: '#784bd1', 8: '#cab641', 9: '#ffcb00', 13: '#ff5ac4',
          10: '#333333', 11: '#bb3354', 12: '#ff007f', 15: '#9cd326',
        }

        return {
          name: item.name,
          company: getColumnValue(item, 'text_mm3xp48q') || null,
          status: statusLabel,
          statusColor: statusIdx !== null ? (STATUS_COLORS[statusIdx] || '#64748b') : '#64748b',
          updatedAt: getLastTouchDate(item) || '',
          assignee: assigneeName,
          group: groupLabel,
        }
      })
      .filter(a => a.updatedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 20)

    return {
      available: true,
      totalLeads: items.length,
      totalConnectionsSent,
      funnel,
      phases,
      milestones: {
        angenommen: milestoneAngenommen,
        geantwortet: milestoneGeantwortet,
        termin: milestoneTermin,
      },
      members,
      recentActivity,
    }
  } catch (error) {
    console.error('Monday.com fetch error:', error)
    return {
      available: false, totalLeads: 0, totalConnectionsSent: 0, funnel: {}, phases: {},
      milestones: { angenommen: 0, geantwortet: 0, termin: 0 },
      members: [], recentActivity: [],
    }
  }
}

// ── Combined fetch ────────────────────────────────────────

export async function fetchOutreachData(): Promise<OutreachMetrics> {
  const [heyreach, monday] = await Promise.all([
    fetchHeyReachStats(),
    fetchMondayPipeline(),
  ])

  const available = heyreach.available || monday.available

  // Compute cross-source rates using cumulative counts
  const anfrageTotal = monday.totalConnectionsSent
  const angenommenTotal = monday.milestones.angenommen
  const geantwortetTotal = monday.milestones.geantwortet
  const terminTotal = monday.milestones.termin

  return {
    available,
    heyreach,
    monday,
    rates: {
      acceptanceRate: pct(angenommenTotal, anfrageTotal),
      replyRate: pct(geantwortetTotal, angenommenTotal),
      bookingRate: pct(terminTotal, geantwortetTotal),
      overallConversion: pct(terminTotal, anfrageTotal),
    },
  }
}
