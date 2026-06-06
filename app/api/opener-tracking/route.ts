import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchOpenerTracking } from '../../opener-tracking-data'

export const dynamic = 'force-dynamic'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

// GET: Fetch current tracking data
export async function GET() {
  try {
    const data = await fetchOpenerTracking()
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST: Log termine for an opener on a given date
// Body: { opener_name: string, date: string (YYYY-MM-DD), termine_count: number }
export async function POST(request: Request) {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const body = await request.json()
    const { opener_name, date, termine_count, fruehbonus } = body

    if (!opener_name || !date || termine_count === undefined) {
      return NextResponse.json({ error: 'Missing required fields: opener_name, date, termine_count' }, { status: 400 })
    }

    // Upsert: update if exists, insert if not
    const { data, error } = await supabase
      .from('opener_aufstieg')
      .upsert(
        { opener_name, date, termine_count, fruehbonus: !!fruehbonus },
        { onConflict: 'opener_name,date' }
      )
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
