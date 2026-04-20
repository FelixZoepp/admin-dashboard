import { NextResponse } from 'next/server'
import { fetchCloseData } from '../../../data'

export const dynamic = 'force-dynamic'

function fmtEuro(n: number): string {
  return '€' + n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtNum(n: number): string {
  return n.toLocaleString('de-DE')
}

export async function GET(request: Request) {
  // Verify cron secret (optional security)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = await fetchCloseData()
    if ('error' in data && data.error) {
      return NextResponse.json({ error: data.error }, { status: 500 })
    }

    const d = data as any

    // Build Slack message
    const now = new Date()
    const weekNum = d.currentWeek
    const date = d.currentDate

    // Period: this week
    const weekStart = d.weekStartISO
    const wonThisWeek = (d.allWonDeals || []).filter((deal: any) => deal.date >= weekStart)
    const lostThisWeek = (d.allLostDeals || []).filter((deal: any) => deal.date >= weekStart)
    const weekRevenue = wonThisWeek.reduce((s: number, deal: any) => s + deal.value, 0)
    const weekLostValue = lostThisWeek.reduce((s: number, deal: any) => s + deal.value, 0)

    // Airtable metrics
    const at = d.airtableMetrics
    const mrr = at?.mrr || 0
    const arr = at?.arr || 0
    const churnRate = at?.churnRate || 0
    const activeCustomers = at?.activeCustomers || 0

    // Build message blocks
    let msg = `*📊 Weekly Sales Report — KW ${weekNum}*\n`
    msg += `_${date} | Content Leads GmbH_\n\n`

    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`

    // KPIs
    msg += `*🏆 Woche KW ${weekNum}*\n`
    msg += `> Won Deals: *${wonThisWeek.length}* (${fmtEuro(weekRevenue)})\n`
    msg += `> Lost Deals: ${lostThisWeek.length} (${fmtEuro(weekLostValue)})\n`
    msg += `> Anwahlen: *${fmtNum(d.callsThisWeek)}*\n`
    msg += `> Pipeline: *${d.pipelineCount} Deals* (${fmtEuro(d.pipelineValue)})\n\n`

    // Won deals detail
    if (wonThisWeek.length > 0) {
      msg += `*✅ Won Deals diese Woche:*\n`
      for (const deal of wonThisWeek) {
        const dateParts = deal.date.split('-')
        const fmtDate = `${dateParts[2]}.${dateParts[1]}`
        msg += `> • ${deal.name} — *${fmtEuro(deal.value)}* (${fmtDate})\n`
      }
      msg += `\n`
    }

    // Pipeline highlights
    const hotDeals = (d.pipelineDealsWithValue || []).slice(0, 5)
    if (hotDeals.length > 0) {
      msg += `*🔥 Hot Pipeline (Top 5):*\n`
      for (const deal of hotDeals) {
        msg += `> • ${deal.leadName} — ${fmtEuro(deal.value)} _(${deal.status})_\n`
      }
      msg += `\n`
    }

    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`

    // Monthly
    msg += `*📅 ${d.currentMonthName} ${d.currentYear} (MTD)*\n`
    msg += `> Umsatz: *${fmtEuro(d.revenueMTD)}*\n`
    msg += `> Forecast (linear): ${fmtEuro(d.linearForecast)}\n`
    msg += `> Forecast + Pipeline: ${fmtEuro(d.pipelineWeightedForecast)}\n\n`

    // Conversion
    msg += `*🔄 Conversion Funnel*\n`
    msg += `> Alle Opps → Setting: ${d.conversionFunnel.settingToClosingRate}%\n`
    msg += `> Setting → Won: ${d.conversionFunnel.closingToWonRate}%\n`
    msg += `> Overall: *${d.conversionFunnel.overallConversionRate}%*\n`
    msg += `> Ø Deal Cycle: ${d.waterfall.avgDealCycle} Tage\n\n`

    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`

    // Customer health
    msg += `*💰 Kunden-Gesundheit*\n`
    msg += `> MRR: *${fmtEuro(mrr)}* | ARR: *${fmtEuro(arr)}*\n`
    msg += `> Aktive Kunden: *${activeCustomers}*\n`
    msg += `> Churn Rate: *${churnRate.toFixed(1)}%*\n`
    msg += `> Closing Rate: *${d.closingRate}%* (${d.wonTotal} Won / ${d.wonTotal + d.lostCount} Closed)\n\n`

    // Overall
    msg += `*📈 Gesamt*\n`
    msg += `> Total Revenue: *${fmtEuro(d.totalRevenue)}*\n`
    msg += `> Avg Deal Size: ${fmtEuro(d.avgDealSize)}\n`
    msg += `> Leads: ${fmtNum(d.totalLeads)} (${fmtNum(d.leadpoolCount)} im Leadpool)\n\n`

    msg += `_🔗 <https://admin-dashboard-taupe-seven-55.vercel.app|Dashboard öffnen>_`

    // Send to Slack
    const slackToken = process.env.SLACK_BOT_TOKEN
    const channelId = 'C09FV66E48Y' // #03-sales

    if (slackToken) {
      const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${slackToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: channelId,
          text: msg,
          unfurl_links: false,
        }),
      })
      const slackData = await slackRes.json()
      if (!slackData.ok) {
        return NextResponse.json({ error: 'Slack send failed', details: slackData.error, message: msg }, { status: 500 })
      }
      return NextResponse.json({ ok: true, channel: channelId, slackResponse: slackData })
    }

    // If no Slack token, return the message for testing
    return NextResponse.json({ ok: true, message: msg, note: 'No SLACK_BOT_TOKEN set - message not sent to Slack' })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
