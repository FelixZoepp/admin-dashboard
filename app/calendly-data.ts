const CALENDLY_API_BASE = 'https://api.calendly.com'
const CALENDLY_USER_URI = 'https://api.calendly.com/users/b9c0a0df-5d55-47bf-b2fc-52de262932bc'

// Event type URI to category mapping
const SETTING_EVENT_TYPES = new Set([
  'https://api.calendly.com/event_types/1e20631b-92bc-48b1-b943-e37874718d4b', // Erstgespräch mit Felix Zoepp
  'https://api.calendly.com/event_types/3f5ccfb1-05f6-487e-a6b3-f7a439d38954', // Erstgespräch mit Content-Leads
  'https://api.calendly.com/event_types/da8d1726-8fa6-467e-88d0-51f1cf0fd67c', // Analysegespräch
  'https://api.calendly.com/event_types/7e2f0d69-e8d5-4a9d-a5de-ec1cb1f6f5e2', // Vorbereitung Demo
  'https://api.calendly.com/event_types/3733eb23-a9b6-43c4-8b93-02a383b76191', // Vorbereitungsgespräch allgemein
])

const CLOSING_EVENT_TYPES = new Set([
  'https://api.calendly.com/event_types/0acec799-916b-4747-a5de-64afa145b130', // 1:1 Beratungsgespräch
  'https://api.calendly.com/event_types/25230b7b-b59e-4c5a-85f0-69749b3714ac', // 1:1 Workshop
  'https://api.calendly.com/event_types/bd63a241-57da-425c-a4c0-f4d43a1010f4', // 60min Beratungsgespräch D2D
  'https://api.calendly.com/event_types/cbba44dd-ca78-4d2c-969a-a3a516eb89bd', // Content Session
  'https://api.calendly.com/event_types/46375abb-6ead-437e-b724-e33546e16b29', // Beratungsgespräch mit Content-Leads
  'https://api.calendly.com/event_types/5703de82-3a4d-4bc5-9e52-95dbfa7ec5b0', // Demo PitchFirst
  'https://api.calendly.com/event_types/c1af5d3f-7713-47e7-b8c7-ddd7e740ad9f', // 60 Minuten Beratungsgespräch legacy
])

const ONBOARDING_EVENT_TYPES = new Set([
  'https://api.calendly.com/event_types/f718e750-3546-46f5-b6a7-4d9de5e42589', // 30 Min Onboarding
])

export interface CalendlyEvent {
  name: string
  startTime: string // ISO
  endTime: string
  category: 'setting' | 'closing' | 'onboarding' | 'other'
  location: string // "Zoom", "Outbound Call", "Vor Ort"
}

export interface CalendlyMetrics {
  weekEvents: CalendlyEvent[]
  monthEvents: CalendlyEvent[]
  weekSettings: number
  weekClosings: number
  weekOnboardings: number
  weekOther: number
  monthSettings: number
  monthClosings: number
  monthOnboardings: number
  monthOther: number
}

function categorizeEvent(eventTypeUri: string): CalendlyEvent['category'] {
  if (SETTING_EVENT_TYPES.has(eventTypeUri)) return 'setting'
  if (CLOSING_EVENT_TYPES.has(eventTypeUri)) return 'closing'
  if (ONBOARDING_EVENT_TYPES.has(eventTypeUri)) return 'onboarding'
  return 'other'
}

function extractLocation(event: any): string {
  const loc = event.location
  if (!loc) return ''
  const type = loc.type || ''
  if (type.includes('zoom') || type.includes('google_meet') || type.includes('microsoft_teams') || type.includes('gotomeeting') || type.includes('webex')) return 'Zoom'
  if (type.includes('outbound_call') || type.includes('inbound_call') || type === 'physical') {
    if (type === 'physical') return 'Vor Ort'
    return 'Outbound Call'
  }
  // Fallback: check location string
  if (loc.location) {
    const locStr = loc.location.toLowerCase()
    if (locStr.includes('zoom') || locStr.includes('meet') || locStr.includes('teams')) return 'Zoom'
    if (locStr.includes('tel') || locStr.includes('phone') || locStr.includes('call')) return 'Outbound Call'
  }
  return loc.type || ''
}

function getWeekBounds(now: Date): { start: Date; end: Date } {
  const d = new Date(now)
  const day = d.getUTCDay() || 7 // Monday = 1 ... Sunday = 7
  const monday = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - (day - 1)))
  const sunday = new Date(monday.getTime() + 7 * 86400000)
  return { start: monday, end: sunday }
}

function getMonthBounds(now: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1))
  return { start, end }
}

async function calendlyFetch(endpoint: string): Promise<any> {
  const apiKey = process.env.CALENDLY_API_KEY
  if (!apiKey) throw new Error('CALENDLY_API_KEY not set')

  const url = endpoint.startsWith('http') ? endpoint : `${CALENDLY_API_BASE}${endpoint}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Calendly API error ${res.status}: ${text}`)
  }
  return res.json()
}

async function fetchEvents(minTime: string, maxTime: string): Promise<any[]> {
  const events: any[] = []
  let pageToken: string | null = null

  do {
    const params = new URLSearchParams({
      user: CALENDLY_USER_URI,
      min_start_time: minTime,
      max_start_time: maxTime,
      count: '100',
      status: 'active',
    })
    if (pageToken) params.set('page_token', pageToken)

    const data = await calendlyFetch(`/scheduled_events?${params.toString()}`)
    events.push(...(data.collection || []))
    pageToken = data.pagination?.next_page_token || null
  } while (pageToken)

  return events
}

function mapEvent(raw: any): CalendlyEvent {
  return {
    name: raw.name || '',
    startTime: raw.start_time || '',
    endTime: raw.end_time || '',
    category: categorizeEvent(raw.event_type || ''),
    location: extractLocation(raw),
  }
}

function countByCategory(events: CalendlyEvent[]) {
  let settings = 0, closings = 0, onboardings = 0, other = 0
  for (const e of events) {
    if (e.category === 'setting') settings++
    else if (e.category === 'closing') closings++
    else if (e.category === 'onboarding') onboardings++
    else other++
  }
  return { settings, closings, onboardings, other }
}

export async function fetchCalendlyData(): Promise<CalendlyMetrics> {
  const empty: CalendlyMetrics = {
    weekEvents: [],
    monthEvents: [],
    weekSettings: 0,
    weekClosings: 0,
    weekOnboardings: 0,
    weekOther: 0,
    monthSettings: 0,
    monthClosings: 0,
    monthOnboardings: 0,
    monthOther: 0,
  }

  if (!process.env.CALENDLY_API_KEY) {
    return empty
  }

  try {
    const now = new Date()
    const week = getWeekBounds(now)
    const month = getMonthBounds(now)

    // Fetch week and month events in parallel
    const [weekRaw, monthRaw] = await Promise.all([
      fetchEvents(week.start.toISOString(), week.end.toISOString()),
      fetchEvents(month.start.toISOString(), month.end.toISOString()),
    ])

    const weekEvents = weekRaw.map(mapEvent).sort((a, b) => a.startTime.localeCompare(b.startTime))
    const monthEvents = monthRaw.map(mapEvent).sort((a, b) => a.startTime.localeCompare(b.startTime))

    const weekCounts = countByCategory(weekEvents)
    const monthCounts = countByCategory(monthEvents)

    return {
      weekEvents,
      monthEvents,
      weekSettings: weekCounts.settings,
      weekClosings: weekCounts.closings,
      weekOnboardings: weekCounts.onboardings,
      weekOther: weekCounts.other,
      monthSettings: monthCounts.settings,
      monthClosings: monthCounts.closings,
      monthOnboardings: monthCounts.onboardings,
      monthOther: monthCounts.other,
    }
  } catch (err) {
    console.error('Calendly API error:', err)
    return empty
  }
}
