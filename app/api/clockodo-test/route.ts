import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const email = process.env.CLOCKODO_EMAIL
  const apiKey = process.env.CLOCKODO_API_KEY
  if (!email || !apiKey) {
    return NextResponse.json({ error: 'CLOCKODO credentials not set' })
  }

  const headers = {
    'X-ClockodoApiUser': email,
    'X-ClockodoApiKey': apiKey,
    'X-Clockodo-External-Application': 'ContentLeadsDashboard;felix@zoeppmedia.de',
  }

  try {
    // Get users
    const usersRes = await fetch('https://my.clockodo.com/api/v2/users', { headers })
    const users = await usersRes.json()

    // Get last 180 days of time entries
    const now = new Date()
    const monthAgo = new Date(now.getTime() - 180 * 86400000)
    const timeSince = monthAgo.toISOString().split('T')[0] + ' 00:00:00'
    const timeUntil = now.toISOString().split('T')[0] + ' 23:59:59'

    const entriesRes = await fetch(
      `https://my.clockodo.com/api/v2/entries?time_since=${encodeURIComponent(timeSince)}&time_until=${encodeURIComponent(timeUntil)}`,
      { headers }
    )
    const entries = await entriesRes.json()

    // Aggregate by user
    const byUser: Record<number, { name: string; totalHours: number; days: Set<string>; entries: number }> = {}
    for (const u of (users.users || [])) {
      byUser[u.id] = { name: u.name, totalHours: 0, days: new Set(), entries: 0 }
    }
    for (const e of (entries.entries || [])) {
      const uid = e.users_id
      if (byUser[uid]) {
        const hours = (e.duration || 0) / 3600
        byUser[uid].totalHours += hours
        byUser[uid].entries++
        if (e.time_since) byUser[uid].days.add(e.time_since.split(' ')[0])
      }
    }

    const summary = Object.entries(byUser).map(([id, data]) => ({
      id: Number(id),
      name: data.name,
      totalHours: Math.round(data.totalHours * 10) / 10,
      daysWorked: data.days.size,
      entries: data.entries,
      avgHoursPerDay: data.days.size > 0 ? Math.round((data.totalHours / data.days.size) * 10) / 10 : 0,
    }))

    // Nils details
    const nilsEntries = (entries.entries || [])
      .filter((e: any) => e.users_id === 283318)
      .map((e: any) => ({
        date: e.time_since?.split(' ')[0],
        hours: Math.round((e.duration || 0) / 360) / 10,
        text: e.text || '',
        project: e.projects_id,
      }))

    return NextResponse.json({
      users: users.users?.map((u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
      period: { from: timeSince, to: timeUntil },
      totalEntries: entries.entries?.length || 0,
      summary,
      nilsEntries: nilsEntries.slice(0, 30),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
