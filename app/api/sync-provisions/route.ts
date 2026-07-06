import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const INTERNES_DASHBOARD_URL = 'https://internes-salesdashboard-felix-1214s-projects.vercel.app'

// Name-Mapping: internes Dashboard -> Admin Dashboard (Supabase opener_name)
const NAME_MAP: Record<string, string> = {
  'Johannes': 'Johannes Bohn',
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

interface ProvisionDetail {
  date: string
  appointments: number
  bonus: number
  incentives: string[]
}

interface ProvisionEntry {
  email: string
  name: string
  monthDetails: ProvisionDetail[]
}

interface ProvisionsResponse {
  provisions: ProvisionEntry[]
  totals: { todayBonus: number; weekBonus: number; monthBonus: number }
}

// POST /api/sync-provisions
// Fetches provisions from internes-salesdashboard and upserts into Supabase
export async function POST() {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    // Fetch provisions from internes-salesdashboard
    const res = await fetch(`${INTERNES_DASHBOARD_URL}/api/provisions`, {
      headers: { 'Accept': 'application/json' },
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Internes Dashboard API error: ${res.status} - ${text}` }, { status: 502 })
    }

    const data: ProvisionsResponse = await res.json()

    let synced = 0
    let skipped = 0
    const details: string[] = []

    for (const provision of data.provisions) {
      const openerName = NAME_MAP[provision.name]
      if (!openerName) {
        skipped++
        details.push(`Skipped ${provision.name} (not in NAME_MAP)`)
        continue
      }

      for (const day of provision.monthDetails) {
        const hasFruehbonus = day.incentives.includes('early_bird_setting')

        const { error } = await supabase
          .from('opener_aufstieg')
          .upsert({
            opener_name: openerName,
            date: day.date,
            termine_count: day.appointments,
            fruehbonus: hasFruehbonus,
          }, { onConflict: 'opener_name,date' })

        if (error) {
          details.push(`Error ${openerName} ${day.date}: ${error.message}`)
        } else {
          synced++
        }
      }

      const totalBonus = provision.monthDetails.reduce((s, d) => s + d.bonus, 0)
      const totalSettings = provision.monthDetails.reduce((s, d) => s + d.appointments, 0)
      details.push(`${openerName}: ${provision.monthDetails.length} Tage synced, ${totalSettings} Settings, ${totalBonus}€ Bonus`)
    }

    return NextResponse.json({
      ok: true,
      synced,
      skipped,
      details,
      source: INTERNES_DASHBOARD_URL,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// GET: Info about the sync endpoint
export async function GET() {
  return NextResponse.json({
    description: 'Sync provisions from internes-salesdashboard into admin dashboard (Supabase)',
    usage: 'POST /api/sync-provisions',
    source: INTERNES_DASHBOARD_URL,
    nameMapping: NAME_MAP,
  })
}
