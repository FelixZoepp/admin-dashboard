import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params
  const WEBHOOK_SECRET = (process.env.PERSPECTIVE_WEBHOOK_SECRET || '').trim()

  if (!WEBHOOK_SECRET || secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  try {
    const body = await req.json()

    // Detect Perspective format: has funnelName, meta, profile
    const isPerspective = body.funnelName && body.meta && body.profile

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    if (isPerspective) {
      // Store as individual lead event
      const { error } = await supabase.from('marketing_snapshots').insert({
        source: 'perspective',
        metrics: {
          type: 'lead',
          funnel_name: body.funnelName,
          contact_id: body.id || null,
          email: body.profile?.email || null,
          name: body.profile?.name || body.profile?.firstName || null,
          phone: body.profile?.phone || null,
          completed: body.meta?.completed || false,
          converted: body.meta?.converted || false,
          completed_at: body.meta?.completedAt || null,
          converted_at: body.meta?.convertedAt || null,
          // Store all custom profile fields
          custom_fields: Object.fromEntries(
            Object.entries(body.profile || {})
              .filter(([k]) => !['email', 'name', 'firstName', 'lastName', 'phone', 'website'].includes(k))
              .map(([k, v]: [string, any]) => [k, v?.value || v])
          ),
        },
        period: 'event',
        recorded_at: body.meta?.convertedAt || body.meta?.completedAt || new Date().toISOString(),
      })

      if (error) {
        console.error('Perspective insert error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, type: 'perspective_lead' })
    }

    // Fallback: generic format
    if (!body.source) {
      return NextResponse.json({ error: 'Unknown format' }, { status: 400 })
    }

    const { error } = await supabase.from('marketing_snapshots').insert({
      source: body.source,
      metrics: body.metrics || {},
      period: body.period || 'snapshot',
      recorded_at: body.recorded_at || new Date().toISOString(),
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Perspective webhook error:', err)
    return NextResponse.json({ error: err.message || 'Invalid request' }, { status: 400 })
  }
}
