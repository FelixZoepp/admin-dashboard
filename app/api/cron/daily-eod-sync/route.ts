import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Call the sync endpoint internally
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    const syncRes = await fetch(`${baseUrl}/api/monday-eod-sync`, {
      headers: { 'Cache-Control': 'no-store' },
    })
    const syncData = await syncRes.json()

    if (!syncRes.ok) {
      return NextResponse.json({ error: 'Sync failed', details: syncData }, { status: 500 })
    }

    return NextResponse.json({ ok: true, sync: syncData })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
