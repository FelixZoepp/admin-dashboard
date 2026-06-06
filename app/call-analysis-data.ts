import { createClient } from '@supabase/supabase-js'

export interface CallAnalysisEntry {
  date: string
  opener_name: string
  opener_user_id: string
  total_calls: number
  calls_with_transcript: number
  total_call_minutes: number
  skript_treue_score: number
  tonalitaet_score: number
  einwandbehandlung_score: number
  gespraechsfuehrung_score: number
  overall_score: number
  analysis_text: string
  strengths: string
  weaknesses: string
  patterns: string
  recommendations: string
  call_summaries: { call_nr: number; note: string }[]
}

export interface CallAnalysisMetrics {
  available: boolean
  latest: CallAnalysisEntry[]
  history: CallAnalysisEntry[]
  avgScores: Record<string, {
    skriptTreue: number
    tonalitaet: number
    einwandbehandlung: number
    gespraechsfuehrung: number
    overall: number
    totalCalls: number
    totalDays: number
  }>
}

const EMPTY: CallAnalysisMetrics = {
  available: false,
  latest: [],
  history: [],
  avgScores: {},
}

export async function fetchCallAnalysisData(): Promise<CallAnalysisMetrics> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!SUPABASE_URL || !SUPABASE_KEY) return EMPTY

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  try {
    // Get last 30 days of analyses
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

    const { data: rows, error } = await supabase
      .from('call_analyses')
      .select('*')
      .gte('date', thirtyDaysAgo)
      .order('date', { ascending: false })
      .limit(100)

    if (error || !rows || rows.length === 0) return EMPTY

    const entries: CallAnalysisEntry[] = rows.map((r: any) => ({
      date: r.date,
      opener_name: r.opener_name,
      opener_user_id: r.opener_user_id,
      total_calls: r.total_calls || 0,
      calls_with_transcript: r.calls_with_transcript || 0,
      total_call_minutes: r.total_call_minutes || 0,
      skript_treue_score: r.skript_treue_score || 0,
      tonalitaet_score: r.tonalitaet_score || 0,
      einwandbehandlung_score: r.einwandbehandlung_score || 0,
      gespraechsfuehrung_score: r.gespraechsfuehrung_score || 0,
      overall_score: r.overall_score || 0,
      analysis_text: r.analysis_text || '',
      strengths: r.strengths || '',
      weaknesses: r.weaknesses || '',
      patterns: r.patterns || '',
      recommendations: r.recommendations || '',
      call_summaries: r.call_summaries || [],
    }))

    // Latest = most recent date per opener
    const latestDate = entries[0]?.date
    const latest = entries.filter(e => e.date === latestDate)

    // Avg scores per opener (last 30 days)
    const avgScores: CallAnalysisMetrics['avgScores'] = {}
    const byOpener: Record<string, CallAnalysisEntry[]> = {}
    for (const e of entries) {
      if (!byOpener[e.opener_name]) byOpener[e.opener_name] = []
      byOpener[e.opener_name].push(e)
    }

    for (const [name, opEntries] of Object.entries(byOpener)) {
      const scored = opEntries.filter(e => e.overall_score > 0)
      if (scored.length === 0) {
        avgScores[name] = { skriptTreue: 0, tonalitaet: 0, einwandbehandlung: 0, gespraechsfuehrung: 0, overall: 0, totalCalls: 0, totalDays: 0 }
        continue
      }
      const avg = (key: keyof CallAnalysisEntry) =>
        Math.round((scored.reduce((s, e) => s + (e[key] as number), 0) / scored.length) * 10) / 10

      avgScores[name] = {
        skriptTreue: avg('skript_treue_score'),
        tonalitaet: avg('tonalitaet_score'),
        einwandbehandlung: avg('einwandbehandlung_score'),
        gespraechsfuehrung: avg('gespraechsfuehrung_score'),
        overall: avg('overall_score'),
        totalCalls: opEntries.reduce((s, e) => s + e.total_calls, 0),
        totalDays: scored.length,
      }
    }

    return {
      available: true,
      latest,
      history: entries,
      avgScores,
    }
  } catch (err) {
    console.error('Call analysis data error:', err)
    return EMPTY
  }
}
