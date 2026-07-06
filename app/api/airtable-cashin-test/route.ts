import { NextResponse } from 'next/server'
import { fetchAirtableCashIn } from '../../airtable-cashin-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const hasKey = !!process.env.AIRTABLE_API_KEY
    const keyPrefix = process.env.AIRTABLE_API_KEY?.slice(0, 10) || 'not set'

    // Quick raw test
    let rawTest: any = null
    if (hasKey) {
      const res = await fetch(
        `https://api.airtable.com/v0/appTpGFd5R3nh8olz/tblzehvHOPBS9iUhq?maxRecords=2&filterByFormula=${encodeURIComponent("{Status} = 'Aktiv'")}`,
        { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` } }
      )
      rawTest = await res.json()
    }

    const data = await fetchAirtableCashIn()

    return NextResponse.json({
      hasKey,
      keyPrefix,
      rawRecordCount: rawTest?.records?.length ?? 'no key',
      rawError: rawTest?.error || null,
      rawSampleFields: rawTest?.records?.[0] ? Object.keys(rawTest.records[0].fields || {}) : [],
      rawSampleRecord: rawTest?.records?.[0]?.fields || null,
      monthsCount: data.months.length,
      months: data.months.map(m => ({ label: m.label, totalNetto: m.totalNetto, customerCount: m.customers.length })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
