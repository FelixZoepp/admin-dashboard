import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const MONDAY_API_URL = 'https://api.monday.com/v2'
const BOARD_ID = 1826386368

// Monday column ID → Supabase column mapping
const COLUMN_MAP: Record<string, string> = {
  text_mkn8sc7h: 'vertriebler_name',
  datum: 'report_date',
  zahlen_mkn7fzgp: 'accountable',
  zahlen_mkn7k2cs: 'performance_satisfaction',
  zahlen_mkn7932e: 'on_track_weekly',
  zahlen_mkn7w9a9: 'on_track_monthly',
  zahlen_mkn7y3zg: 'tips_applied',
  langer_text_mkn7k904: 'gesamt_review',
  langer_text_mkn7y2rj: 'review_call_art',
  status: 'status',
}

interface MondayItem {
  id: string
  name: string
  column_values: { id: string; text: string }[]
}

async function fetchMondayItems(token: string): Promise<MondayItem[]> {
  const allItems: MondayItem[] = []
  let cursor: string | null = null

  // First page
  const firstQuery = `query {
    boards(ids: [${BOARD_ID}]) {
      items_page(limit: 100) {
        cursor
        items {
          id
          name
          column_values {
            id
            text
          }
        }
      }
    }
  }`

  const firstRes = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token,
      'API-Version': '2024-10',
    },
    body: JSON.stringify({ query: firstQuery }),
  })

  const firstData = await firstRes.json()
  const firstPage = firstData?.data?.boards?.[0]?.items_page
  if (!firstPage) {
    throw new Error(`Monday API error: ${JSON.stringify(firstData?.errors || firstData)}`)
  }

  allItems.push(...firstPage.items)
  cursor = firstPage.cursor

  // Paginate
  while (cursor) {
    const nextQuery = `query {
      next_items_page(limit: 100, cursor: "${cursor}") {
        cursor
        items {
          id
          name
          column_values {
            id
            text
          }
        }
      }
    }`

    const nextRes = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
        'API-Version': '2024-10',
      },
      body: JSON.stringify({ query: nextQuery }),
    })

    const nextData = await nextRes.json()
    const nextPage = nextData?.data?.next_items_page
    if (!nextPage) break

    allItems.push(...nextPage.items)
    cursor = nextPage.cursor
  }

  return allItems
}

function mapItemToRow(item: MondayItem) {
  const row: Record<string, unknown> = {
    monday_item_id: item.id,
    synced_at: new Date().toISOString(),
  }

  for (const col of item.column_values) {
    const dbCol = COLUMN_MAP[col.id]
    if (!dbCol) continue

    const text = col.text?.trim() || null

    if (['accountable', 'performance_satisfaction', 'on_track_weekly', 'on_track_monthly', 'tips_applied'].includes(dbCol)) {
      row[dbCol] = text ? parseInt(text, 10) : null
    } else {
      row[dbCol] = text
    }
  }

  return row
}

export async function GET() {
  const token = process.env.MONDAY_API_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'MONDAY_API_TOKEN not set' }, { status: 500 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase credentials not set' }, { status: 500 })
  }

  try {
    const items = await fetchMondayItems(token)

    // Filter out items without a vertriebler name or date
    const rows = items
      .map(mapItemToRow)
      .filter((r) => r.vertriebler_name && r.report_date)

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, synced: 0, note: 'No valid items found' })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Upsert in batches of 50
    let synced = 0
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50)
      const { error } = await supabase
        .from('eod_reports_vertrieb')
        .upsert(batch, { onConflict: 'monday_item_id' })

      if (error) {
        return NextResponse.json({ error: `Supabase upsert failed: ${error.message}`, synced }, { status: 500 })
      }
      synced += batch.length
    }

    return NextResponse.json({ ok: true, synced, total: items.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
