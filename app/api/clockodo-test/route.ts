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

    // Get this week's time entries
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() + 1) // Monday
    const timeSince = weekStart.toISOString().split('T')[0] + ' 00:00:00'
    const timeUntil = now.toISOString().split('T')[0] + ' 23:59:59'

    const entriesRes = await fetch(
      `https://my.clockodo.com/api/v2/entries?time_since=${encodeURIComponent(timeSince)}&time_until=${encodeURIComponent(timeUntil)}`,
      { headers }
    )
    const entries = await entriesRes.json()

    return NextResponse.json({
      users: users.users?.map((u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
      entriesCount: entries.entries?.length || 0,
      sampleEntries: (entries.entries || []).slice(0, 5).map((e: any) => ({
        userId: e.users_id,
        timeSince: e.time_since,
        timeUntil: e.time_until,
        duration: e.duration,
        text: e.text,
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
