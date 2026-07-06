import { NextResponse } from 'next/server'

const BASE = 'https://api.heyreach.io/api/public'

async function hr(apiKey: string, path: string, body: any) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    body: JSON.stringify(body),
  })
  if (!res.ok) return { _error: res.status, _body: await res.text() }
  return res.json()
}

export async function GET() {
  const apiKey = process.env.HEYREACH_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'No HEYREACH_API_KEY' })

  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const accountIds = [215981, 215976, 215979, 215977]

  // Get per-account stats + campaign stats for the active campaign
  const [overall, campaigns, ...perAccount] = await Promise.all([
    hr(apiKey, '/stats/GetOverallStats', { accountIds: [], campaignIds: [], startDate, endDate }),
    hr(apiKey, '/campaign/GetAll', { offset: 0, limit: 20 }),
    ...accountIds.map(id => hr(apiKey, '/stats/GetOverallStats', { accountIds: [id], campaignIds: [], startDate, endDate })
      .then(data => ({ accountId: id, stats: data.overallStats || data }))),
  ])

  // Per-campaign stats for the active one
  const activeCampaign = (campaigns?.items || []).find((c: any) => c.status === 'IN_PROGRESS')
  let campaignStats = null
  if (activeCampaign) {
    campaignStats = await hr(apiKey, '/stats/GetOverallStats', {
      accountIds: [], campaignIds: [activeCampaign.id], startDate, endDate,
    })
  }

  return NextResponse.json({
    overall: overall.overallStats,
    campaigns: (campaigns?.items || []).map((c: any) => ({
      id: c.id, name: c.name, status: c.status,
      accounts: c.campaignAccountIds,
      progress: c.progressStats,
    })),
    perAccount,
    activeCampaignStats: campaignStats?.overallStats,
    byDayStats: overall.byDayStats,
  })
}
