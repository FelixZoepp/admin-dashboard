import { NextRequest, NextResponse } from 'next/server'
import { fetchCloseData } from '../../data'

function fmtEuro(n: number): string {
  return '\u20AC' + n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtNum(n: number): string {
  return n.toLocaleString('de-DE')
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

const monthLong: Record<string, string> = {
  '01': 'Januar', '02': 'Februar', '03': 'M\u00e4rz', '04': 'April',
  '05': 'Mai', '06': 'Juni', '07': 'Juli', '08': 'August',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Dezember',
}

function baseStyles(): string {
  return `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; background: #fff; padding: 40px; font-size: 13px; line-height: 1.5; }
      h1 { font-size: 22px; margin-bottom: 4px; color: #111; }
      h2 { font-size: 16px; margin: 28px 0 12px 0; color: #333; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
      .subtitle { font-size: 13px; color: #666; margin-bottom: 24px; }
      .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
      .kpi-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
      .kpi-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
      .kpi-value { font-size: 22px; font-weight: 700; color: #111; }
      .kpi-sub { font-size: 11px; color: #888; margin-top: 2px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
      th { text-align: left; padding: 8px 10px; background: #f9fafb; border-bottom: 2px solid #e5e7eb; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #666; }
      td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }
      .funnel-bar { height: 22px; border-radius: 4px; display: flex; align-items: center; padding-left: 8px; font-size: 11px; font-weight: 600; color: #fff; margin-bottom: 6px; }
      .section { margin-bottom: 24px; }
      .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #999; text-align: center; }
      .green { color: #059669; }
      .red { color: #dc2626; }
      .blue { color: #2563eb; }
      @media print {
        body { padding: 20px; }
        @page { margin: 15mm; }
        .no-print { display: none; }
      }
    </style>
  `
}

function header(title: string): string {
  return `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
      <div>
        <h1>${title}</h1>
      </div>
      <div style="text-align: right; font-size: 12px; color: #666;">
        Content Leads GmbH
      </div>
    </div>
  `
}

function footer(): string {
  const now = new Date()
  const ts = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return `<div class="footer">Content Leads Admin Dashboard &mdash; Generiert am ${ts} &mdash; Quelle: Close CRM API</div>`
}

function kpiCard(label: string, value: string, sub: string): string {
  return `<div class="kpi-card"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-sub">${sub}</div></div>`
}

function funnelSection(data: any): string {
  const f = data.conversionFunnel
  return `
    <h2>Conversion Funnel</h2>
    <div class="section">
      <div style="margin-bottom: 4px; font-size: 12px;"><strong>Alle Opps:</strong> ${fmtNum(f.totalOpportunities)} (100%)</div>
      <div class="funnel-bar" style="width: 100%; background: #3b82f6;">Alle Opps: ${fmtNum(f.totalOpportunities)}</div>
      <div style="margin-bottom: 4px; font-size: 12px;"><strong>Setting:</strong> ${fmtNum(f.reachedSetting)} (100%)</div>
      <div class="funnel-bar" style="width: 100%; background: #6366f1;">Setting: ${fmtNum(f.reachedSetting)}</div>
      <div style="margin-bottom: 4px; font-size: 12px;"><strong>Closing:</strong> ${fmtNum(f.reachedClosing)} (${f.settingToClosingRate.toFixed(1)}%)</div>
      <div class="funnel-bar" style="width: ${Math.max(f.settingToClosingRate, 2)}%; background: #f59e0b;">Closing: ${fmtNum(f.reachedClosing)}</div>
      <div style="margin-bottom: 4px; font-size: 12px;"><strong>Won:</strong> ${fmtNum(f.wonCount)} (${f.overallConversionRate.toFixed(1)}%)</div>
      <div class="funnel-bar" style="width: ${Math.max(f.overallConversionRate, 2)}%; background: #10b981;">Won: ${fmtNum(f.wonCount)}</div>
      <div style="margin-top: 12px; font-size: 12px; color: #666;">
        Setting &rarr; Closing: <strong>${f.settingToClosingRate.toFixed(1)}%</strong> &nbsp;|&nbsp;
        Closing &rarr; Won: <strong>${f.closingToWonRate.toFixed(1)}%</strong> &nbsp;|&nbsp;
        Gesamt: <strong>${f.overallConversionRate.toFixed(1)}%</strong>
      </div>
    </div>
  `
}

function waterfallSection(data: any): string {
  const w = data.waterfall
  const f = data.conversionFunnel
  return `
    <h2>Waterfall Kennzahlen</h2>
    <div class="kpi-grid">
      ${kpiCard('Settings pro Close', String(w.settingsPerClose), 'Settings f\u00FCr 1 Won Deal')}
      ${kpiCard('Closings pro Close', String(w.closingsPerClose), 'Closings f\u00FCr 1 Won Deal')}
      ${kpiCard('Gesamt Conversion', f.overallConversionRate.toFixed(1) + '%', 'Alle Opps zu Won')}
      ${kpiCard('\u00D8 Deal Cycle', w.avgDealCycle + ' Tage', 'Erstellung bis Won')}
    </div>
  `
}

function pipelineTable(data: any): string {
  if (!data.pipelineSorted || data.pipelineSorted.length === 0) return ''
  let rows = ''
  for (const p of data.pipelineSorted) {
    rows += `<tr><td>${p.label}</td><td style="text-align:center">${p.count}</td><td style="text-align:right">${fmtEuro(p.value)}</td></tr>`
  }
  return `
    <h2>Pipeline Breakdown</h2>
    <table>
      <thead><tr><th>Status</th><th style="text-align:center">Deals</th><th style="text-align:right">Wert</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `
}

function wonDealsTable(data: any): string {
  if (!data.wonDealsDisplay || data.wonDealsDisplay.length === 0) return '<p style="color:#888">Keine Won Deals in diesem Zeitraum.</p>'
  let rows = ''
  for (const d of data.wonDealsDisplay) {
    rows += `<tr><td>${d.name}</td><td style="text-align:right; font-weight:600; color:#059669">${fmtEuro(d.value)}</td><td>${fmtDate(d.date)}</td><td>${d.user}</td></tr>`
  }
  return `
    <table>
      <thead><tr><th>Lead</th><th style="text-align:right">Wert</th><th>Datum</th><th>Closer</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `
}

function buildDailyReport(data: any): string {
  const now = new Date()
  const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`
  const estimatedCallsToday = data.callsThisWeek > 0 ? Math.round(data.callsThisWeek / Math.max(now.getDay() || 5, 1)) : 0

  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Tagesreport ${dateStr}</title>${baseStyles()}</head><body>
    ${header(`Content Leads &mdash; Tagesreport ${dateStr}`)}
    <div class="subtitle">Tages\u00FCbersicht f\u00FCr ${dateStr}</div>

    <h2>KPIs</h2>
    <div class="kpi-grid">
      ${kpiCard('Anwahlen (ca.)', fmtNum(estimatedCallsToday), 'Gesch\u00E4tzt aus KW-Daten')}
      ${kpiCard('Anwahlen KW', fmtNum(data.callsThisWeek), 'Aktuelle Woche')}
      ${kpiCard('Pipeline', String(data.pipelineCount), fmtEuro(data.pipelineValue) + ' Wert')}
      ${kpiCard('Won Deals MTD', String(data.wonDealsCount), fmtEuro(data.wonDealsValue))}
    </div>

    ${pipelineTable(data)}

    <h2>Won Deals &mdash; ${data.currentMonthName}</h2>
    ${wonDealsTable(data)}

    ${footer()}
    <script>window.onload = function() { window.print(); }</script>
  </body></html>`
}

function buildWeeklyReport(data: any): string {
  const now = new Date()
  const kw = getISOWeekNumber(now)

  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Wochenreport KW ${kw}</title>${baseStyles()}</head><body>
    ${header(`Content Leads &mdash; Wochenreport KW ${kw}`)}
    <div class="subtitle">Kalenderwoche ${kw}, ${now.getFullYear()}</div>

    <h2>KPIs</h2>
    <div class="kpi-grid">
      ${kpiCard('Anwahlen KW', fmtNum(data.callsThisWeek), 'vs. VW: ' + fmtNum(data.callsLastWeek))}
      ${kpiCard('Won Deals MTD', String(data.wonDealsCount), fmtEuro(data.wonDealsValue))}
      ${kpiCard('Pipeline', String(data.pipelineCount), fmtEuro(data.pipelineValue) + ' Wert')}
      ${kpiCard('Closing Rate', data.closingRate + '%', data.wonTotal + ' Won / ' + data.closedTotal + ' Closed')}
    </div>

    ${funnelSection(data)}
    ${pipelineTable(data)}

    <h2>Won Deals &mdash; ${data.currentMonthName}</h2>
    ${wonDealsTable(data)}

    ${footer()}
    <script>window.onload = function() { window.print(); }</script>
  </body></html>`
}

function buildMonthlyReport(data: any): string {
  const now = new Date()
  const monthKey = String(now.getMonth() + 1).padStart(2, '0')
  const monthName = monthLong[monthKey] || ''

  // Historical performance table
  let histRows = ''
  if (data.historicalPerformance) {
    for (const h of data.historicalPerformance) {
      histRows += `<tr><td>${h.label}${h.isCurrent ? ' (MTD)' : ''}</td><td style="text-align:right; font-weight:600">${fmtEuro(h.value)}</td></tr>`
    }
  }

  // Pipeline deals table
  let pipelineDealsRows = ''
  if (data.pipelineDealsWithValue) {
    for (const d of data.pipelineDealsWithValue) {
      pipelineDealsRows += `<tr><td>${d.leadName}</td><td>${d.status}</td><td style="text-align:right; font-weight:600">${fmtEuro(d.value)}</td></tr>`
    }
  }

  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Monatsreport ${monthName} ${now.getFullYear()}</title>${baseStyles()}</head><body>
    ${header(`Content Leads &mdash; Monatsreport ${monthName} ${now.getFullYear()}`)}
    <div class="subtitle">Monatsbericht ${monthName} ${now.getFullYear()} (Stand: ${data.currentDate})</div>

    <h2>KPIs</h2>
    <div class="kpi-grid">
      ${kpiCard('Umsatz MTD', fmtEuro(data.revenueMTD), data.currentMonthName + ' ' + data.currentYear)}
      ${kpiCard('Won Deals', String(data.wonDealsCount), fmtEuro(data.wonDealsValue) + ' Wert')}
      ${kpiCard('Lost Deals', String(data.lostCount), fmtEuro(data.totalLostValue) + ' entgangen')}
      ${kpiCard('Closing Rate', data.closingRate + '%', data.wonTotal + ' Won / ' + data.closedTotal + ' Closed')}
      ${kpiCard('Avg Deal Size', fmtEuro(data.avgDealSize), '\u00D8 Won Deal')}
      ${kpiCard('Pipeline Wert', fmtEuro(data.pipelineValue), data.pipelineCount + ' aktive Deals')}
    </div>

    ${funnelSection(data)}
    ${waterfallSection(data)}
    ${pipelineTable(data)}

    <h2>Won Deals &mdash; ${monthName} ${now.getFullYear()}</h2>
    ${wonDealsTable(data)}

    ${pipelineDealsRows ? `
    <h2>Pipeline Deals mit Wert</h2>
    <table>
      <thead><tr><th>Lead</th><th>Status</th><th style="text-align:right">Wert</th></tr></thead>
      <tbody>${pipelineDealsRows}</tbody>
    </table>
    ` : ''}

    <h2>Historische Performance</h2>
    <table>
      <thead><tr><th>Monat</th><th style="text-align:right">Won Revenue</th></tr></thead>
      <tbody>${histRows}</tbody>
    </table>

    <h2>Forecast</h2>
    <div class="kpi-grid">
      ${kpiCard('Forecast (linear)', fmtEuro(data.linearForecast), 'Lineare Extrapolation (' + data.currentDay + '/' + data.daysInMonth + ' Tage)')}
      ${kpiCard('Forecast + Pipeline', fmtEuro(data.pipelineWeightedForecast), '+ Pipeline x ' + data.closingRate + '% Win Rate')}
      ${kpiCard('Avg. letzten 3 Monate', fmtEuro(data.avg3Months), 'Durchschnitt')}
    </div>

    ${footer()}
    <script>window.onload = function() { window.print(); }</script>
  </body></html>`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'daily'

    const data = await fetchCloseData()

    if ('error' in data && data.error) {
      return new NextResponse(`<html><body><h1>Fehler</h1><p>${data.error}</p></body></html>`, {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    let html: string
    switch (period) {
      case 'weekly':
        html = buildWeeklyReport(data)
        break
      case 'monthly':
        html = buildMonthlyReport(data)
        break
      case 'daily':
      default:
        html = buildDailyReport(data)
        break
    }

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error: any) {
    return new NextResponse(`<html><body><h1>Fehler</h1><p>${error.message || 'Unbekannter Fehler'}</p></body></html>`, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}
