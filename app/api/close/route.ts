import { NextResponse } from 'next/server'
import { fetchCloseData } from '../../data'

export async function GET() {
  const data = await fetchCloseData()

  if (data.error) {
    return NextResponse.json(
      { error: data.error },
      { status: 500 }
    )
  }

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
    },
  })
}
