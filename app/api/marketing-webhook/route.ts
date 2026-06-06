import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const WEBHOOK_SECRET = (process.env.MARKETING_WEBHOOK_SECRET || '').trim()

  // Auth check
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()

  if (!WEBHOOK_SECRET || token !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  try {
    const body = await req.json()

    // Accept single event or array of events
    const events = Array.isArray(body) ? body : [body]

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    const rows = events.map((event: any) => ({
      source: event.source,
      metrics: event.metrics || {},
      period: event.period || 'snapshot',
      recorded_at: event.recorded_at || new Date().toISOString(),
    }))

    // Validate
    for (const row of rows) {
      if (!row.source) {
        return NextResponse.json({ error: 'Missing "source" field' }, { status: 400 })
      }
    }

    const { error } = await supabase.from('marketing_snapshots').insert(rows)

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, inserted: rows.length })
  } catch (err: any) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: err.message || 'Invalid request' }, { status: 400 })
  }
}

// GET endpoint to check what data exists
export async function GET(req: NextRequest) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const WEBHOOK_SECRET = (process.env.MARKETING_WEBHOOK_SECRET || '').trim()

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()

  if (!WEBHOOK_SECRET || token !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // Return latest snapshot per source
  const { data, error } = await supabase
    .from('marketing_snapshots')
    .select('source, metrics, period, recorded_at')
    .order('recorded_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ snapshots: data })
}
