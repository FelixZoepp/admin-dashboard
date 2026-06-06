import { NextResponse } from 'next/server'
import { fetchOpenerTracking } from '../../../opener-tracking-data'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tracking = await fetchOpenerTracking()

    if (tracking.openers.length === 0) {
      return NextResponse.json({ ok: true, note: 'No openers configured' })
    }

    const now = new Date()
    const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`

    let msg = `*Opener Aufstiegs-Report — ${dateStr}*\n\n`

    for (const opener of tracking.openers) {
      const firstName = opener.name.split(' ')[0]
      const todayEntry = opener.dailyLog.find(
        (e) => e.date === now.toISOString().split('T')[0]
      )
      const todayCount = todayEntry?.count ?? 0

      // Status emoji
      let statusEmoji: string
      let statusText: string
      if (opener.completed) {
        statusEmoji = 'trophy'
        statusText = 'ZIEL ERREICHT!'
      } else if (opener.onTrack) {
        statusEmoji = 'white_check_mark'
        statusText = 'On Track'
      } else {
        statusEmoji = 'warning'
        statusText = 'Behind Schedule'
      }

      // Progress bar (20 chars)
      const filled = Math.round(opener.progressPercent / 5)
      const empty = 20 - filled
      const progressBar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty)

      const deadlineParts = opener.deadlineDate.split('-')
      const deadlineFmt = `${deadlineParts[2]}.${deadlineParts[1]}.${deadlineParts[0]}`

      msg += `*${firstName}* :${statusEmoji}: ${statusText}\n`
      msg += `> ${progressBar} *${opener.progressPercent}%*\n`
      msg += `> Heute: *${todayCount} Termine* | Gesamt: *${opener.totalTermine}/${opener.targetTermine}*\n`
      msg += `> Noch *${opener.termineRemaining} Termine* in *${opener.daysRemaining} Tagen* (bis ${deadlineFmt})\n`
      if (!opener.completed) {
        msg += `> Tempo: *${opener.requiredPerDay} Termine/Arbeitstag* n\u00f6tig\n`
      }
      msg += `\n`
    }

    // Dashboard link removed — report is internal only

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

    return NextResponse.json({ ok: true, message: msg, note: 'No SLACK_BOT_TOKEN set - message not sent to Slack' })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
