import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const key = process.env.AIRTABLE_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'AIRTABLE_API_KEY not set', envKeys: Object.keys(process.env).filter(k => k.includes('AIRTABLE')) })
  }

  try {
    // List bases
    const basesRes = await fetch('https://api.airtable.com/v0/meta/bases', {
      headers: { Authorization: `Bearer ${key}` },
    })
    const bases = await basesRes.json()

    return NextResponse.json({ bases })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}
