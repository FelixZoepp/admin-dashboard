import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ── Close API ──────────────────────────────────────────────
const CLOSE_API_BASE = 'https://api.close.com/api/v1'

function getAuthHeader(): string {
  const apiKey = process.env.CLOSE_API_KEY
  if (!apiKey) return ''
  return 'Basic ' + Buffer.from(apiKey + ':').toString('base64')
}

async function closeApiFetch(endpoint: string, options?: RequestInit) {
  const url = endpoint.startsWith('http') ? endpoint : `${CLOSE_API_BASE}${endpoint}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
      ...options?.headers,
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Close API error ${res.status}: ${text}`)
  }
  return res.json()
}

// ── Constants ──────────────────────────────────────────────
const OPENER_IDS: Record<string, string> = {
  'user_cQBA4gKgHPEiHAtaEtHHdPx1jt73LwL0N9BCvHUG4Nu': 'Taha Keremoglu',
  'user_mKNHQXqBAlqlizVUnEln7ng516kATkBys7WU96zg0E6': 'Johannes Bohn',
}

// Custom Activity Type IDs
const CUSTOM_ACTIVITY_TYPES = {
  coldCall: 'actitype_1opHQI1ygoGZjsIG0z7SkR',
  followUp: 'actitype_3EqH37y6lgLrS9vufk3MU4',
}

// Custom Field IDs
const COLD_CALL_NIEMAND_ERREICHT = 'custom.cf_U3JJwHBkSgOGtEKO4wd7b5EeLbUyv0uBXAQuG3GgEu6'
const COLD_CALL_ENTSCHEIDER = 'custom.cf_0qd3PlDb9re1MU97cxNV7MJUXjHVYGmuifQc5CsTrN1'
const FOLLOW_UP_NAECHSTER_SCHRITT = 'custom.cf_JKIoBAGq8wjSE0mo8C6lyWjMZHRw8WlwNJrqb0LpWeN'

// ── Helpers ────────────────────────────────────────────────
function getTodayDateRange(): { start: string; end: string; dateISO: string } {
  // CET/CEST: today from midnight CET to now
  const now = new Date()
  const cetOffset = now.getTimezoneOffset() // We use UTC-based calculation
  // Start of today CET (approx: UTC midnight - 1h in winter, -2h in summer)
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const day = now.getUTCDate()
  // Use the current UTC date as the reference day
  const startUTC = new Date(Date.UTC(year, month, day, 0, 0, 0))
  const endUTC = new Date(Date.UTC(year, month, day, 23, 59, 59))
  const dateISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return {
    start: startUTC.toISOString().split('T')[0],
    end: endUTC.toISOString().split('T')[0],
    dateISO,
  }
}

async function fetchCallsForUser(userId: string, dateStart: string): Promise<any[]> {
  const calls: any[] = []
  let hasMore = true
  let skip = 0
  while (hasMore) {
    const data = await closeApiFetch(
      `/activity/call/?user_id=${userId}&date_created__gte=${dateStart}&_skip=${skip}&_limit=100&_order_by=-date_created&_fields=id,date_created,user_id,user_name,duration,recording_url,has_recording,lead_id,status`
    )
    calls.push(...data.data)
    hasMore = data.has_more
    skip += 100
  }
  return calls
}

async function fetchCallDetail(callId: string): Promise<any> {
  return closeApiFetch(`/activity/call/${callId}/`)
}

async function fetchLeadName(leadId: string): Promise<string> {
  try {
    const data = await closeApiFetch(`/lead/${leadId}/?_fields=display_name`)
    return data.display_name || 'Unbekannt'
  } catch {
    return 'Unbekannt'
  }
}

// ── Audio Download + Whisper Transcription ─────────────────
async function downloadRecording(recordingUrl: string): Promise<Buffer | null> {
  try {
    const res = await fetch(recordingUrl, {
      headers: { Authorization: getAuthHeader() },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  }
}

async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) throw new Error('OPENAI_API_KEY not set')

  // Build multipart form data manually
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2)
  const parts: Buffer[] = []

  // File part
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="call.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`
  ))
  parts.push(audioBuffer)
  parts.push(Buffer.from('\r\n'))

  // Model part
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`
  ))

  // Language part (German)
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nde\r\n`
  ))

  // Close boundary
  parts.push(Buffer.from(`--${boundary}--\r\n`))

  const body = Buffer.concat(parts)

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`Whisper error: ${res.status} ${text}`)
    return ''
  }

  const result = await res.json()
  return result.text || ''
}

// ── Claude Analysis ────────────────────────────────────────
async function analyzeWithClaude(openerName: string, transcripts: { leadName: string; duration: number; transcript: string }[]): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const transcriptBlock = transcripts.map((t, i) =>
    `--- Anruf ${i + 1} | Lead: ${t.leadName} | Dauer: ${t.duration}s ---\n${t.transcript}`
  ).join('\n\n')

  const systemPrompt = `Du bist ein erfahrener Sales-Coach für B2B Kaltakquise im DACH-Raum. Du analysierst die Cold Calls eines Openers bei Content-Leads.de, einer B2B LinkedIn Agentur.

Deine Aufgabe:
- Bewerte die Calls auf einer Skala von 1-10 in vier Kategorien
- Identifiziere Muster, Schwachstellen und Stärken
- Gib konkrete, umsetzbare Coaching-Tipps
- Bewerte GEGEN das offizielle Kaltakquise-Skript (siehe unten)

Antworte IMMER auf Deutsch und im folgenden JSON-Format (ohne Markdown-Code-Block):
{
  "skript_treue": <1-10>,
  "tonalitaet": <1-10>,
  "einwandbehandlung": <1-10>,
  "gespraechsfuehrung": <1-10>,
  "overall": <1-10>,
  "analysis": "<Zusammenfassende Analyse in 3-5 Sätzen>",
  "strengths": "<Was macht der Opener gut? 2-3 Punkte>",
  "weaknesses": "<Was sind die größten Schwächen? 2-3 Punkte>",
  "patterns": "<Wiederkehrende Muster die auffallen>",
  "recommendations": "<3 konkrete Coaching-Tipps für morgen>",
  "einwand_naehe": <1-10>,
  "sprachanteil_opener_pct": <geschätzter Sprachanteil des Openers in Prozent, z.B. 65>,
  "call_highlights": [{"call_nr": 1, "note": "Kurze Notiz was in diesem Call auffiel"}]
}

=== OFFIZIELLES KALTAKQUISE-SKRIPT VON CONTENT-LEADS.DE ===

GRUNDREGEL: Ziel ist IMMER einen TELEFONISCHEN Termin zu legen. Dafür braucht man die persönliche Mail-Adresse und Nummer.

SEKRETÄRIN (niemals pitchen, nur durchstellen lassen):
- "Hallo grüß Sie, stellen Sie mich mal zu dem Herrn [Name] durch. Ich warte solange in der Leitung, danke."
- Wenn "Worum gehts?": "Herr [Name] sollte Bescheid wissen, sagen sie ihm einfach [Opener-Name] ist in der Leitung."
- Wenn nochmal "Worum gehts?": "Es geht um weitere Kommensurabilitätsfragen."
- Falls nicht erreichbar: "Legen Sie Ihm einen Zettel hin und schreiben rauf [Name] hat angerufen."
- NIEMALS sagen worum es geht!

PITCH AN ENTSCHEIDER:
1. "Grüß Dich [Vorname], [Name] hier." {warten auf Antwort}
2. "Ging nur nochmal darum, dass wir aktuell mit einigen Unternehmen aus Ihrer Branche erfolgreich zusammenarbeiten. Kennen Sie die Daddel GmbH oder Sinn&System?"
3. "Wir haben für Sie unser AI Hunter Outbound System aufgesetzt und dadurch generieren Sie pro Woche 15 Termine mit Entscheidern über LinkedIn."
4. "Sie sind mir gerade auf dem Bildschirm angezeigt worden... deswegen meine Frage, wie viele Termine bekommen Sie denn aktuell über LinkedIn?"
5. Terminvorschlag: "Dass wir mal die Tage für 15min zusammen telefonieren, um zu schauen ob das überhaupt sinnvoll ist. Schauen Sie mal in den Kalender, wann es passen würde?"
- IMMER maximal 3 Tage in die Zukunft terminieren!
- Lockerer Tonfall mit Humor ("Die Wochen sind ja wieder so kurz, bei ihnen auch oder haha?")

EINWANDBEHANDLUNG:
- "Kein Bedarf/Kein Interesse": "Das habe ich mir ja gedacht. Hätten Sie Interesse gehabt, hätten Sie uns ja angerufen. Danke dass Sie meinen Job erhalten haben." → Fragen wie Anfragen kommen → Empfehlungs-Argument → nochmal Termin pitchen
- "Keine Zeit": "[Vorname] Wann kann ich dich denn besser erreichen heute?" → Follow-Up legen
- "Schon einen Partner": "Also bist du da schon verheiratet oder nur in der Kennenlernphase?" → je nach Antwort weiter qualifizieren
- "Senden Sie mir eine Mail": "[Vorname], was soll ich dir denn für eine Mail zusenden? Wir haben über 100 Seiten voller Wissen. Hast du mal eine Mail gelesen die besser erklärt hat als ein kurzes Telefonat?"
- "Hohe Versprechungen / 3x am Tag angerufen": "Verstehe ich vollkommen. Aber damit du bewerten kannst ob das Sinn macht, biete ich dir ja diesen 15min-Termin an."
- "Sie sind der 10. heute": "Oh, dann bin ich hoffentlich der sympathischste am heutigen Tag." (lachend) → PITCH
- Letzter Versuch: "Mal unter uns, [Vorname], würdest du mich denn mit der Axt durchs Dorf jagen, wenn wir 15min sprechen?"
- Umsatz-Garantie als letztes Argument: "Was hält dich davon ab, wenn wir dir sogar eine schriftliche Umsatz-Garantie geben?"

TONALITÄT-VORGABEN:
- Angepasst an den Lead: Spiegelt der Opener die Tonalität des Leads? Wenn der Lead locker ist, auch locker sein. Wenn professionell, auch professionell.
- Selbstbewusst und überzeugend, NICHT unterwürfig, bittend oder unsicher
- Bewusster Umgang mit Geschwindigkeit: Im Opening bewusst mal Pause machen, mal langsamer sprechen, Spannung aufbauen
- Ehrlich fragend bei Fragen: Wenn der Opener eine Frage stellt, muss es sich ECHT anfühlen, mit einem hinterfragenden Ton, nicht abgelesen
- Überzeugend bei den Pitches: Beim Pitch muss Überzeugung und Energie rüberkommen
- Humor einbauen (lockere Sprüche, lachen) — aber natürlich, nicht erzwungen
- Duzen beim Entscheider, Siezen bei der Sekretärin
- Niemals aufgeben nach dem ersten Nein — mindestens 3x nachhaken mit verschiedenen Einwandbehandlungen
=== ENDE SKRIPT ===`

  const userPrompt = `Analysiere die folgenden ${transcripts.length} Kaltakquise-Calls von ${openerName} (Opener bei Content-Leads.de).

Bewerte JEDEN Call gegen das offizielle Skript oben. Achte besonders auf:

1. **Skript-Treue** (1-10): Folgt der Opener dem vorgegebenen Ablauf? Nutzt er die richtigen Formulierungen? Pitcht er den Gatekeeper (verboten!) oder stellt er nur durch? Terminiert er maximal 3 Tage in die Zukunft?
2. **Tonalität/Energie** (1-10): Klingt er motiviert, selbstbewusst, locker mit Humor? Oder gelangweilt, unsicher, roboterhaft, zu schnell? Baut er Rapport auf?
3. **Einwandbehandlung** (1-10): Nutzt er die vorgegebenen Einwandbehandlungen? Gibt er zu schnell auf oder bleibt er mindestens 3x dran? Nutzt er die "Axt durchs Dorf"-Formulierung, die Empfehlungs-Argumentation, die Umsatz-Garantie?
4. **Gesprächsführung** (1-10): Stellt er die richtigen qualifizierenden Fragen ("Wie viele Termine über LinkedIn?")? Behält er die Kontrolle? Lässt er den Lead reden? Macht er einen konkreten Terminvorschlag?
5. **Einwand-Nähe** (1-10): Wie nah bleibt der Opener an den vorgegebenen Einwandbehandlungen aus dem Skript? Nutzt er die exakten Formulierungen oder improvisiert er (schlecht)?
6. **Sprachanteil**: Schätze den Sprachanteil des Openers in Prozent. Ideal ist 40-60% (der Lead soll auch reden). Über 70% = der Opener redet zu viel. Unter 30% = der Opener hat keine Kontrolle.

${transcriptBlock}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Claude API error ${res.status}: ${text}`)
  }

  const result = await res.json()
  const responseText = result.content?.[0]?.text || ''

  try {
    return JSON.parse(responseText)
  } catch {
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return {
      skript_treue: 0, tonalitaet: 0, einwandbehandlung: 0, gespraechsfuehrung: 0, overall: 0,
      analysis: responseText,
      strengths: '', weaknesses: '', patterns: '', recommendations: '',
      call_highlights: [],
    }
  }
}

// ── Opener KPIs from Close ────────────────────────────────
interface OpenerKPIs {
  anwahlen: number
  protokolle: number
  entscheiderGesprochen: number
  termineGelegt: number
}

async function fetchCustomActivitiesForDate(dateStart: string): Promise<any[]> {
  const activities: any[] = []
  let hasMore = true
  let skip = 0
  while (hasMore) {
    const data = await closeApiFetch(
      `/activity/custom/?date_created__gte=${dateStart}&_skip=${skip}&_limit=100&_order_by=-date_created&_fields=id,custom_activity_type_id,date_created,user_name,${COLD_CALL_NIEMAND_ERREICHT},${COLD_CALL_ENTSCHEIDER},${FOLLOW_UP_NAECHSTER_SCHRITT}`
    )
    activities.push(...data.data)
    hasMore = data.has_more
    skip += 100
  }
  return activities
}

function computeOpenerKPIs(openerName: string, calls: any[], customActivities: any[]): OpenerKPIs {
  // Anwahlen = total calls made by this opener
  const anwahlen = calls.length

  // Filter custom activities by this opener
  const openerActivities = customActivities.filter((a: any) => a.user_name === openerName)

  // Protokolle = Cold Call Gesprächsprotokolle
  const protokolle = openerActivities.filter((a: any) =>
    a.custom_activity_type_id === CUSTOM_ACTIVITY_TYPES.coldCall
  ).length

  // Entscheider gesprochen = Cold Calls mit Entscheider-Feld (nicht "Niemand erreicht") + Follow-Ups mit Nächster Schritt (nicht "Nicht erreicht")
  const coldCallEntscheider = openerActivities.filter((a: any) =>
    a.custom_activity_type_id === CUSTOM_ACTIVITY_TYPES.coldCall &&
    a[COLD_CALL_ENTSCHEIDER] &&
    a[COLD_CALL_NIEMAND_ERREICHT] !== 'Ja'
  ).length

  const followUpEntscheider = openerActivities.filter((a: any) =>
    a.custom_activity_type_id === CUSTOM_ACTIVITY_TYPES.followUp &&
    a[FOLLOW_UP_NAECHSTER_SCHRITT] &&
    a[FOLLOW_UP_NAECHSTER_SCHRITT] !== '5. Nicht erreicht'
  ).length

  const entscheiderGesprochen = coldCallEntscheider + followUpEntscheider

  // Termine gelegt = Cold Calls mit "Setting vereinbart am:" + Follow-Ups mit "2. Setting gelegt am:"
  const termineFromColdCall = openerActivities.filter((a: any) =>
    a.custom_activity_type_id === CUSTOM_ACTIVITY_TYPES.coldCall &&
    a[COLD_CALL_ENTSCHEIDER] === 'Setting vereinbart am:'
  ).length

  const termineFromFollowUp = openerActivities.filter((a: any) =>
    a.custom_activity_type_id === CUSTOM_ACTIVITY_TYPES.followUp &&
    a[FOLLOW_UP_NAECHSTER_SCHRITT] === '2. Setting gelegt am:'
  ).length

  const termineGelegt = termineFromColdCall + termineFromFollowUp

  return { anwahlen, protokolle, entscheiderGesprochen, termineGelegt }
}

// ── Slack ──────────────────────────────────────────────────
async function sendSlackMessage(text: string) {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) return

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      channel: 'C09FV66E48Y',
      text,
      unfurl_links: false,
    }),
  })
}

// ── Main Cron Handler ─────────────────────────────────────
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    if (!process.env.CLOSE_API_KEY) {
      return NextResponse.json({ error: 'CLOSE_API_KEY not set' }, { status: 500 })
    }

    const { start, dateISO } = getTodayDateRange()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

    // Fetch custom activities for today (for KPI calculation)
    let todayCustomActivities: any[] = []
    try {
      todayCustomActivities = await fetchCustomActivitiesForDate(start)
    } catch (err) {
      console.error('Failed to fetch custom activities:', err)
    }

    const results: any[] = []
    const openerKPIMap: Record<string, OpenerKPIs> = {}

    for (const [userId, openerName] of Object.entries(OPENER_IDS)) {
      // 1. Fetch all calls for this opener today
      const allCalls = await fetchCallsForUser(userId, start)

      // Compute daily KPIs for this opener
      openerKPIMap[openerName] = computeOpenerKPIs(openerName, allCalls, todayCustomActivities)

      if (allCalls.length === 0) {
        results.push({ opener: openerName, totalCalls: 0, message: 'Keine Anrufe heute' })
        continue
      }

      // 2. Filter calls with recordings (duration > 30s and has_recording)
      const callsWithRecording = allCalls.filter((c: any) =>
        c.duration && c.duration > 30 && c.recording_url
      )
      const totalMinutes = allCalls.reduce((sum: number, c: any) => sum + (c.duration || 0), 0) / 60

      // 3. Download audio + transcribe with Whisper (parallel batches of 5 to stay within limits)
      const transcripts: { leadName: string; duration: number; transcript: string }[] = []

      // Take max 20 longest calls to keep within time/cost limits
      const selectedCalls = callsWithRecording
        .sort((a: any, b: any) => (b.duration || 0) - (a.duration || 0))
        .slice(0, 20)

      for (let i = 0; i < selectedCalls.length; i += 5) {
        const batch = selectedCalls.slice(i, i + 5)
        const results = await Promise.all(
          batch.map(async (call: any) => {
            try {
              // Download recording audio
              const audioBuffer = await downloadRecording(call.recording_url)
              if (!audioBuffer || audioBuffer.length < 1000) return null

              // Transcribe with Whisper
              const transcript = await transcribeAudio(audioBuffer)
              if (!transcript || transcript.length < 30) return null

              const leadName = call.lead_id ? await fetchLeadName(call.lead_id) : 'Unbekannt'
              return {
                leadName,
                duration: call.duration || 0,
                transcript,
              }
            } catch (err) {
              console.error(`Failed to transcribe call ${call.id}:`, err)
              return null
            }
          })
        )
        transcripts.push(...results.filter(Boolean) as any[])
      }

      if (transcripts.length === 0) {
        results.push({
          opener: openerName,
          totalCalls: allCalls.length,
          callsWithTranscript: 0,
          message: 'Keine Transkripte verfügbar',
        })

        // Store empty result
        if (supabase) {
          await supabase.from('call_analyses').upsert({
            date: dateISO,
            opener_name: openerName,
            opener_user_id: userId,
            total_calls: allCalls.length,
            calls_with_transcript: 0,
            total_call_minutes: Math.round(totalMinutes * 10) / 10,
          }, { onConflict: 'date,opener_user_id' })
        }
        continue
      }

      // 4. Analyze with Claude
      let analysis: any
      try {
        // If too many transcripts, take the longest/most interesting ones (max 25)
        const selectedTranscripts = transcripts
          .sort((a, b) => b.transcript.length - a.transcript.length)
          .slice(0, 25)

        analysis = await analyzeWithClaude(openerName, selectedTranscripts)
      } catch (err: any) {
        console.error(`Claude analysis failed for ${openerName}:`, err)
        analysis = {
          skript_treue: 0, tonalitaet: 0, einwandbehandlung: 0, gespraechsfuehrung: 0, overall: 0,
          analysis: `Analyse fehlgeschlagen: ${err.message}`,
          strengths: '', weaknesses: '', patterns: '', recommendations: '',
          call_highlights: [],
        }
      }

      // 5. Store in Supabase
      if (supabase) {
        await supabase.from('call_analyses').upsert({
          date: dateISO,
          opener_name: openerName,
          opener_user_id: userId,
          total_calls: allCalls.length,
          calls_with_transcript: transcripts.length,
          total_call_minutes: Math.round(totalMinutes * 10) / 10,
          skript_treue_score: analysis.skript_treue || 0,
          tonalitaet_score: analysis.tonalitaet || 0,
          einwandbehandlung_score: analysis.einwandbehandlung || 0,
          gespraechsfuehrung_score: analysis.gespraechsfuehrung || 0,
          overall_score: analysis.overall || 0,
          analysis_text: analysis.analysis || '',
          strengths: analysis.strengths || '',
          weaknesses: analysis.weaknesses || '',
          patterns: analysis.patterns || '',
          recommendations: analysis.recommendations || '',
          call_summaries: analysis.call_highlights || [],
          einwand_naehe_score: analysis.einwand_naehe || 0,
          sprachanteil_opener_pct: analysis.sprachanteil_opener_pct || 0,
        }, { onConflict: 'date,opener_user_id' })
      }

      results.push({
        opener: openerName,
        totalCalls: allCalls.length,
        callsWithTranscript: transcripts.length,
        totalMinutes: Math.round(totalMinutes),
        scores: {
          skriptTreue: analysis.skript_treue,
          tonalitaet: analysis.tonalitaet,
          einwandbehandlung: analysis.einwandbehandlung,
          gespraechsfuehrung: analysis.gespraechsfuehrung,
          overall: analysis.overall,
        },
        analysis,
      })
    }

    // 6. Send Slack summary
    const slackLines: string[] = [
      `*:telephone_receiver: Tägliche Call-Analyse — ${dateISO}*\n`,
    ]

    // KPI-Übersicht pro Opener
    slackLines.push('*:bar_chart: Tages-Kennzahlen*')
    for (const [, openerName] of Object.entries(OPENER_IDS)) {
      const kpi = openerKPIMap[openerName]
      if (kpi) {
        const quoteEntscheider = kpi.anwahlen > 0 ? Math.round(kpi.anwahlen / Math.max(kpi.entscheiderGesprochen, 1)) : 0
        const quoteTermin = kpi.anwahlen > 0 ? Math.round(kpi.anwahlen / Math.max(kpi.termineGelegt, 1)) : 0
        const erreichquote = kpi.protokolle > 0 ? Math.round((kpi.entscheiderGesprochen / kpi.protokolle) * 100) : 0

        slackLines.push(
          `\n*${openerName}*`,
          `:phone: Anwahlen: *${kpi.anwahlen}*`,
          `:clipboard: Protokolle: *${kpi.protokolle}*`,
          `:bust_in_silhouette: Entscheider gesprochen: *${kpi.entscheiderGesprochen}*`,
          `:calendar: Termine gelegt: *${kpi.termineGelegt}*`,
          `:chart_with_upwards_trend: *Quoten:* ${quoteEntscheider} Anwahlen/Entscheider | ${quoteTermin} Anwahlen/Termin | ${erreichquote}% Erreichquote`,
        )
      }
    }
    slackLines.push('\n---\n')

    for (const r of results) {
      if (r.totalCalls === 0) {
        slackLines.push(`*${r.opener}*: Keine Anrufe heute\n`)
        continue
      }

      const a = r.analysis || {}
      const scoreEmoji = (s: number) => s >= 8 ? ':star:' : s >= 6 ? ':white_check_mark:' : s >= 4 ? ':warning:' : ':x:'

      slackLines.push(
        `*${r.opener}* — ${r.totalCalls} Calls (${r.callsWithTranscript} mit Transkript, ${r.totalMinutes} Min)`,
        `${scoreEmoji(a.overall || 0)} *Gesamt: ${a.overall || '-'}/10* | Skript: ${a.skript_treue || '-'} | Tonalität: ${a.tonalitaet || '-'} | Einwände: ${a.einwandbehandlung || '-'} | Führung: ${a.gespraechsfuehrung || '-'} | Einwand-Nähe: ${a.einwand_naehe || '-'}`,
        `:speaking_head_in_silhouette: Sprachanteil: ${a.sprachanteil_opener_pct || '?'}% (Ideal: 40-60%)`,
      )

      if (a.strengths) slackLines.push(`:muscle: *Stärken:* ${a.strengths}`)
      if (a.weaknesses) slackLines.push(`:point_right: *Schwächen:* ${a.weaknesses}`)
      if (a.recommendations) slackLines.push(`:bulb: *Morgen üben:* ${a.recommendations}`)
      slackLines.push('')
    }

    await sendSlackMessage(slackLines.join('\n'))

    return NextResponse.json({ success: true, date: dateISO, results })
  } catch (error: any) {
    console.error('Daily call analysis error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
