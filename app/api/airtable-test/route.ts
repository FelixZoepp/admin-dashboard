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
    // Get table schema
    const schemaRes = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, { headers })
    const schema = await schemaRes.json()

    // Get table names
    const tables = (schema.tables || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      fields: (t.fields || []).map((f: any) => ({ name: f.name, type: f.type })),
    }))

    // Find Kundenbasis table
    const kundenTable = tables.find((t: any) => t.name.toLowerCase().includes('kundenbasis'))

    let kundenRecords: any[] = []
    if (kundenTable) {
      // Fetch all records (paginated)
      let offset: string | undefined
      do {
        const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(kundenTable.name)}${offset ? `?offset=${offset}` : ''}`
        const res = await fetch(url, { headers })
        const data = await res.json()
        kundenRecords.push(...(data.records || []))
        offset = data.offset
      } while (offset)
    }

    // Find After Close table
    const afterCloseTable = tables.find((t: any) => t.name.toLowerCase().includes('after close'))
    let afterCloseRecords: any[] = []
    if (afterCloseTable) {
      let offset: string | undefined
      do {
        const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(afterCloseTable.name)}${offset ? `?offset=${offset}` : ''}`
        const res = await fetch(url, { headers })
        const data = await res.json()
        afterCloseRecords.push(...(data.records || []))
        offset = data.offset
      } while (offset)
    }

    return NextResponse.json({
      tables: tables.map((t: any) => ({ name: t.name, fieldCount: t.fields.length, fields: t.fields })),
      kundenbasis: {
        tableName: kundenTable?.name,
        recordCount: kundenRecords.length,
        records: kundenRecords.map((r: any) => ({ id: r.id, fields: r.fields })),
      },
      afterClose: {
        tableName: afterCloseTable?.name,
        recordCount: afterCloseRecords.length,
        records: afterCloseRecords.slice(0, 10).map((r: any) => ({ id: r.id, fields: r.fields })),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
