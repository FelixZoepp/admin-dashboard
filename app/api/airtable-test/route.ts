import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BASE_ID = 'appTpGFd5R3nh8olz'

export async function GET() {
  const key = process.env.AIRTABLE_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'AIRTABLE_API_KEY not set' })
  }

  const headers = { Authorization: `Bearer ${key}` }

  try {
    // Try common table name variants directly
    const tableNames = ['Kundenbasis', 'kundenbasis', 'Kunden', 'After Close', 'After close']
    const results: Record<string, any> = {}

    for (const name of tableNames) {
      try {
        const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(name)}?maxRecords=3`
        const res = await fetch(url, { headers })
        const data = await res.json()
        if (data.records) {
          results[name] = {
            found: true,
            recordCount: data.records.length,
            sampleFields: data.records[0] ? Object.keys(data.records[0].fields) : [],
            sample: data.records[0]?.fields || {},
          }
        } else {
          results[name] = { found: false, error: data.error }
        }
      } catch (e: any) {
        results[name] = { found: false, error: e.message }
      }
    }

    // Now fetch full Kundenbasis data
    const foundTable = Object.entries(results).find(([, v]) => v.found)?.[0]
    let allRecords: any[] = []
    if (foundTable) {
      let offset: string | undefined
      do {
        const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(foundTable)}${offset ? `?offset=${offset}` : ''}`
        const res = await fetch(url, { headers })
        const data = await res.json()
        allRecords.push(...(data.records || []))
        offset = data.offset
      } while (offset)
    }

    return NextResponse.json({
      tableProbes: results,
      foundTable,
      totalRecords: allRecords.length,
      allFields: allRecords[0] ? Object.keys(allRecords[0].fields) : [],
      records: allRecords.map((r: any) => ({ id: r.id, fields: r.fields })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
