'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Helpers ──────────────────────────────────────────────────
function fmtNum(n: number): string {
  return n.toLocaleString('de-DE')
}
function fmtEuro(n: number): string {
  return '\u20AC' + n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}
function fmtEuroK(n: number): string {
  if (n >= 1000) return `\u20AC${Math.round(n / 1000)}k`
  return fmtEuro(n)
}

// ── Chart utilities ──────────────────────────────────────────
function generateSeries(n: number, base: number, variance: number, trend = 0): number[] {
  const data: number[] = []
  let v = base
  for (let i = 0; i < n; i++) {
    v += (Math.random() - 0.5) * variance + trend
    data.push(Math.max(0, Math.round(v)))
  }
  return data
}

// ── Data interface ───────────────────────────────────────────
interface DashboardData {
  currentWeek: number
  currentDate: string
  currentDay: number
  daysInMonth: number
  currentMonthName: string
  currentYear: number
  callsThisWeek: number
  callsLastWeek: number
  wonDealsCount: number
  wonDealsValue: number
  pipelineCount: number
  pipelineValue: number
  closingRate: number
  wonTotal: number
  closedTotal: number
  avgDealSize: number
  totalLeads: number
  leadpoolCount: number
  kundenCount: number
  totalRevenue: number
  totalLostValue: number
  lostCount: number
  totalCalls8W: number
  wonDealsDisplay: { name: string; value: number; date: string; user: string }[]
  pipelineSorted: { count: number; value: number; label: string }[]
  pipelineDealsWithValue: { leadName: string; status: string; value: number }[]
  leadStatusCounts: { label: string; count: number; color: string; leads: { name: string; date: string }[] }[]
  weeklyCallData: { week: string; calls: number }[]
  monthlyChartData: { label: string; value: number; isCurrent: boolean }[]
  historicalPerformance: { label: string; value: number; isCurrent: boolean; deals: { name: string; value: number; date: string; user: string }[] }[]
  revenueMTD: number
  linearForecast: number
  pipelineWeightedForecast: number
  avg3Months: number
  conversionFunnel: {
    totalOpportunities: number
    reachedSetting: number
    reachedClosing: number
    wonCount: number
    lostCount: number
    settingToClosingRate: number
    closingToWonRate: number
    overallConversionRate: number
  }
  waterfall: {
    settingsPerClose: number
    closingsPerClose: number
    totalOpps: number
    avgDealCycle: number
  }
  pipelineDealsByStatus: Record<string, { leadName: string; value: number; date: string }[]>
  customerAnalytics: {
    customers: {
      name: string
      deals: { value: number; date: string; valuePeriod: string }[]
      totalRevenue: number
      firstDeal: string
      latestDeal: string
      dealCount: number
    }[]
    totalCustomers: number
    upsellCustomers: number
    singleDealCustomers: number
    upsellRate: number
    avgCLV: number
    revenueConcentration: number
    top3Revenue: number
    inactiveCustomers: number
    activeCustomers: number
    churnRate: number
    avgTimeBetweenDeals: number
    upsellRevenue: number
    upsellRevenueShare: number
  }
  airtableMetrics: {
    customers: {
      dealName: string
      kundenId: string
      status: 'Aktiv' | 'Gekündigt'
      produkt: string
      vertragstyp: 'Erstdeal' | 'Upsell'
      vertragssumme: number
      monatlicheRate: number
      vertragslaufzeit: number
      vertragsbeginn: string
      vertragsende: string
      kuendigungsgrund: string
      upsellDatum: string
      notizen: string
    }[]
    totalCustomers: number
    activeCustomers: number
    churned: number
    churnRate: number
    mrr: number
    arr: number
    arpu: number
    ltv: number
    avgContractLength: number
    totalContractVolume: number
    upsellCount: number
    upsellRate: number
    churnReasons: { reason: string; count: number }[]
    productMix: { product: string; total: number; active: number; mrr: number }[]
    activeList: {
      dealName: string
      kundenId: string
      status: 'Aktiv' | 'Gekündigt'
      produkt: string
      vertragstyp: 'Erstdeal' | 'Upsell'
      vertragssumme: number
      monatlicheRate: number
      vertragslaufzeit: number
      vertragsbeginn: string
      vertragsende: string
      kuendigungsgrund: string
      upsellDatum: string
      notizen: string
    }[]
    churnedList: {
      dealName: string
      kundenId: string
      status: 'Aktiv' | 'Gekündigt'
      produkt: string
      vertragstyp: 'Erstdeal' | 'Upsell'
      vertragssumme: number
      monatlicheRate: number
      vertragslaufzeit: number
      vertragsbeginn: string
      vertragsende: string
      kuendigungsgrund: string
      upsellDatum: string
      notizen: string
    }[]
    upsellList: {
      dealName: string
      kundenId: string
      status: 'Aktiv' | 'Gekündigt'
      produkt: string
      vertragstyp: 'Erstdeal' | 'Upsell'
      vertragssumme: number
      monatlicheRate: number
      vertragslaufzeit: number
      vertragsbeginn: string
      vertragsende: string
      kuendigungsgrund: string
      upsellDatum: string
      notizen: string
    }[]
  }
  calendlyMetrics: {
    weekEvents: { name: string; startTime: string; endTime: string; category: 'setting' | 'closing' | 'onboarding' | 'other'; location: string }[]
    monthEvents: { name: string; startTime: string; endTime: string; category: 'setting' | 'closing' | 'onboarding' | 'other'; location: string }[]
    weekSettings: number
    weekClosings: number
    weekOnboardings: number
    weekOther: number
    monthSettings: number
    monthClosings: number
    monthOnboardings: number
    monthOther: number
  }
  salesFunnel: {
    today: {
      anwahlen: number
      entscheiderErreicht: number
      coldCalls: number
      followUps: number
      settingsGelegt: number
      closingsGelegt: number
      wonDeals: number
      wonRevenue: number
    }
    week: {
      anwahlen: number
      entscheiderErreicht: number
      coldCalls: number
      followUps: number
      settingsGelegt: number
      closingsGelegt: number
      wonDeals: number
      wonRevenue: number
    }
    month: {
      anwahlen: number
      entscheiderErreicht: number
      coldCalls: number
      followUps: number
      settingsGelegt: number
      closingsGelegt: number
      wonDeals: number
      wonRevenue: number
    }
    quoten: {
      erreichquote: number
      settingQuote: number
      closingQuote: number
      abschlussQuote: number
      overallAnwahlenToWon: number
    }
    pipeline: {
      settingTerminiert: number
      settingNoShow: number
      settingFollowUp: number
      closingTerminiert: number
      closingNoShow: number
      closingFollowUp: number
      angebotVerschickt: number
      cc2Terminiert: number
    }
  }
  allWonDeals: { name: string; value: number; date: string; user: string }[]
  allLostDeals: { name: string; value: number; date: string }[]
  todayISO: string
  weekStartISO: string
  monthStartISO: string
  yearStartISO: string
  lastUpdated: string
  error?: string
}

type Period = 'today' | 'week' | 'month' | 'year'
const PERIOD_LABELS: Record<Period, string> = {
  today: 'Heute',
  week: 'Woche',
  month: 'Monat',
  year: 'Jahr',
}

// ── Sidebar nav items ────────────────────────────────────────
const NAV_DASHBOARD = [
  { id: 'sales', label: 'Sales', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-5"/></svg> },
  { id: 'fulfillment', label: 'Fulfillment', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> },
  { id: 'marketing', label: 'Marketing', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg> },
  { id: 'finanzen', label: 'Finanzen', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2.5 0 00-2.5-1h-1a2 2 0 000 4h2a2 2 0 010 4h-1a2.5 2.5 0 01-2.5-1M12 5.5v1M12 17.5v1"/></svg> },
  { id: 'kunden', label: 'Kunden', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg> },
  { id: 'recruiting', label: 'Recruiting', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><path d="M12 12v4"/><path d="M10 14h4"/></svg> },
  { id: 'team', label: 'Team', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
]

// ══════════════════════════════════════════════════════════════
// CHART COMPONENTS
// ══════════════════════════════════════════════════════════════

function SparklineChart({ data, color = '#C5A059', width = 140, height = 44 }: { data: number[]; color?: string; width?: number; height?: number }) {
  const pad = 2
  const max = Math.max(...data), min = Math.min(...data)
  const range = max - min || 1
  const step = (width - pad * 2) / (data.length - 1)
  const pts = data.map((d, i) => {
    const x = pad + i * step
    const y = height - pad - ((d - min) / range) * (height - pad * 2)
    return [x, y]
  })
  const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' ')
  const fillD = d + ` L ${pts[pts.length - 1][0].toFixed(2)} ${height} L ${pts[0][0].toFixed(2)} ${height} Z`
  const last = pts[pts.length - 1]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="kpi-spark">
      <path d={fillD} fill={color} fillOpacity={0.15} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill={color} />
    </svg>
  )
}

function AreaChart({ series, labels, width = 720, height = 240 }: {
  series: { name: string; data: number[]; color: string; glow?: boolean }[]
  labels: string[]
  width?: number
  height?: number
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const padL = 40, padR = 16, padT = 20, padB = 28
  const innerW = width - padL - padR
  const innerH = height - padT - padB
  const all = series.flatMap(s => s.data)
  const max = Math.max(...all) * 1.1
  const range = max || 1
  const n = series[0].data.length
  const step = innerW / (n - 1)
  const gridLines = 4
  const gridColor = 'rgba(249,249,249,0.06)'

  return (
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: `${height}px` }}>
      <defs>
        <filter id="chartGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {series.map((s, si) => (
          <linearGradient key={si} id={`area-grad-${si}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={s.color} stopOpacity={0.42} />
            <stop offset="1" stopColor={s.color} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>
      {/* Grid lines */}
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const y = padT + (innerH / gridLines) * i
        const val = Math.round(max - (range / gridLines) * i)
        return (
          <g key={i}>
            <line x1={padL} x2={width - padR} y1={y} y2={y} stroke={gridColor} strokeDasharray="3 3" />
            <text x={padL - 8} y={y + 4} fill="rgba(249,249,249,0.35)" textAnchor="end" fontFamily="Inter, sans-serif" fontSize="9" letterSpacing="0.2em">{val}</text>
          </g>
        )
      })}
      {/* X labels */}
      {labels.map((lbl, i) => {
        if (!lbl) return null
        const x = padL + step * i
        return <text key={i} x={x} y={height - 8} fill="rgba(249,249,249,0.35)" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="9" letterSpacing="0.2em">{lbl}</text>
      })}
      {/* Series */}
      {series.map((s, si) => {
        const pts = s.data.map((d, i) => {
          const x = padL + step * i
          const y = padT + innerH - (d / range) * innerH
          return [x, y]
        })
        const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' ')
        const areaD = d + ` L ${pts[pts.length - 1][0].toFixed(2)} ${padT + innerH} L ${pts[0][0].toFixed(2)} ${padT + innerH} Z`
        const last = pts[pts.length - 1]
        return (
          <g key={si}>
            <path d={areaD} fill={`url(#area-grad-${si})`} />
            <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" filter={s.glow ? 'url(#chartGlow)' : undefined} />
            <circle cx={last[0]} cy={last[1]} r="6" fill={s.color} opacity="0.3" className="chart-pulse" />
            <circle cx={last[0]} cy={last[1]} r="3" fill={s.color} />
          </g>
        )
      })}
    </svg>
  )
}

function BarChart({ data, labels, width = 480, height = 220, color = '#C5A059' }: {
  data: number[]; labels: string[]; width?: number; height?: number; color?: string
}) {
  const padL = 32, padR = 12, padT = 16, padB = 28
  const innerW = width - padL - padR
  const innerH = height - padT - padB
  const max = Math.max(...data) * 1.1
  const barW = innerW / data.length * 0.55
  const gap = innerW / data.length

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: `${height}px` }}>
      <defs>
        <linearGradient id="bar-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={1} />
          <stop offset="1" stopColor={color} stopOpacity={0.2} />
        </linearGradient>
      </defs>
      {Array.from({ length: 4 }).map((_, i) => {
        const y = padT + (innerH / 3) * i
        return <line key={i} x1={padL} x2={width - padR} y1={y} y2={y} stroke="rgba(249,249,249,0.05)" />
      })}
      {data.map((v, i) => {
        const x = padL + gap * i + (gap - barW) / 2
        const barH = (v / max) * innerH
        const y = padT + innerH - barH
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill="url(#bar-grad)" />
            <text x={x + barW / 2} y={height - 8} fill="rgba(249,249,249,0.5)" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="9" letterSpacing="0.2em">{labels[i]}</text>
          </g>
        )
      })}
    </svg>
  )
}

function DonutChart({ segments, size = 180, thickness = 22, centerValue, centerLabel }: {
  segments: { value: number; color: string }[]
  size?: number; thickness?: number
  centerValue?: string; centerLabel?: string
}) {
  const c = size / 2
  const r = c - thickness / 2 - 4
  const total = segments.reduce((s, x) => s + x.value, 0)
  const circ = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="donut-shell">
      <svg viewBox={`0 0 ${size} ${size}`} className="donut-svg">
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(249,249,249,0.06)" strokeWidth={thickness} />
        {segments.map((seg, i) => {
          const len = (seg.value / total) * circ
          const thisOffset = offset
          offset += len
          return (
            <circle
              key={i}
              cx={c} cy={c} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeLinecap="round"
              transform={`rotate(-90 ${c} ${c})`}
              strokeDasharray={`${len} ${circ}`}
              strokeDashoffset={-thisOffset}
            />
          )
        })}
      </svg>
      {(centerValue || centerLabel) && (
        <div className="donut-center">
          {centerValue && <div className="val">{centerValue}</div>}
          {centerLabel && <div className="lbl">{centerLabel}</div>}
        </div>
      )}
    </div>
  )
}

function FunnelChart({ stages }: { stages: { name: string; value: number; pct: string; color: string }[] }) {
  const [animated, setAnimated] = useState(false)
  const max = Math.max(...stages.map(s => s.value))
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 200)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="funnel">
      {stages.map((stage, i) => {
        const widthPct = (stage.value / max) * 100
        return (
          <div key={i} className="funnel-row">
            <div className="funnel-label">
              <span className="funnel-stage-num">0{i + 1}</span>
              <span className="funnel-stage-name">{stage.name}</span>
            </div>
            <div className="funnel-track">
              <div className="funnel-fill" style={{ width: animated ? `${widthPct}%` : '0%', background: stage.color }} />
            </div>
            <div className="funnel-value">{fmtNum(stage.value)}</div>
            <div className="funnel-pct">{stage.pct}</div>
          </div>
        )
      })}
    </div>
  )
}

function HeatmapChart({ weeks = 20 }: { weeks?: number }) {
  const [cells] = useState(() => {
    const result: { v: number; delay: number }[] = []
    for (let d = 0; d < 5; d++) {
      for (let w = 0; w < weeks; w++) {
        const bias = (w / weeks) * 0.6 + Math.random() * 0.6
        const v = Math.min(1, bias)
        result.push({ v, delay: w * 14 + d * 20 })
      }
    }
    return result
  })

  return (
    <>
      <div className="heatmap">
        {cells.map((cell, i) => (
          <div key={i} className="hm-cell" style={{ '--v': cell.v.toFixed(2), animationDelay: `${cell.delay}ms` } as React.CSSProperties} />
        ))}
      </div>
      <div className="heatmap-foot">
        <span>Mo &ndash; Fr</span>
        <div className="hm-scale">
          <span>Weniger</span>
          <span className="hm-scale-cell" style={{ background: 'rgba(197,160,89,0.08)' }} />
          <span className="hm-scale-cell" style={{ background: 'rgba(197,160,89,0.3)' }} />
          <span className="hm-scale-cell" style={{ background: 'rgba(197,160,89,0.6)' }} />
          <span className="hm-scale-cell" style={{ background: 'rgba(197,160,89,0.9)', boxShadow: '0 0 6px rgba(197,160,89,0.5)' }} />
          <span>Mehr</span>
        </div>
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════

export default function Dashboard({ data }: { data: DashboardData }) {
  const [activeNav, setActiveNav] = useState('sales')
  const [period, setPeriod] = useState<Period>('week')

  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [expandedStatuses, setExpandedStatuses] = useState<Set<string>>(new Set())
  const [expandedLeadStatuses, setExpandedLeadStatuses] = useState<Set<string>>(new Set())

  const toggleMonth = (label: string) => {
    setExpandedMonths(prev => { const next = new Set(prev); next.has(label) ? next.delete(label) : next.add(label); return next })
  }
  const toggleStatus = (label: string) => {
    setExpandedStatuses(prev => { const next = new Set(prev); next.has(label) ? next.delete(label) : next.add(label); return next })
  }
  const toggleLeadStatus = (label: string) => {
    setExpandedLeadStatuses(prev => { const next = new Set(prev); next.has(label) ? next.delete(label) : next.add(label); return next })
  }

  // Period-filtered data
  const periodStart = period === 'today' ? data.todayISO
    : period === 'week' ? data.weekStartISO
    : period === 'month' ? data.monthStartISO
    : data.yearStartISO

  const filteredWon = (data.allWonDeals || []).filter(d => d.date >= periodStart)
  const filteredLost = (data.allLostDeals || []).filter(d => d.date >= periodStart)
  const periodRevenue = filteredWon.reduce((s, d) => s + d.value, 0)
  const periodLostValue = filteredLost.reduce((s, d) => s + d.value, 0)
  const periodClosedTotal = filteredWon.length + filteredLost.length
  const periodClosingRate = periodClosedTotal > 0 ? Math.round((filteredWon.length / periodClosedTotal) * 100) : 0

  // Call change
  const callChange = data.callsLastWeek > 0
    ? Math.round(((data.callsThisWeek - data.callsLastWeek) / data.callsLastWeek) * 100)
    : 0

  // Sparkline data (stable, generated once)
  const [sparkData] = useState(() => ({
    a: generateSeries(24, 5, 3, 0.12),
    b: generateSeries(24, 280, 30, 8),
    c: generateSeries(24, 22, 4, 0.5),
    d: generateSeries(24, 110, 14, 0.8),
    e: generateSeries(24, 3, 2, 0.5),
    f: generateSeries(24, 28, 4, 0.3),
    g: Array(24).fill(100) as number[],
    h: generateSeries(24, 60, 6, 0.5),
  }))

  // Panel glow effect
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const panel = (e.target as HTMLElement).closest('.za-panel')
    if (!panel) return
    const r = panel.getBoundingClientRect()
    ;(panel as HTMLElement).style.setProperty('--mx', (e.clientX - r.left) + 'px')
    ;(panel as HTMLElement).style.setProperty('--my', (e.clientY - r.top) + 'px')
  }, [])

  // KPI mapping from real data
  const pipelineK = Math.round(data.pipelineValue / 1000)
  const revenueMTDK = Math.round(data.revenueMTD / 1000)

  // Funnel from real data
  const funnelStages = [
    { name: 'Alle Opps', value: data.conversionFunnel.totalOpportunities, pct: '100%', color: 'linear-gradient(90deg,#775A19,#C5A059)' },
    { name: 'Setting', value: data.conversionFunnel.reachedSetting, pct: `${data.conversionFunnel.settingToClosingRate.toFixed(0)}%`, color: 'linear-gradient(90deg,#8BB6E8,#B49AE8)' },
    { name: 'Closing', value: data.conversionFunnel.reachedClosing, pct: `${data.conversionFunnel.closingToWonRate.toFixed(0)}%`, color: 'linear-gradient(90deg,#E9CB8B,#C5A059)' },
    { name: 'Won', value: data.conversionFunnel.wonCount, pct: `${data.conversionFunnel.overallConversionRate.toFixed(1)}%`, color: 'linear-gradient(90deg,#7FC29B,#4E8A6B)' },
  ]

  // Hot deals table (top 5 pipeline deals)
  const hotDeals = (data.pipelineDealsWithValue || []).slice(0, 5)

  // Get day name
  const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
  const today = new Date()
  const dayName = dayNames[today.getDay()]

  // Get greeting
  const hour = today.getHours()
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend'

  // Pipeline status helper
  function getDealStatusClass(status: string): string {
    const s = status.toLowerCase()
    if (s.includes('closing') || s.includes('hot')) return 'hot'
    if (s.includes('angebot') || s.includes('warm') || s.includes('setting')) return 'warm'
    if (s.includes('won') || s.includes('close (won)')) return 'won'
    return 'cold'
  }

  // Progress percentage for MTD
  const mtdProgress = data.daysInMonth > 0 ? Math.round((data.currentDay / data.daysInMonth) * 100) : 0

  // Empty state helper
  const EmptyState = ({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ marginBottom: '16px', opacity: 0.3, color: 'var(--za-gold)' }}>{icon}</div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--za-fg-2)', marginBottom: '6px' }}>{title}</div>
      <div style={{ fontSize: '12px', color: 'var(--za-fg-4)', maxWidth: '280px' }}>{subtitle}</div>
    </div>
  )

  return (
    <>
      {/* Aurora background */}
      <div className="aurora" aria-hidden="true"><div className="aurora-blob3" /></div>

      {/* SVG defs for chart glow */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id="chartGlowGlobal" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
      </svg>

      <div className="za-app" onMouseMove={handleMouseMove}>
        {/* ═══════ SIDEBAR ═══════ */}
        <aside className="za-sidebar">
          <div className="sb-brand">
            <span className="sb-mark">Z</span>
            <span className="sb-word">Zoepp Admin</span>
          </div>

          <div className="sb-section">
            <div className="sb-section-label">Dashboard</div>
            {NAV_DASHBOARD.map(item => (
              <a
                key={item.id}
                className={`sb-item ${activeNav === item.id ? 'is-active' : ''}`}
                onClick={() => setActiveNav(item.id)}
              >
                {item.icon}
                {item.label}
              </a>
            ))}
          </div>

          <div className="sb-user">
            <div className="sb-user-avatar">F</div>
            <div className="sb-user-meta">
              <div className="sb-user-name">Felix Zoepp</div>
              <div className="sb-user-role">Gesch&auml;ftsf&uuml;hrer</div>
            </div>
          </div>
        </aside>

        {/* ═══════ MAIN ═══════ */}
        <main className="za-main">
          {/* Topbar */}
          <div className="za-topbar fade-up">
            <div className="tb-title">
              <span className="tb-eyebrow">{dayName} &middot; KW {data.currentWeek}</span>
              <span className="tb-heading">{greeting}, Felix.</span>
            </div>
            <div className="tb-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--za-fg-4)' }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input placeholder="Suchen... (Lead, Kunde, Report)" />
            </div>
            <div className="tb-actions">
              <button className="tb-icon-btn" title="Benachrichtigungen">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 8a6 6 0 1112 0c0 7 3 7 3 9H3c0-2 3-2 3-9zM10 21a2 2 0 004 0" /></svg>
                <span className="dot" />
              </button>
              <button className="tb-icon-btn" title="Einstellungen">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>
              </button>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════
               TAB: SALES
             ═══════════════════════════════════════════════════ */}
          {activeNav === 'sales' && (
            <>
              {/* Period selector + export buttons row */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }} className="fade-up">
                <div className="view-switch">
                  {(['today', 'week', 'month', 'year'] as Period[]).map(p => (
                    <button key={p} className={period === p ? 'is-active' : ''} onClick={() => setPeriod(p)}>
                      {PERIOD_LABELS[p]}
                    </button>
                  ))}
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                  {[
                    { label: 'Tagesreport', period: 'daily' },
                    { label: 'Wochenreport', period: 'weekly' },
                    { label: 'Monatsreport', period: 'monthly' },
                  ].map(btn => (
                    <button key={btn.period} className="za-glass-btn" onClick={() => window.open(`/api/report?period=${btn.period}`, '_blank')}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* KPI tiles */}
              <div className="kpi-grid">
                <div className="za-panel fade-up" style={{ animationDelay: '60ms' }}>
                  <div className="kpi-top">
                    <span className="kpi-label"><span className="dotlive" />Won Deals &middot; {PERIOD_LABELS[period]}</span>
                    <span className="kpi-delta up">{fmtEuroK(periodRevenue)}</span>
                  </div>
                  <div className="kpi-value">{filteredWon.length}</div>
                  <div className="kpi-foot">
                    <span className="kpi-caption">{fmtEuro(periodRevenue)} Umsatz</span>
                    <SparklineChart data={sparkData.a} />
                  </div>
                </div>

                <div className="za-panel fade-up" style={{ animationDelay: '140ms' }}>
                  <div className="kpi-top">
                    <span className="kpi-label">Lost Deals</span>
                    <span className="kpi-delta down">{fmtEuroK(periodLostValue)}</span>
                  </div>
                  <div className="kpi-value" style={{ color: 'var(--za-danger)' }}>{filteredLost.length}</div>
                  <div className="kpi-foot">
                    <span className="kpi-caption">{fmtEuro(periodLostValue)} entgangen</span>
                    <SparklineChart data={sparkData.b} color="#E87467" />
                  </div>
                </div>

                <div className="za-panel fade-up" style={{ animationDelay: '220ms' }}>
                  <div className="kpi-top">
                    <span className="kpi-label">Closing Rate</span>
                    <span className={`kpi-delta ${periodClosingRate > 0 ? 'up' : 'down'}`}>
                      {periodClosingRate > 0 ? '\u2191' : '\u2193'} {periodClosingRate}%
                    </span>
                  </div>
                  <div className="kpi-value">{periodClosingRate}<span className="unit">%</span></div>
                  <div className="kpi-foot">
                    <span className="kpi-caption">{filteredWon.length} / {periodClosedTotal} Deals</span>
                    <SparklineChart data={sparkData.c} />
                  </div>
                </div>

                <div className="za-panel fade-up" style={{ animationDelay: '300ms' }}>
                  <div className="kpi-top">
                    <span className="kpi-label">Avg Deal</span>
                  </div>
                  <div className="kpi-value"><span className="kpi-unit-prefix">&euro;</span>{fmtNum(data.avgDealSize)}</div>
                  <div className="kpi-foot">
                    <span className="kpi-caption">&Oslash; Won Deal</span>
                    <SparklineChart data={sparkData.f} />
                  </div>
                </div>

                <div className="za-panel fade-up" style={{ animationDelay: '360ms' }}>
                  <div className="kpi-top">
                    <span className="kpi-label">Pipeline</span>
                    <span className="kpi-delta up">&uarr; {data.pipelineCount} Deals</span>
                  </div>
                  <div className="kpi-value"><span className="kpi-unit-prefix">&euro;</span>{pipelineK}<span className="unit">k</span></div>
                  <div className="kpi-foot">
                    <span className="kpi-caption">{data.pipelineCount} offene Deals</span>
                    <SparklineChart data={sparkData.d} />
                  </div>
                </div>

                <div className="za-panel fade-up" style={{ animationDelay: '420ms' }}>
                  <div className="kpi-top">
                    <span className="kpi-label">Leads gesamt</span>
                  </div>
                  <div className="kpi-value">{fmtNum(data.totalLeads)}</div>
                  <div className="kpi-foot">
                    <span className="kpi-caption">Leadpool: {fmtNum(data.leadpoolCount)}</span>
                    <SparklineChart data={sparkData.e} />
                  </div>
                </div>
              </div>

              {/* ═══ SALES FUNNEL — HERO ═══ */}
              {(() => {
                const funnelData = period === 'today' ? (data.salesFunnel as any).today || data.salesFunnel.week : period === 'week' ? data.salesFunnel.week : data.salesFunnel.month
                const periodNote = period === 'year' ? ' (Monatsdaten)' : ''
                const quoten = data.salesFunnel.quoten

                const stages = [
                  { label: 'Anwahlen', value: funnelData.anwahlen, rate: null, rateLabel: '' },
                  { label: 'Entscheider erreicht', value: funnelData.entscheiderErreicht, rate: quoten.erreichquote, rateLabel: 'Erreichquote', sub: `(${funnelData.coldCalls} Cold Calls + ${funnelData.followUps} Follow-Ups)` },
                  { label: 'Settings gelegt', value: funnelData.settingsGelegt, rate: quoten.settingQuote, rateLabel: 'Setting-Quote', sub: `(${data.calendlyMetrics.weekSettings} Calendly Settings diese Woche)` },
                  { label: 'Beratungsgespr\u00e4che (Closings)', value: funnelData.closingsGelegt, rate: quoten.closingQuote, rateLabel: 'Closing-Quote', sub: `(${data.calendlyMetrics.weekClosings} Calendly Closings diese Woche)` },
                  { label: 'Abschl\u00fcsse (Won)', value: funnelData.wonDeals, rate: quoten.abschlussQuote, rateLabel: 'Abschlussquote', revenue: funnelData.wonRevenue },
                ]
                const maxVal = Math.max(...stages.map(s => s.value), 1)

                return (
                  <div className="za-panel fade-up" style={{ animationDelay: '480ms', marginBottom: '16px', borderTop: '2px solid var(--za-gold)', padding: '24px' }}>
                    <div className="panel-head" style={{ marginBottom: '20px' }}>
                      <div>
                        <span className="panel-eyebrow" style={{ color: 'var(--za-gold-2)' }}>Sales Funnel</span>
                        <div className="panel-title" style={{ fontSize: '18px' }}>
                          Sales Funnel &mdash; {PERIOD_LABELS[period]}{periodNote}
                        </div>
                      </div>
                      <span className="panel-sub" style={{ fontFamily: 'var(--za-serif)', fontSize: '14px', color: 'var(--za-gold-2)' }}>
                        Gesamt: {quoten.overallAnwahlenToWon}% Conversion
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                      {stages.map((stage, i) => {
                        const widthPct = Math.max((stage.value / maxVal) * 100, 2)
                        const showRate = stage.rate !== null && stage.rate !== undefined && i > 0
                        return (
                          <div key={i}>
                            {/* Conversion rate arrow between stages */}
                            {showRate && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '4px 0 4px 160px',
                                gap: '8px',
                              }}>
                                <span style={{ color: 'var(--za-gold)', fontSize: '14px', lineHeight: 1 }}>{'\u2193'}</span>
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  color: 'var(--za-gold-2)',
                                  background: 'rgba(197,160,89,0.1)',
                                  padding: '2px 10px',
                                  borderRadius: '10px',
                                  border: '1px solid rgba(197,160,89,0.2)',
                                }}>
                                  {stage.rate}% {stage.rateLabel}
                                </span>
                              </div>
                            )}
                            {!showRate && i > 0 && (
                              <div style={{ padding: '3px 0' }} />
                            )}

                            {/* Stage row */}
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: '160px 1fr 70px 80px',
                              alignItems: 'center',
                              gap: '12px',
                            }}>
                              <div style={{
                                textAlign: 'right',
                                paddingRight: '4px',
                              }}>
                                <div style={{
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: i === stages.length - 1 ? 'var(--za-success)' : 'var(--za-fg-2)',
                                }}>
                                  {stage.label}
                                </div>
                                {(stage as any).sub && (
                                  <div style={{ fontSize: '9px', color: 'var(--za-fg-4)', marginTop: '1px' }}>{(stage as any).sub}</div>
                                )}
                              </div>
                              <div style={{
                                height: '28px',
                                background: 'rgba(249,249,249,0.04)',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                position: 'relative',
                              }}>
                                <div style={{
                                  width: `${widthPct}%`,
                                  height: '100%',
                                  background: i === stages.length - 1
                                    ? 'linear-gradient(90deg, #4E8A6B, #7FC29B)'
                                    : 'linear-gradient(90deg, #775A19, #C5A059, #E9CB8B)',
                                  borderRadius: '6px',
                                  transition: 'width 0.8s ease',
                                  boxShadow: i === stages.length - 1
                                    ? '0 0 12px rgba(127,194,155,0.3)'
                                    : '0 0 12px rgba(197,160,89,0.2)',
                                }} />
                              </div>
                              <div style={{
                                fontFamily: 'var(--za-serif)',
                                fontSize: '16px',
                                fontWeight: 700,
                                color: i === stages.length - 1 ? 'var(--za-success)' : '#fff',
                                textAlign: 'right',
                              }}>
                                {fmtNum(stage.value)}
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: 'var(--za-fg-4)',
                                textAlign: 'right',
                              }}>
                                {i === 0 ? '100%' : stage.revenue !== undefined ? fmtEuro(stage.revenue) : `${maxVal > 0 ? ((stage.value / maxVal) * 100).toFixed(0) : 0}%`}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* ═══ CALENDLY TERMINE ═══ */}
              {data.calendlyMetrics.weekEvents.length > 0 && (
                <div className="za-panel fade-up" style={{ animationDelay: '500ms', marginBottom: '16px', borderTop: '2px solid var(--za-info)', padding: '24px' }}>
                  <div className="panel-head" style={{ marginBottom: '16px' }}>
                    <div>
                      <span className="panel-eyebrow" style={{ color: 'var(--za-info)' }}>Calendly</span>
                      <div className="panel-title" style={{ fontSize: '18px' }}>
                        Termine diese Woche &mdash; Calendly
                      </div>
                    </div>
                    <span className="panel-sub" style={{ fontFamily: 'var(--za-serif)', fontSize: '13px', color: 'var(--za-fg-3)' }}>
                      {data.calendlyMetrics.weekSettings} Settings | {data.calendlyMetrics.weekClosings} Closings | {data.calendlyMetrics.weekOnboardings} Onboardings diese Woche
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {data.calendlyMetrics.weekEvents.map((evt, i) => {
                      const dt = new Date(evt.startTime)
                      const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
                      const dayName = dayNames[dt.getDay()]
                      const dd = String(dt.getDate()).padStart(2, '0')
                      const mm = String(dt.getMonth() + 1).padStart(2, '0')
                      const hh = String(dt.getHours()).padStart(2, '0')
                      const min = String(dt.getMinutes()).padStart(2, '0')
                      const timeStr = `${dayName} ${dd}.${mm} \u00b7 ${hh}:${min}`

                      const badgeColors: Record<string, { bg: string; fg: string }> = {
                        setting: { bg: 'rgba(59,130,246,0.15)', fg: 'var(--za-info)' },
                        closing: { bg: 'rgba(197,160,89,0.15)', fg: 'var(--za-gold-2)' },
                        onboarding: { bg: 'rgba(78,138,107,0.15)', fg: 'var(--za-success)' },
                        other: { bg: 'rgba(249,249,249,0.06)', fg: 'var(--za-fg-4)' },
                      }
                      const badge = badgeColors[evt.category] || badgeColors.other
                      const categoryLabel = evt.category === 'setting' ? 'Setting' : evt.category === 'closing' ? 'Closing' : evt.category === 'onboarding' ? 'Onboarding' : 'Sonstige'

                      const locationIcon = evt.location.includes('Zoom') || evt.location.includes('zoom')
                        ? '\ud83d\udcf9'
                        : evt.location.includes('Call') || evt.location.includes('call') || evt.location.includes('Outbound')
                          ? '\ud83d\udcde'
                          : evt.location.includes('Vor Ort')
                            ? '\ud83d\udccd'
                            : '\ud83d\udcc5'

                      return (
                        <div key={i} style={{
                          display: 'grid',
                          gridTemplateColumns: '130px 1fr auto auto',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 12px',
                          background: 'rgba(249,249,249,0.03)',
                          borderRadius: '8px',
                          borderLeft: `3px solid ${badge.fg}`,
                        }}>
                          <div style={{ fontSize: '12px', color: 'var(--za-fg-3)', fontFamily: 'var(--za-mono, monospace)', whiteSpace: 'nowrap' }}>
                            {timeStr}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--za-fg-2)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {evt.name}
                          </div>
                          <div style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            padding: '3px 10px',
                            borderRadius: '10px',
                            background: badge.bg,
                            color: badge.fg,
                            whiteSpace: 'nowrap',
                          }}>
                            {categoryLabel}
                          </div>
                          <div style={{ fontSize: '14px', textAlign: 'center', width: '24px' }} title={evt.location}>
                            {locationIcon}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Pipeline Snapshot */}
              <div className="za-panel fade-up" style={{ animationDelay: '520ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Pipeline Snapshot</span>
                    <div className="panel-title">Aktuelle Verteilung</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {[
                    { label: 'Setting Terminiert', value: data.salesFunnel.pipeline.settingTerminiert, color: 'var(--za-info)' },
                    { label: 'Setting No Show', value: data.salesFunnel.pipeline.settingNoShow, color: 'var(--za-danger)' },
                    { label: 'Setting Follow Up', value: data.salesFunnel.pipeline.settingFollowUp, color: 'var(--za-gold-2)' },
                    { label: 'Closing Terminiert', value: data.salesFunnel.pipeline.closingTerminiert, color: 'var(--za-violet)' },
                    { label: 'Closing No Show', value: data.salesFunnel.pipeline.closingNoShow, color: 'var(--za-danger)' },
                    { label: 'Closing Follow Up', value: data.salesFunnel.pipeline.closingFollowUp, color: 'var(--za-gold-2)' },
                    { label: 'Angebot verschickt', value: data.salesFunnel.pipeline.angebotVerschickt, color: 'var(--za-success)' },
                    { label: 'CC2 Terminiert', value: data.salesFunnel.pipeline.cc2Terminiert, color: 'var(--za-info)' },
                  ].map((item, i) => (
                    <div key={i} style={{
                      padding: '12px',
                      background: 'rgba(249,249,249,0.03)',
                      borderRadius: '8px',
                      borderLeft: `3px solid ${item.color}`,
                    }}>
                      <div style={{ fontSize: '10px', color: 'var(--za-fg-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                        {item.label}
                      </div>
                      <div style={{ fontFamily: 'var(--za-serif)', fontSize: '20px', fontWeight: 700, color: '#fff' }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Waterfall KPIs */}
              <div className="kpi-grid">
                <div className="za-panel fade-up" style={{ animationDelay: '560ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Settings pro Close</span></div>
                  <div className="kpi-value">{data.waterfall.settingsPerClose}</div>
                  <div className="kpi-foot"><span className="kpi-caption">Settings f&uuml;r 1 Won</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '600ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Closings pro Close</span></div>
                  <div className="kpi-value">{data.waterfall.closingsPerClose}</div>
                  <div className="kpi-foot"><span className="kpi-caption">Closings f&uuml;r 1 Won</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '640ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Gesamt Conversion</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-success)' }}>{data.conversionFunnel.overallConversionRate.toFixed(1)}<span className="unit">%</span></div>
                  <div className="kpi-foot"><span className="kpi-caption">Alle Opps zu Won</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '680ms' }}>
                  <div className="kpi-top"><span className="kpi-label">&Oslash; Deal Cycle</span></div>
                  <div className="kpi-value">{data.waterfall.avgDealCycle}<span className="unit"> Tage</span></div>
                  <div className="kpi-foot"><span className="kpi-caption">Erstellung bis Won</span></div>
                </div>
              </div>

              {/* Weekly call trend */}
              <div className="za-panel fade-up" style={{ animationDelay: '700ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Wochenvergleich</span>
                    <div className="panel-title">Calls pro Woche</div>
                  </div>
                  <span className="panel-sub">KW {data.currentWeek}: {data.callsThisWeek} Calls ({callChange >= 0 ? '+' : ''}{callChange}% vs. Vorwoche)</span>
                </div>
                <BarChart data={data.weeklyCallData.map(w => w.calls)} labels={data.weeklyCallData.map(w => w.week)} />
              </div>

              {/* Won Deals list */}
              <div className="za-panel fade-up" style={{ animationDelay: '740ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Won Deals &middot; {PERIOD_LABELS[period]}</span>
                    <div className="panel-title">{filteredWon.length} Deals &middot; {fmtEuro(periodRevenue)}</div>
                  </div>
                </div>
                {filteredWon.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--za-fg-3)', fontSize: '12px' }}>
                    Keine Won Deals im ausgew&auml;hlten Zeitraum
                  </div>
                )}
                {filteredWon.map((deal, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < filteredWon.length - 1 ? '1px solid var(--za-border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="t-co-mark">{deal.name.charAt(0)}</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{deal.name}</div>
                        <div style={{ fontSize: '10px', color: 'var(--za-fg-3)' }}>{fmtDate(deal.date)} &middot; {deal.user}</div>
                      </div>
                    </div>
                    <span className="t-status won">{fmtEuro(deal.value)}</span>
                  </div>
                ))}
              </div>

              {/* Active Pipeline drill-down */}
              <div className="za-panel fade-up" style={{ animationDelay: '780ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Active Pipeline</span>
                    <div className="panel-title">{data.pipelineCount} Deals &middot; {fmtEuro(data.pipelineValue)}</div>
                  </div>
                </div>
                {data.pipelineSorted.map((p, i) => {
                  const isExpanded = expandedStatuses.has(p.label)
                  const statusDeals = data.pipelineDealsByStatus?.[p.label] || []
                  return (
                    <div key={i}>
                      <div className="za-drilldown-item" onClick={() => toggleStatus(p.label)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`za-drilldown-arrow ${isExpanded ? 'expanded' : ''}`}>{'\u25B6'}</span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{p.count} {p.count === 1 ? 'Deal' : 'Deals'}</div>
                            <div style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>{p.label}</div>
                          </div>
                        </div>
                        <span style={{ fontFamily: 'var(--za-serif)', fontSize: '14px', fontWeight: 600, color: 'var(--za-gold-2)' }}>{fmtEuro(p.value)}</span>
                      </div>
                      {isExpanded && statusDeals.length > 0 && (
                        <div className="za-drilldown-children">
                          {statusDeals.map((deal, j) => (
                            <div key={j} className="za-drilldown-child">
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ color: 'var(--za-gold)', fontSize: '8px' }}>{'\u25CF'}</span>
                                <span>{deal.leadName}</span>
                              </div>
                              <span style={{ fontWeight: 600, color: deal.value > 0 ? 'var(--za-info)' : 'var(--za-fg-3)' }}>
                                {deal.value > 0 ? fmtEuro(deal.value) : '\u2014'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Pipeline Deals table */}
              <div className="za-panel fade-up" style={{ animationDelay: '820ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Hot Deals</span>
                    <div className="panel-title">Pipeline Deals</div>
                  </div>
                </div>
                <div className="za-table-wrap">
                  <table className="za-table">
                    <thead><tr><th>Unternehmen</th><th>Wert</th><th>Status</th></tr></thead>
                    <tbody>
                      {hotDeals.map((deal, i) => (
                        <tr key={i}>
                          <td>
                            <div className="t-co">
                              <span className="t-co-mark">{deal.leadName.charAt(0)}</span>
                              <span className="t-co-name">{deal.leadName}</span>
                            </div>
                          </td>
                          <td>{fmtEuro(deal.value)}</td>
                          <td><span className={`t-status ${getDealStatusClass(deal.status)}`}>{deal.status}</span></td>
                        </tr>
                      ))}
                      {hotDeals.length === 0 && (
                        <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--za-fg-3)', padding: '20px' }}>Keine Deals mit Wert</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Lead Status drill-down */}
              <div className="za-panel fade-up" style={{ animationDelay: '860ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Lead Status</span>
                    <div className="panel-title">Verteilung &middot; klicken f&uuml;r Details</div>
                  </div>
                </div>
                {data.leadStatusCounts.map((s, i) => {
                  const isExpanded = expandedLeadStatuses.has(s.label)
                  const colors: Record<string, string> = {
                    'accent-blue': 'var(--za-info)',
                    'accent-green': 'var(--za-success)',
                    'accent-red': 'var(--za-danger)',
                    'accent-yellow': 'var(--za-gold-2)',
                    'accent-purple': 'var(--za-violet)',
                    'accent-orange': '#fb923c',
                    'text-muted': 'var(--za-fg-3)',
                  }
                  const dotColor = colors[s.color] || 'var(--za-fg-3)'
                  return (
                    <div key={i}>
                      <div
                        className="za-drilldown-item"
                        onClick={() => s.count > 0 ? toggleLeadStatus(s.label) : undefined}
                        style={{ cursor: s.count > 0 ? 'pointer' : 'default' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {s.count > 0 && <span className={`za-drilldown-arrow ${isExpanded ? 'expanded' : ''}`}>{'\u25B6'}</span>}
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                          <span style={{ fontSize: '13px' }}>{s.label}</span>
                        </div>
                        <span style={{ fontFamily: 'var(--za-serif)', fontSize: '14px', fontWeight: 600 }}>{fmtNum(s.count)}</span>
                      </div>
                      {isExpanded && s.leads && s.leads.length > 0 && (
                        <div className="za-drilldown-children">
                          {s.leads.map((lead, j) => (
                            <div key={j} className="za-drilldown-child">
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span style={{ color: dotColor, fontSize: '8px' }}>{'\u25CF'}</span>
                                <span>{lead.name}</span>
                              </div>
                              {lead.date && <span style={{ color: 'var(--za-fg-4)', fontSize: '11px' }}>{fmtDate(lead.date.split('T')[0])}</span>}
                            </div>
                          ))}
                          {s.count > s.leads.length && (
                            <div style={{ fontSize: '11px', color: 'var(--za-fg-4)', paddingTop: '6px', fontStyle: 'italic' }}>
                              + {fmtNum(s.count - s.leads.length)} weitere Leads
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Month-to-Date card */}
              <div className="za-panel fade-up" style={{ animationDelay: '900ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Month-to-Date</span>
                    <div className="panel-title">{data.currentMonthName} {data.currentYear} &middot; Tag {data.currentDay}/{data.daysInMonth}</div>
                  </div>
                </div>
                <div style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--za-fg-2)' }}>Umsatz MTD</span>
                    <span style={{ fontFamily: 'var(--za-serif)', fontSize: '18px', fontWeight: 700, color: 'var(--za-success)' }}>{fmtEuro(data.revenueMTD)}</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(249,249,249,0.06)', overflow: 'hidden', marginBottom: '12px' }}>
                    <div style={{ height: '100%', borderRadius: '3px', background: 'linear-gradient(90deg, var(--za-gold), var(--za-success))', width: `${mtdProgress}%`, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--za-fg-4)' }}>
                    <span>{mtdProgress}% des Monats</span>
                    <span>Forecast: {fmtEuro(data.linearForecast)}</span>
                  </div>
                </div>
              </div>

              {/* Historical Performance drill-down */}
              <div className="za-panel fade-up" style={{ animationDelay: '940ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Historische Performance</span>
                    <div className="panel-title">Won Revenue pro Monat</div>
                  </div>
                </div>
                {data.historicalPerformance.map((h, i) => {
                  const isExpanded = expandedMonths.has(h.label)
                  return (
                    <div key={i}>
                      <div className="za-drilldown-item" onClick={() => toggleMonth(h.label)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`za-drilldown-arrow ${isExpanded ? 'expanded' : ''}`}>{'\u25B6'}</span>
                          <span style={{ fontSize: '13px' }}>
                            {h.label}{h.isCurrent ? ' (MTD)' : ''}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--za-fg-4)' }}>({h.deals?.length || 0} Deals)</span>
                        </div>
                        <span style={{ fontFamily: 'var(--za-serif)', fontSize: '14px', fontWeight: 700, color: h.isCurrent ? 'var(--za-success)' : '#fff' }}>{fmtEuro(h.value)}</span>
                      </div>
                      {isExpanded && h.deals && h.deals.length > 0 && (
                        <div className="za-drilldown-children">
                          {h.deals.map((deal, j) => (
                            <div key={j} className="za-drilldown-child">
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ color: 'var(--za-success)', fontSize: '8px' }}>{'\u25CF'}</span>
                                <span>{deal.name}</span>
                                <span style={{ color: 'var(--za-fg-4)', fontSize: '11px' }}>{fmtDate(deal.date)}</span>
                              </div>
                              <span style={{ fontWeight: 600, color: 'var(--za-success)' }}>{fmtEuro(deal.value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Overall stats */}
              <div className="kpi-grid" style={{ marginTop: '8px' }}>
                <div className="za-panel fade-up" style={{ animationDelay: '980ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Won (gesamt)</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-success)' }}>{data.wonTotal}</div>
                  <div className="kpi-foot"><span className="kpi-caption">{fmtEuro(data.totalRevenue)} Umsatz</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '1020ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Lost (gesamt)</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-danger)' }}>{data.lostCount}</div>
                  <div className="kpi-foot"><span className="kpi-caption">{fmtEuro(data.totalLostValue)} entgangen</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '1060ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Kunden</span></div>
                  <div className="kpi-value">{data.kundenCount}</div>
                  <div className="kpi-foot"><span className="kpi-caption">Active Customers</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '1100ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Calls (8W)</span></div>
                  <div className="kpi-value">{fmtNum(data.totalCalls8W)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">Letzte 8 Wochen</span></div>
                </div>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════
               TAB: FULFILLMENT
             ═══════════════════════════════════════════════════ */}
          {activeNav === 'fulfillment' && (
            <>
              <div className="kpi-grid">
                <div className="za-panel fade-up" style={{ animationDelay: '60ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Heute erledigt</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-fg-3)' }}>&mdash;</div>
                  <div className="kpi-foot"><span className="kpi-caption">Aufgaben</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '140ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Woche gesamt</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-fg-3)' }}>&mdash;</div>
                  <div className="kpi-foot"><span className="kpi-caption">Aufgaben</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '220ms' }}>
                  <div className="kpi-top"><span className="kpi-label">&Oslash; pro Tag</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-fg-3)' }}>&mdash;</div>
                  <div className="kpi-foot"><span className="kpi-caption">Durchschnitt</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '300ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Offen</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-fg-3)' }}>&mdash;</div>
                  <div className="kpi-foot"><span className="kpi-caption">Ausstehend</span></div>
                </div>
              </div>

              <div className="za-panel fade-up" style={{ animationDelay: '360ms' }}>
                <EmptyState
                  icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>}
                  title="Fulfillment-Daten werden bald angebunden"
                  subtitle="Tagesproduktivit&auml;t, Aufgaben, Wochenziele"
                />
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════
               TAB: MARKETING
             ═══════════════════════════════════════════════════ */}
          {activeNav === 'marketing' && (
            <>
              <div className="kpi-grid">
                <div className="za-panel fade-up" style={{ animationDelay: '60ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Posts KW</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-fg-3)' }}>&mdash;</div>
                  <div className="kpi-foot"><span className="kpi-caption">Diese Woche</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '140ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Impressions</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-fg-3)' }}>&mdash;</div>
                  <div className="kpi-foot"><span className="kpi-caption">Reichweite</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '220ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Engagement</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-fg-3)' }}>&mdash;</div>
                  <div className="kpi-foot"><span className="kpi-caption">Interaktionen</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '300ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Leads</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-fg-3)' }}>&mdash;</div>
                  <div className="kpi-foot"><span className="kpi-caption">via Marketing</span></div>
                </div>
              </div>

              {/* Platform cards */}
              <div className="row-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                {[
                  { name: 'LinkedIn', stats: ['Follower: \u2014', 'Posts/W: \u2014', 'Engagement: \u2014'] },
                  { name: 'Instagram', stats: ['Follower: \u2014', 'Posts/W: \u2014', 'Reach: \u2014'] },
                  { name: 'YouTube', stats: ['Subscriber: \u2014', 'Videos: \u2014', 'Views: \u2014'] },
                ].map((platform, i) => (
                  <div key={i} className="za-panel fade-up" style={{ animationDelay: `${360 + i * 60}ms` }}>
                    <div className="panel-head">
                      <div>
                        <div className="panel-title">{platform.name}</div>
                      </div>
                    </div>
                    <div style={{ padding: '4px 0' }}>
                      {platform.stats.map((stat, j) => (
                        <div key={j} style={{ fontSize: '12px', color: 'var(--za-fg-3)', padding: '4px 0', borderBottom: j < platform.stats.length - 1 ? '1px solid var(--za-border)' : 'none' }}>
                          {stat}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Empty states */}
              {['Perspective Funnels', 'CopeCart', 'OnePage'].map((name, i) => (
                <div key={i} className="za-panel fade-up" style={{ animationDelay: `${540 + i * 60}ms`, marginBottom: '16px' }}>
                  <EmptyState
                    icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>}
                    title={`${name} \u2014 Daten werden bald angebunden`}
                    subtitle="Integration in Vorbereitung"
                  />
                </div>
              ))}
            </>
          )}

          {/* ═══════════════════════════════════════════════════
               TAB: FINANZEN
             ═══════════════════════════════════════════════════ */}
          {activeNav === 'finanzen' && (
            <>
              <div className="kpi-grid">
                <div className="za-panel fade-up" style={{ animationDelay: '60ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Umsatz MTD</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-success)' }}>{fmtEuro(data.revenueMTD)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">{data.currentMonthName} {data.currentYear}</span><SparklineChart data={sparkData.d} color="#7FC29B" /></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '140ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Umsatz gesamt</span></div>
                  <div className="kpi-value">{fmtEuro(data.totalRevenue)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">Close CRM</span><SparklineChart data={sparkData.h} /></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '220ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Offene RG</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-fg-3)' }}>&mdash;</div>
                  <div className="kpi-foot"><span className="kpi-caption">Easybill</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '300ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Kontostand</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-fg-3)' }}>&mdash;</div>
                  <div className="kpi-foot"><span className="kpi-caption">Qonto</span></div>
                </div>
              </div>

              {/* Monthly revenue chart */}
              <div className="za-panel fade-up" style={{ animationDelay: '360ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Historisch</span>
                    <div className="panel-title">Won Revenue pro Monat</div>
                  </div>
                </div>
                <BarChart
                  data={data.monthlyChartData.map(m => m.value)}
                  labels={data.monthlyChartData.map(m => m.label)}
                />
              </div>

              {/* Forecast panel */}
              <div className="za-panel fade-up" style={{ animationDelay: '420ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Forecast</span>
                    <div className="panel-title">Umsatzprognose &middot; {data.currentMonthName} {data.currentYear}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--za-fg-3)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '6px' }}>MTD</div>
                    <div style={{ fontFamily: 'var(--za-serif)', fontSize: '24px', color: 'var(--za-success)' }}>{fmtEuro(data.revenueMTD)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--za-fg-3)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '6px' }}>Forecast Linear</div>
                    <div style={{ fontFamily: 'var(--za-serif)', fontSize: '24px', color: 'var(--za-info)' }}>{fmtEuro(data.linearForecast)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--za-fg-3)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '6px' }}>+ Pipeline</div>
                    <div style={{ fontFamily: 'var(--za-serif)', fontSize: '24px', color: 'var(--za-gold-2)' }}>{fmtEuro(data.pipelineWeightedForecast)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--za-fg-3)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '6px' }}>&Oslash; 3 Monate</div>
                    <div style={{ fontFamily: 'var(--za-serif)', fontSize: '24px', color: '#fff' }}>{fmtEuro(data.avg3Months)}</div>
                  </div>
                </div>
              </div>

              {/* Empty states for Easybill and Qonto */}
              <div className="row-grid row-2">
                <div className="za-panel fade-up" style={{ animationDelay: '480ms' }}>
                  <EmptyState
                    icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/></svg>}
                    title="Easybill &mdash; Rechnungsdaten"
                    subtitle="Integration in Vorbereitung. Offene und bezahlte Rechnungen werden hier angezeigt."
                  />
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '540ms' }}>
                  <EmptyState
                    icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2.5 0 00-2.5-1h-1a2 2 0 000 4h2a2 2 0 010 4h-1a2.5 2.5 0 01-2.5-1M12 5.5v1M12 17.5v1"/></svg>}
                    title="Qonto &mdash; Bankdaten"
                    subtitle="Integration in Vorbereitung. Kontostand und Transaktionen werden hier angezeigt."
                  />
                </div>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════
               TAB: KUNDEN
             ═══════════════════════════════════════════════════ */}
          {activeNav === 'kunden' && (
            <>
              {/* KPI Grid Row 1 — gold accent */}
              <div className="kpi-grid">
                <div className="za-panel fade-up" style={{ animationDelay: '60ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">MRR</span></div>
                  <div className="kpi-value"><span className="kpi-unit-prefix">&euro;</span>{fmtNum(data.airtableMetrics.mrr)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">Monthly Recurring Revenue</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '140ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">ARR</span></div>
                  <div className="kpi-value"><span className="kpi-unit-prefix">&euro;</span>{fmtNum(data.airtableMetrics.arr)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">Annual Run Rate</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '220ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">Churn Rate</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-danger)' }}>{data.airtableMetrics.churnRate}<span className="unit">%</span></div>
                  <div className="kpi-foot"><span className="kpi-caption">{data.airtableMetrics.churned} von {data.airtableMetrics.totalCustomers} Kunden gek&uuml;ndigt</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '300ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">LTV</span></div>
                  <div className="kpi-value"><span className="kpi-unit-prefix">&euro;</span>{fmtNum(data.airtableMetrics.ltv)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">&Oslash; Customer Lifetime Value</span></div>
                </div>
              </div>

              {/* KPI Grid Row 2 */}
              <div className="kpi-grid">
                <div className="za-panel fade-up" style={{ animationDelay: '360ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Aktive Kunden</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-success)' }}>{data.airtableMetrics.activeCustomers}</div>
                  <div className="kpi-foot"><span className="kpi-caption">von {data.airtableMetrics.totalCustomers} gesamt</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '420ms' }}>
                  <div className="kpi-top"><span className="kpi-label">ARPU</span></div>
                  <div className="kpi-value"><span className="kpi-unit-prefix">&euro;</span>{fmtNum(data.airtableMetrics.arpu)}<span className="unit">/Mo</span></div>
                  <div className="kpi-foot"><span className="kpi-caption">Avg Revenue Per User</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '480ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Upsells</span></div>
                  <div className="kpi-value">{data.airtableMetrics.upsellCount}</div>
                  <div className="kpi-foot"><span className="kpi-caption">{data.airtableMetrics.upsellRate}% Upsell Rate</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '540ms' }}>
                  <div className="kpi-top"><span className="kpi-label">&Oslash; Laufzeit</span></div>
                  <div className="kpi-value">{data.airtableMetrics.avgContractLength}<span className="unit"> Monate</span></div>
                  <div className="kpi-foot"><span className="kpi-caption">Vertragslaufzeit</span></div>
                </div>
              </div>

              {/* MRR nach Produkt */}
              <div className="za-panel fade-up" style={{ animationDelay: '600ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">MRR nach Produkt</span>
                    <div className="panel-title">&euro;{fmtNum(data.airtableMetrics.mrr)}/Mo Recurring Revenue</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.airtableMetrics.productMix.filter(p => p.mrr > 0).map((p, i) => {
                    const maxMrr = Math.max(...data.airtableMetrics.productMix.map(x => x.mrr))
                    const pct = maxMrr > 0 ? (p.mrr / maxMrr) * 100 : 0
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '160px', flexShrink: 0, fontSize: '12px', fontWeight: 600, color: 'var(--za-fg-2)' }}>{p.product}</div>
                        <div style={{ flex: 1, height: '24px', background: 'rgba(249,249,249,0.04)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--za-gold), var(--za-gold-2))', borderRadius: '6px', transition: 'width 0.8s ease' }} />
                        </div>
                        <div style={{ width: '100px', textAlign: 'right', fontFamily: 'var(--za-serif)', fontSize: '13px', fontWeight: 700, color: 'var(--za-gold-2)' }}>&euro;{fmtNum(p.mrr)}/Mo</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Aktive Kunden Table */}
              <div className="za-panel fade-up" style={{ animationDelay: '660ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Aktive Kunden</span>
                    <div className="panel-title">{data.airtableMetrics.activeCustomers} aktive Vertr&auml;ge</div>
                  </div>
                </div>
                <div className="za-table-wrap">
                  <table className="za-table">
                    <thead>
                      <tr>
                        <th>Kunde</th>
                        <th>Produkt</th>
                        <th>Rate/Mo</th>
                        <th>Laufzeit</th>
                        <th>Endet am</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.airtableMetrics.activeList].sort((a, b) => b.monatlicheRate - a.monatlicheRate).map((c, i) => {
                        const name = c.dealName.replace(/^CL-\d+\s*[-–]\s*/, '').replace(/\s*[-–]\s*.*$/, '') || c.dealName
                        return (
                          <tr key={i}>
                            <td>
                              <div className="t-co">
                                <span className="t-co-mark">{name.charAt(0)}</span>
                                <span className="t-co-name">{name}</span>
                              </div>
                            </td>
                            <td><span style={{ fontSize: '12px', color: 'var(--za-fg-2)' }}>{c.produkt}</span></td>
                            <td style={{ fontFamily: 'var(--za-serif)', fontWeight: 600 }}>&euro;{fmtNum(c.monatlicheRate)}</td>
                            <td>{c.vertragslaufzeit ? `${c.vertragslaufzeit} Mo` : '\u2013'}</td>
                            <td style={{ fontSize: '12px', color: 'var(--za-fg-3)' }}>{c.vertragsende ? fmtDate(c.vertragsende) : '\u2013'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Churn Analyse */}
              <div className="za-panel fade-up" style={{ animationDelay: '720ms', marginBottom: '16px', borderLeft: '3px solid var(--za-danger)' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow" style={{ color: 'var(--za-danger)' }}>Churn Analyse</span>
                    <div className="panel-title">{data.airtableMetrics.churned} K&uuml;ndigungen</div>
                  </div>
                </div>
                <div className="za-table-wrap">
                  <table className="za-table">
                    <thead>
                      <tr>
                        <th>Kunde</th>
                        <th>Produkt</th>
                        <th>Grund</th>
                        <th>Volumen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.airtableMetrics.churnedList.map((c, i) => {
                        const name = c.dealName.replace(/^CL-\d+\s*[-–]\s*/, '').replace(/\s*[-–]\s*.*$/, '') || c.dealName
                        const reasonColors: Record<string, string> = {
                          'Umsetzung fehlte': '#f59e0b',
                          'Zeitmangel': '#eab308',
                          'Keine Ergebnisse': '#ef4444',
                          'Vertriebsprobleme': '#f97316',
                          'Todesfall': '#6b7280',
                          'Ausgelaufen / happy': '#22c55e',
                          'Nicht gepasst zu ihm': '#a78bfa',
                        }
                        const reasonColor = reasonColors[c.kuendigungsgrund] || 'var(--za-fg-3)'
                        return (
                          <tr key={i}>
                            <td>
                              <div className="t-co">
                                <span className="t-co-mark">{name.charAt(0)}</span>
                                <span className="t-co-name">{name}</span>
                              </div>
                            </td>
                            <td><span style={{ fontSize: '12px', color: 'var(--za-fg-2)' }}>{c.produkt}</span></td>
                            <td><span style={{ fontSize: '12px', fontWeight: 600, color: reasonColor, padding: '2px 8px', borderRadius: '4px', background: `${reasonColor}15` }}>{c.kuendigungsgrund || 'Unbekannt'}</span></td>
                            <td style={{ fontFamily: 'var(--za-serif)', fontWeight: 600 }}>{c.vertragssumme > 0 ? fmtEuro(c.vertragssumme) : '\u2013'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Upsell Champions */}
              <div className="za-panel fade-up" style={{ animationDelay: '780ms', marginBottom: '16px', borderTop: '2px solid var(--za-gold)' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow" style={{ color: 'var(--za-gold-2)' }}>Upsell Champions</span>
                    <div className="panel-title">{data.airtableMetrics.upsellCount} Upsells</div>
                  </div>
                </div>
                {data.airtableMetrics.upsellList.map((c, i) => {
                  const name = c.dealName.replace(/^CL-\d+\s*[-–]\s*/, '').replace(/\s*[-–]\s*.*$/, '') || c.dealName
                  return (
                    <div key={i} className="za-panel" style={{ margin: '8px 0', padding: '12px 16px', background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.12)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="t-co-mark" style={{ background: 'linear-gradient(135deg, var(--za-gold), var(--za-gold-2))' }}>{name.charAt(0)}</span>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--za-fg-3)' }}>{c.produkt}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'var(--za-serif)', fontSize: '16px', fontWeight: 700, color: 'var(--za-gold-2)' }}>{fmtEuro(c.vertragssumme)}</div>
                          <div style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>Upsell am {fmtDate(c.upsellDatum)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════
               TAB: RECRUITING
             ═══════════════════════════════════════════════════ */}
          {activeNav === 'recruiting' && (
            <>
              {/* KPI Row 1 */}
              <div className="kpi-grid">
                <div className="za-panel fade-up" style={{ animationDelay: '60ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">Bewerbungen</span></div>
                  <div className="kpi-value">305</div>
                  <div className="kpi-foot"><span className="kpi-caption">294 Indeed + 11 Instagram</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '140ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">Cost per VG</span></div>
                  <div className="kpi-value"><span className="kpi-unit-prefix">&euro;</span>61,98</div>
                  <div className="kpi-foot"><span className="kpi-caption">26 VG terminiert</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '220ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">No Show Quote</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-danger)' }}>50<span className="unit">%</span></div>
                  <div className="kpi-foot"><span className="kpi-caption">13 von 26 erschienen</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '300ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">Eingestellt</span></div>
                  <div className="kpi-value">0</div>
                  <div className="kpi-foot"><span className="kpi-caption">Cost per Hire: &mdash;</span></div>
                </div>
              </div>

              {/* KPI Row 2 */}
              <div className="kpi-grid">
                <div className="za-panel fade-up" style={{ animationDelay: '360ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Gesamtausgaben</span></div>
                  <div className="kpi-value"><span className="kpi-unit-prefix">&euro;</span>1.611</div>
                  <div className="kpi-foot"><span className="kpi-caption">Indeed + Instagram</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '420ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Cost/Bewerbung</span></div>
                  <div className="kpi-value"><span className="kpi-unit-prefix">&euro;</span>5,28</div>
                  <div className="kpi-foot"><span className="kpi-caption">305 Bewerbungen</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '480ms' }}>
                  <div className="kpi-top"><span className="kpi-label">VG &rarr; Probewoche</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-success)' }}>84,6<span className="unit">%</span></div>
                  <div className="kpi-foot"><span className="kpi-caption">11 von 13 erschienenen</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '540ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Probewoche Quote</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-danger)' }}>9,1<span className="unit">%</span></div>
                  <div className="kpi-foot"><span className="kpi-caption">1 von 11 durchgezogen</span></div>
                </div>
              </div>

              {/* Recruiting Funnel */}
              <div className="za-panel fade-up" style={{ animationDelay: '600ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Recruiting</span>
                    <div className="panel-title">Bewerbungs-Funnel</div>
                  </div>
                </div>
                <FunnelChart stages={[
                  { name: 'Bewerbungen', value: 305, pct: '100%', color: 'linear-gradient(90deg,#775A19,#C5A059)' },
                  { name: 'VG terminiert', value: 26, pct: '8,5%', color: 'linear-gradient(90deg,#775A19,#C5A059)' },
                  { name: 'VG erschienen', value: 13, pct: '50%', color: 'linear-gradient(90deg,#775A19,#C5A059)' },
                  { name: 'Probewoche term.', value: 11, pct: '84,6%', color: 'linear-gradient(90deg,#775A19,#C5A059)' },
                  { name: 'Probewoche ersch.', value: 2, pct: '18,2%', color: 'linear-gradient(90deg,#775A19,#C5A059)' },
                  { name: 'Durchgezogen', value: 1, pct: '50%', color: 'linear-gradient(90deg,#775A19,#C5A059)' },
                  { name: 'Eingestellt', value: 0, pct: '0%', color: 'linear-gradient(90deg,#775A19,#C5A059)' },
                ]} />
              </div>

              {/* Channel Comparison */}
              <div className="za-panel fade-up" style={{ animationDelay: '680ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Kanal-Vergleich</span>
                    <div className="panel-title">Indeed vs Instagram</div>
                  </div>
                </div>
                <div className="za-table-wrap">
                  <table className="za-table">
                    <thead><tr><th>Metrik</th><th>Indeed</th><th>Instagram</th></tr></thead>
                    <tbody>
                      <tr><td>Ausgaben</td><td style={{ color: 'var(--za-success)' }}>&euro;1.335</td><td>&euro;276</td></tr>
                      <tr><td>Bewerbungen</td><td style={{ color: 'var(--za-success)' }}>294</td><td>11</td></tr>
                      <tr><td>Cost/Bewerbung</td><td style={{ color: 'var(--za-success)' }}>&euro;4,54</td><td>&euro;25,09</td></tr>
                      <tr><td>VG terminiert</td><td style={{ color: 'var(--za-success)' }}>22</td><td>4</td></tr>
                      <tr><td>VG erschienen</td><td style={{ color: 'var(--za-success)' }}>12</td><td>1</td></tr>
                      <tr><td>No Show %</td><td style={{ color: 'var(--za-success)' }}>45%</td><td style={{ color: 'var(--za-danger)' }}>75%</td></tr>
                      <tr><td>Cost/VG erschienen</td><td style={{ color: 'var(--za-success)' }}>&euro;111,28</td><td>&euro;276</td></tr>
                      <tr><td>Probewoche</td><td style={{ color: 'var(--za-success)' }}>2</td><td>0</td></tr>
                      <tr><td>Eingestellt</td><td>0</td><td>0</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Insights */}
              <div className="za-panel fade-up" style={{ animationDelay: '760ms' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Analyse</span>
                    <div className="panel-title">Key Insights</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ padding: '12px 16px', borderLeft: '3px solid #f59e0b', background: 'rgba(245,158,11,0.06)', borderRadius: '6px', fontSize: '13px', color: 'var(--za-fg-2)' }}>
                    &#9888;&#65039; 50% No-Show-Quote bei VGs &mdash; Best&auml;tigungs-Flow optimieren
                  </div>
                  <div style={{ padding: '12px 16px', borderLeft: '3px solid #f59e0b', background: 'rgba(245,158,11,0.06)', borderRadius: '6px', fontSize: '13px', color: 'var(--za-fg-2)' }}>
                    &#9888;&#65039; 81,8% No-Show bei Probewochen &mdash; Verbindlichkeit erh&ouml;hen
                  </div>
                  <div style={{ padding: '12px 16px', borderLeft: '3px solid #3b82f6', background: 'rgba(59,130,246,0.06)', borderRadius: '6px', fontSize: '13px', color: 'var(--za-fg-2)' }}>
                    &#128202; Indeed: &euro;111/VG vs Instagram: &euro;276/VG &mdash; Indeed 2,5x effizienter
                  </div>
                  <div style={{ padding: '12px 16px', borderLeft: '3px solid #22c55e', background: 'rgba(34,197,94,0.06)', borderRadius: '6px', fontSize: '13px', color: 'var(--za-fg-2)' }}>
                    &#127919; N&auml;chster Hire ben&ouml;tigt ~&euro;3.200 bei aktueller Conversion
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════
               TAB: TEAM
             ═══════════════════════════════════════════════════ */}
          {activeNav === 'team' && (
            <>
              <div className="kpi-grid">
                <div className="za-panel fade-up" style={{ animationDelay: '60ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Offene Tasks</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-fg-3)' }}>&mdash;</div>
                  <div className="kpi-foot"><span className="kpi-caption">Aktuell</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '140ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Erledigt KW</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-fg-3)' }}>&mdash;</div>
                  <div className="kpi-foot"><span className="kpi-caption">Diese Woche</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '220ms' }}>
                  <div className="kpi-top"><span className="kpi-label">&Uuml;berf&auml;llig</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-fg-3)' }}>&mdash;</div>
                  <div className="kpi-foot"><span className="kpi-caption">Ausstehend</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '300ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Boards</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-fg-3)' }}>&mdash;</div>
                  <div className="kpi-foot"><span className="kpi-caption">Monday.com</span></div>
                </div>
              </div>

              {/* Sales Team */}
              <div className="za-panel fade-up" style={{ animationDelay: '360ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Sales Team</span>
                    <div className="panel-title">Close CRM</div>
                  </div>
                </div>
                {[
                  { name: 'Felix Zoepp', role: 'Closer', initial: 'F' },
                  { name: 'John Santillan', role: 'Opener', initial: 'J' },
                ].map((member, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: i === 0 ? '1px solid var(--za-border)' : 'none' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--za-gold), var(--za-gold-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#000' }}>
                      {member.initial}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{member.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>{member.role}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Empty states */}
              <div className="za-panel fade-up" style={{ animationDelay: '420ms', marginBottom: '16px' }}>
                <EmptyState
                  icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>}
                  title="Monday.com Boards"
                  subtitle="Integration in Vorbereitung. Projekt-Boards und Task-Status werden hier angezeigt."
                />
              </div>

              <div className="za-panel fade-up" style={{ animationDelay: '480ms' }}>
                <EmptyState
                  icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>}
                  title="Team-Auslastung"
                  subtitle="Integration in Vorbereitung. Kapazit&auml;ten und Workload-Verteilung werden hier angezeigt."
                />
              </div>
            </>
          )}

          {/* Footer */}
          <div style={{
            textAlign: 'center',
            padding: '32px 0 16px',
            fontSize: '10px',
            color: 'var(--za-fg-4)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}>
            Zoepp Admin Dashboard &mdash; Daten aus Close CRM &middot; Letzte Aktualisierung: {data.currentDate}
          </div>
        </main>
      </div>
    </>
  )
}
