import { NextRequest, NextResponse } from 'next/server'

const CLOSE_API_BASE = 'https://api.close.com/api/v1'

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

const CUSTOM_ACTIVITY_TYPES = {
  coldCall: 'actitype_1opHQI1ygoGZjsIG0z7SkR',
  setting: 'actitype_4VVTPxLTlLNPNsMsc7tgxC',
  closing: 'actitype_7QI2uISXKjTGXHK0AYmckm',
  followUp: 'actitype_3EqH37y6lgLrS9vufk3MU4',
}

const COLD_CALL_NIEMAND_ERREICHT = 'custom.cf_U3JJwHBkSgOGtEKO4wd7b5EeLbUyv0uBXAQuG3GgEu6'
const COLD_CALL_ENTSCHEIDER = 'custom.cf_0qd3PlDb9re1MU97cxNV7MJUXjHVYGmuifQc5CsTrN1'
const FOLLOW_UP_NAECHSTER_SCHRITT = 'custom.cf_JKIoBAGq8wjSE0mo8C6lyWjMZHRw8WlwNJrqb0LpWeN'
const SETTING_NAECHSTER_SCHRITT = 'custom.cf_xPhL5XUDQ8i4gCcUF4pz5uMaHUoIMwZXB3af8Xv0A6B'

const OPENER_NAMES = ['Taha Keremoglu', 'Johannes Bohn']
const SETTER_NAMES = ['Felix Zoepp']
const CLOSER_NAMES = ['Felix Zoepp']

export async function GET(req: NextRequest) {
  try {
    if (!process.env.CLOSE_API_KEY) {
      return NextResponse.json({ error: 'CLOSE_API_KEY not configured' }, { status: 500 })
    }

    const url = new URL(req.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    if (!from) {
      return NextResponse.json({ error: 'Missing "from" parameter' }, { status: 400 })
    }

    // Default "to" to tomorrow to include today
    const toDate = to || new Date(Date.now() + 86400000).toISOString().split('T')[0]

    // Fetch calls for the period
    const calls: any[] = []
    let hasMore = true
    let skip = 0
    while (hasMore) {
      const data = await closeApiFetch(
        `/activity/call/?date_created__gte=${from}&date_created__lt=${toDate}&_skip=${skip}&_limit=100&_order_by=-date_created&_fields=id,date_created,user_name`
      )
      calls.push(...data.data)
      hasMore = data.has_more
      skip += 100
    }

    // Fetch custom activities for the period
    const activities: any[] = []
    hasMore = true
    skip = 0
    while (hasMore) {
      const data = await closeApiFetch(
        `/activity/custom/?date_created__gte=${from}&date_created__lt=${toDate}&_skip=${skip}&_limit=100&_order_by=-date_created&_fields=id,custom_activity_type_id,date_created,user_name,${COLD_CALL_NIEMAND_ERREICHT},${COLD_CALL_ENTSCHEIDER},${FOLLOW_UP_NAECHSTER_SCHRITT},${SETTING_NAECHSTER_SCHRITT}`
      )
      activities.push(...data.data)
      hasMore = data.has_more
      skip += 100
    }

    // Build per-user performance
    interface MemberData {
      name: string
      role: string
      calls: number
      coldCallProtocols: number
      followUpProtocols: number
      entscheiderErreicht: number
      settingsGelegt: number
      closingsGelegt: number
    }

    const memberMap: Record<string, MemberData> = {}

    function ensure(name: string) {
      if (!memberMap[name]) {
        const isOpener = OPENER_NAMES.includes(name)
        const isSetter = SETTER_NAMES.includes(name)
        const isCloser = CLOSER_NAMES.includes(name)
        let role = 'all'
        if (isOpener && !isSetter && !isCloser) role = 'opener'
        else if (isSetter && isCloser) role = 'setter+closer'
        else if (isSetter) role = 'setter'
        else if (isCloser) role = 'closer'
        memberMap[name] = { name, role, calls: 0, coldCallProtocols: 0, followUpProtocols: 0, entscheiderErreicht: 0, settingsGelegt: 0, closingsGelegt: 0 }
      }
    }

    // Calls
    for (const c of calls) {
      const name = c.user_name || 'Unbekannt'
      ensure(name)
      memberMap[name].calls++
    }

    // Custom activities
    for (const a of activities) {
      const name = a.user_name || 'Unbekannt'
      ensure(name)

      if (a.custom_activity_type_id === CUSTOM_ACTIVITY_TYPES.coldCall) {
        memberMap[name].coldCallProtocols++
        if (a[COLD_CALL_ENTSCHEIDER] && a[COLD_CALL_NIEMAND_ERREICHT] !== 'Ja') {
          memberMap[name].entscheiderErreicht++
        }
        if (a[COLD_CALL_ENTSCHEIDER] === 'Setting vereinbart am:') {
          memberMap[name].settingsGelegt++
        }
      }

      if (a.custom_activity_type_id === CUSTOM_ACTIVITY_TYPES.followUp) {
        memberMap[name].followUpProtocols++
        if (a[FOLLOW_UP_NAECHSTER_SCHRITT] && a[FOLLOW_UP_NAECHSTER_SCHRITT] !== '5. Nicht erreicht') {
          memberMap[name].entscheiderErreicht++
        }
        if (a[FOLLOW_UP_NAECHSTER_SCHRITT] === '2. Setting gelegt am:') {
          memberMap[name].settingsGelegt++
        }
        if (a[FOLLOW_UP_NAECHSTER_SCHRITT] === '3. Closing gelegt am:') {
          memberMap[name].closingsGelegt++
        }
      }

      if (a.custom_activity_type_id === CUSTOM_ACTIVITY_TYPES.setting) {
        if (a[SETTING_NAECHSTER_SCHRITT] === '2. Closing gelegt auf:') {
          memberMap[name].closingsGelegt++
        }
      }
    }

    const team = Object.values(memberMap)
      .map(m => ({
        ...m,
        callsPerEntscheider: m.entscheiderErreicht > 0 ? Math.round((m.calls / m.entscheiderErreicht) * 10) / 10 : 0,
        callsPerSetting: m.settingsGelegt > 0 ? Math.round((m.calls / m.settingsGelegt) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.settingsGelegt - a.settingsGelegt || b.calls - a.calls)

    // Funnel ratios for the period
    const totalCalls = calls.length
    const totalEntscheider = team.reduce((s, m) => s + m.entscheiderErreicht, 0)
    const totalSettings = team.reduce((s, m) => s + m.settingsGelegt, 0)
    const totalClosings = team.reduce((s, m) => s + m.closingsGelegt, 0)

    const funnelRatios = {
      anwahlenProEntscheider: totalEntscheider > 0 ? Math.round((totalCalls / totalEntscheider) * 10) / 10 : 0,
      anwahlenProSetting: totalSettings > 0 ? Math.round((totalCalls / totalSettings) * 10) / 10 : 0,
      entscheiderProSetting: totalSettings > 0 ? Math.round((totalEntscheider / totalSettings) * 10) / 10 : 0,
      settingsProClosing: totalClosings > 0 ? Math.round((totalSettings / totalClosings) * 10) / 10 : 0,
      closingsProWon: 0, // Would need won deals data for exact period
      anwahlenProWon: 0,
    }

    return NextResponse.json({ team, funnelRatios, from, to: toDate }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error: any) {
    console.error('Team performance API error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch team performance' }, { status: 500 })
  }
}
