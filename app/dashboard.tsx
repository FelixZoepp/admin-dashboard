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

type ViewMode = 'overview' | 'deepdive' | 'executive'

// ── Sidebar nav items ────────────────────────────────────────
const NAV_COCKPIT = [
  { id: 'overview', label: 'Overview', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg> },
  { id: 'pipeline', label: 'Pipeline', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 6h18M6 12h12M9 18h6"/></svg>, badge: true },
  { id: 'leads', label: 'Leads', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-7 7-7s7 3 7 7"/><circle cx="17" cy="6" r="3"/></svg> },
  { id: 'outreach', label: 'LinkedIn Outreach', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 5h16v12H5l-3 3V5a1 1 0 011-1z"/><path d="M7 10h10M7 13h6"/></svg> },
]
const NAV_STUDIO = [
  { id: 'clients', label: 'Kunden', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><circle cx="9" cy="7" r="4"/><path d="M17 11a4 4 0 004-4"/></svg> },
  { id: 'reports', label: 'Reports', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/></svg> },
  { id: 'automations', label: 'Automationen', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/></svg> },
  { id: 'settings', label: 'Einstellungen', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1A1.7 1.7 0 008 19.4a1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H2a2 2 0 010-4h.1A1.7 1.7 0 003.6 8a1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H8a1.7 1.7 0 001-1.5V2a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V8a1.7 1.7 0 001.5 1H22a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg> },
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
  const [activeNav, setActiveNav] = useState('overview')
  const [view, setView] = useState<ViewMode>('overview')
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

  // Chart data
  const [chartData] = useState(() => ({
    mainArea: [
      { name: 'Termine', data: generateSeries(30, 4, 1.2, 0.08), color: '#C5A059', glow: true },
      { name: 'Antworten', data: generateSeries(30, 22, 5, 0.3), color: '#8BB6E8' },
    ],
    mainLabels: Array.from({ length: 30 }, (_, i) => i % 5 === 0 ? String(i + 1).padStart(2, '0') : ''),
    dd1Area: [
      { name: 'Nachrichten', data: generateSeries(12, 140, 20, 2), color: '#8BB6E8' },
      { name: 'Antworten', data: generateSeries(12, 46, 8, 1), color: '#C5A059', glow: true },
      { name: 'Termine', data: generateSeries(12, 8, 1.5, 0.2), color: '#7FC29B' },
    ],
    dd1Labels: Array.from({ length: 12 }, (_, i) => 'W' + (i + 1)),
    barData: [5, 6, 4, 7, 8, 6, 9, 7, 8, 10, 9, 8],
    barLabels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'],
    execArea: [
      { name: 'ARR', data: [120, 130, 145, 155, 170, 180, 195, 210, 225, 240, 255, 270], color: '#C5A059', glow: true },
      { name: 'Pipeline', data: [200, 220, 260, 280, 320, 360, 380, 410, 430, 460, 475, 482], color: '#8BB6E8' },
    ],
    execLabels: ['Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez', 'Jan', 'Feb', 'Mrz', 'Apr'],
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

  // Donut data from lead status counts
  const donutSegments = (() => {
    const colors = ['#C5A059', '#8BB6E8', '#B49AE8', '#7FC29B']
    const total = data.leadStatusCounts.reduce((s, l) => s + l.count, 0)
    if (total === 0) return [{ value: 100, color: '#333' }]
    return data.leadStatusCounts.slice(0, 4).map((l, i) => ({
      value: l.count,
      color: colors[i % colors.length],
    }))
  })()

  const donutTotal = data.leadStatusCounts.reduce((s, l) => s + l.count, 0)

  // Funnel from real data
  const funnelStages = [
    { name: 'Alle Opps', value: data.conversionFunnel.totalOpportunities, pct: '100%', color: 'linear-gradient(90deg,#775A19,#C5A059)' },
    { name: 'Setting', value: data.conversionFunnel.reachedSetting, pct: `${data.conversionFunnel.settingToClosingRate.toFixed(0)}%`, color: 'linear-gradient(90deg,#8BB6E8,#B49AE8)' },
    { name: 'Closing', value: data.conversionFunnel.reachedClosing, pct: `${data.conversionFunnel.closingToWonRate.toFixed(0)}%`, color: 'linear-gradient(90deg,#E9CB8B,#C5A059)' },
    { name: 'Won', value: data.conversionFunnel.wonCount, pct: `${data.conversionFunnel.overallConversionRate.toFixed(1)}%`, color: 'linear-gradient(90deg,#7FC29B,#4E8A6B)' },
  ]

  // Activity feed from won deals
  const activityFeed = (data.wonDealsDisplay || []).slice(0, 7).map((d, i) => ({
    name: d.name,
    action: `Won \u2014 ${fmtEuro(d.value)}`,
    time: fmtDate(d.date),
    mark: d.name.charAt(0).toUpperCase(),
    isNew: i < 2,
  }))

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
            <div className="sb-section-label">Cockpit</div>
            {NAV_COCKPIT.map(item => (
              <a
                key={item.id}
                className={`sb-item ${activeNav === item.id ? 'is-active' : ''}`}
                onClick={() => setActiveNav(item.id)}
              >
                {item.icon}
                {item.label}
                {item.badge && <span className="sb-badge">{data.pipelineCount}</span>}
              </a>
            ))}
          </div>

          <div className="sb-section">
            <div className="sb-section-label">Studio</div>
            {NAV_STUDIO.map(item => (
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
            <div className="view-switch" role="tablist" aria-label="Ansicht">
              {(['overview', 'deepdive', 'executive'] as ViewMode[]).map(v => (
                <button key={v} className={view === v ? 'is-active' : ''} onClick={() => setView(v)}>
                  {v === 'overview' ? 'Overview' : v === 'deepdive' ? 'Deep-Dive' : 'Executive'}
                </button>
              ))}
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

          {/* Period selector + export buttons row */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }} className="fade-up" >
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

          {/* ═══════════════════════════════════════════════════
               VIEW 1 — OVERVIEW
             ═══════════════════════════════════════════════════ */}
          {view === 'overview' && (
            <>
              {/* KPI tiles */}
              <div className="kpi-grid">
                <div className="za-panel fade-up" style={{ animationDelay: '60ms' }}>
                  <div className="kpi-top">
                    <span className="kpi-label"><span className="dotlive" />Termine &middot; Woche</span>
                    <span className={`kpi-delta ${callChange >= 0 ? 'up' : 'down'}`}>
                      {callChange >= 0 ? '\u2191' : '\u2193'} {Math.abs(callChange)}%
                    </span>
                  </div>
                  <div className="kpi-value">{data.callsThisWeek}<span className="unit">/10</span></div>
                  <div className="kpi-foot">
                    <span className="kpi-caption">vs. KW {data.currentWeek - 1}</span>
                    <SparklineChart data={sparkData.a} />
                  </div>
                </div>

                <div className="za-panel fade-up" style={{ animationDelay: '140ms' }}>
                  <div className="kpi-top">
                    <span className="kpi-label">Pipeline</span>
                    <span className="kpi-delta up">&uarr; {data.pipelineCount} Deals</span>
                  </div>
                  <div className="kpi-value"><span className="kpi-unit-prefix">&euro;</span>{pipelineK}<span className="unit">k</span></div>
                  <div className="kpi-foot">
                    <span className="kpi-caption">{data.pipelineCount} offene Deals</span>
                    <SparklineChart data={sparkData.b} />
                  </div>
                </div>

                <div className="za-panel fade-up" style={{ animationDelay: '220ms' }}>
                  <div className="kpi-top">
                    <span className="kpi-label">Antwortquote</span>
                    <span className={`kpi-delta ${data.closingRate > 0 ? 'up' : 'down'}`}>
                      {data.closingRate > 0 ? '\u2191' : '\u2193'} {data.closingRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="kpi-value">{periodClosingRate}<span className="unit">%</span></div>
                  <div className="kpi-foot">
                    <span className="kpi-caption">Closing Rate</span>
                    <SparklineChart data={sparkData.c} />
                  </div>
                </div>

                <div className="za-panel fade-up" style={{ animationDelay: '300ms' }}>
                  <div className="kpi-top">
                    <span className="kpi-label">Umsatz &middot; MTD</span>
                    <span className={`kpi-delta ${data.revenueMTD > 0 ? 'up' : 'down'}`}>
                      {fmtEuroK(data.revenueMTD)}
                    </span>
                  </div>
                  <div className="kpi-value"><span className="kpi-unit-prefix">&euro;</span>{revenueMTDK}<span className="unit">k</span></div>
                  <div className="kpi-foot">
                    <span className="kpi-caption">Ziel {fmtEuroK(data.linearForecast)}</span>
                    <SparklineChart data={sparkData.d} />
                  </div>
                </div>
              </div>

              {/* Area chart + donut */}
              <div className="row-grid row-2">
                <div className="za-panel fade-up" style={{ animationDelay: '360ms' }}>
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">Trend &middot; 30 Tage</span>
                      <div className="panel-title">Termine &amp; Antworten</div>
                    </div>
                    <span className="panel-sub">gleitender Durchschnitt</span>
                  </div>
                  <AreaChart series={chartData.mainArea} labels={chartData.mainLabels} />
                </div>

                <div className="za-panel fade-up" style={{ animationDelay: '420ms' }}>
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">Breakdown</span>
                      <div className="panel-title">Lead-Quellen</div>
                    </div>
                  </div>
                  <div className="donut-wrap">
                    <DonutChart
                      segments={donutSegments}
                      centerValue={fmtNum(donutTotal)}
                      centerLabel="Leads"
                    />
                    <div className="donut-legend">
                      {data.leadStatusCounts.slice(0, 4).map((ls, i) => {
                        const colors = ['#C5A059', '#8BB6E8', '#B49AE8', '#7FC29B']
                        const pct = donutTotal > 0 ? Math.round((ls.count / donutTotal) * 100) : 0
                        return (
                          <div key={i} className="donut-legend-item">
                            <span className="swatch" style={{ background: colors[i % colors.length] }} />
                            <span className="ll">{ls.label}</span>
                            <span className="lv">{pct}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Funnel + Feed */}
              <div className="row-grid row-2">
                <div className="za-panel fade-up" style={{ animationDelay: '480ms' }}>
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">Pipeline</span>
                      <div className="panel-title">Funnel &middot; {data.currentMonthName}</div>
                    </div>
                    <span className="panel-sub">Conversion Rate {data.conversionFunnel.overallConversionRate.toFixed(1)}%</span>
                  </div>
                  <FunnelChart stages={funnelStages} />
                </div>

                <div className="za-panel fade-up" style={{ animationDelay: '540ms' }}>
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow"><span style={{ color: '#7FC29B' }}>&bull; Live</span></span>
                      <div className="panel-title">Aktivit&auml;t</div>
                    </div>
                  </div>
                  <div className="feed">
                    {activityFeed.map((item, i) => (
                      <div key={i} className="feed-item">
                        <div className={`feed-avatar ${item.isNew ? 'new' : ''}`}>{item.mark}</div>
                        <div className="feed-text">
                          <div><span className="feed-name">{item.name}</span> <span className="feed-action">{item.action}</span></div>
                        </div>
                        <div className="feed-time">{item.time}</div>
                      </div>
                    ))}
                    {activityFeed.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--za-fg-3)', fontSize: '12px' }}>
                        Keine k&uuml;rzlichen Aktivit&auml;ten
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Heatmap + Table */}
              <div className="row-grid row-2">
                <div className="za-panel fade-up" style={{ animationDelay: '600ms' }}>
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">Kalender</span>
                      <div className="panel-title">Outreach-Intensit&auml;t &middot; 20 Wochen</div>
                    </div>
                  </div>
                  <HeatmapChart weeks={20} />
                </div>

                <div className="za-panel fade-up" style={{ animationDelay: '660ms' }}>
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">Hot Deals</span>
                      <div className="panel-title">Top Pipeline</div>
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
              </div>

              {/* ─── Drill-down sections ─── */}
              {/* Won Deals */}
              <div className="za-panel fade-up" style={{ animationDelay: '720ms', marginBottom: '16px' }}>
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

              {/* Pipeline drill-down */}
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

              {/* Lead Status drill-down */}
              <div className="za-panel fade-up" style={{ animationDelay: '840ms', marginBottom: '16px' }}>
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

              {/* Historical Performance */}
              <div className="za-panel fade-up" style={{ animationDelay: '900ms', marginBottom: '16px' }}>
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
                <div className="za-panel fade-up" style={{ animationDelay: '960ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Won (gesamt)</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-success)' }}>{data.wonTotal}</div>
                  <div className="kpi-foot"><span className="kpi-caption">{fmtEuro(data.totalRevenue)} Umsatz</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '1020ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Lost (gesamt)</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-danger)' }}>{data.lostCount}</div>
                  <div className="kpi-foot"><span className="kpi-caption">{fmtEuro(data.totalLostValue)} entgangen</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '1080ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Kunden</span></div>
                  <div className="kpi-value">{data.kundenCount}</div>
                  <div className="kpi-foot"><span className="kpi-caption">Active Customers</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '1140ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Calls (8W)</span></div>
                  <div className="kpi-value">{fmtNum(data.totalCalls8W)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">Letzte 8 Wochen</span></div>
                </div>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════
               VIEW 2 — DEEP DIVE
             ═══════════════════════════════════════════════════ */}
          {view === 'deepdive' && (
            <>
              <div className="dd-row">
                <div className="za-panel fade-up">
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">Outreach &middot; 12 Wochen</span>
                      <div className="panel-title">Nachrichten &middot; Antworten &middot; Termine</div>
                    </div>
                    <span className="panel-sub">Signal &amp; Rauschen</span>
                  </div>
                  <AreaChart series={chartData.dd1Area} labels={chartData.dd1Labels} height={300} />
                </div>

                <div className="za-panel fade-up" style={{ animationDelay: '80ms' }}>
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">Verteilung</span>
                      <div className="panel-title">Antwort-Sentiment</div>
                    </div>
                  </div>
                  <div className="donut-wrap">
                    <DonutChart
                      segments={[
                        { value: 68, color: '#7FC29B' },
                        { value: 22, color: '#E9CB8B' },
                        { value: 10, color: '#E87467' },
                      ]}
                      centerValue={`${periodClosingRate}%`}
                      centerLabel="Positiv"
                    />
                    <div className="donut-legend">
                      <div className="donut-legend-item"><span className="swatch" style={{ background: '#7FC29B' }} /><span className="ll">Interesse</span><span className="lv">{periodClosingRate}%</span></div>
                      <div className="donut-legend-item"><span className="swatch" style={{ background: '#E9CB8B' }} /><span className="ll">Neutral</span><span className="lv">22%</span></div>
                      <div className="donut-legend-item"><span className="swatch" style={{ background: '#E87467' }} /><span className="ll">Ablehnung</span><span className="lv">10%</span></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="row-grid row-2-equal">
                <div className="za-panel fade-up" style={{ animationDelay: '160ms' }}>
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">Wochenvergleich</span>
                      <div className="panel-title">Termine pro Woche</div>
                    </div>
                  </div>
                  <BarChart data={data.weeklyCallData.map(w => w.calls)} labels={data.weeklyCallData.map(w => w.week)} />
                </div>

                <div className="za-panel fade-up" style={{ animationDelay: '220ms' }}>
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">Pipeline</span>
                      <div className="panel-title">Funnel &middot; detailliert</div>
                    </div>
                  </div>
                  <FunnelChart stages={[
                    { name: 'Alle Opportunities', value: data.conversionFunnel.totalOpportunities, pct: '100%', color: 'linear-gradient(90deg,#4E4639,#775A19)' },
                    { name: 'Setting', value: data.conversionFunnel.reachedSetting, pct: `${data.conversionFunnel.settingToClosingRate.toFixed(0)}%`, color: 'linear-gradient(90deg,#775A19,#C5A059)' },
                    { name: 'Closing', value: data.conversionFunnel.reachedClosing, pct: `${data.conversionFunnel.closingToWonRate.toFixed(0)}%`, color: 'linear-gradient(90deg,#8BB6E8,#B49AE8)' },
                    { name: 'Won', value: data.conversionFunnel.wonCount, pct: `${data.conversionFunnel.overallConversionRate.toFixed(1)}%`, color: 'linear-gradient(90deg,#E9CB8B,#C5A059)' },
                    { name: 'Lost', value: data.conversionFunnel.lostCount, pct: `${(data.conversionFunnel.lostCount / Math.max(data.conversionFunnel.totalOpportunities, 1) * 100).toFixed(1)}%`, color: 'linear-gradient(90deg,#E87467,#c45a4f)' },
                  ]} />
                </div>
              </div>

              <div className="za-panel fade-up" style={{ animationDelay: '280ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Kohorten</span>
                    <div className="panel-title">Aktivit&auml;ts-Heatmap &middot; 20 Wochen</div>
                  </div>
                </div>
                <HeatmapChart weeks={20} />
              </div>

              {/* Waterfall stats */}
              <div className="kpi-grid">
                <div className="za-panel fade-up" style={{ animationDelay: '340ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Settings pro Close</span></div>
                  <div className="kpi-value">{data.waterfall.settingsPerClose}</div>
                  <div className="kpi-foot"><span className="kpi-caption">Settings f&uuml;r 1 Won</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '400ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Closings pro Close</span></div>
                  <div className="kpi-value">{data.waterfall.closingsPerClose}</div>
                  <div className="kpi-foot"><span className="kpi-caption">Closings f&uuml;r 1 Won</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '460ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Gesamt Conversion</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-success)' }}>{data.conversionFunnel.overallConversionRate.toFixed(1)}<span className="unit">%</span></div>
                  <div className="kpi-foot"><span className="kpi-caption">Alle Opps zu Won</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '520ms' }}>
                  <div className="kpi-top"><span className="kpi-label">&Oslash; Deal Cycle</span></div>
                  <div className="kpi-value">{data.waterfall.avgDealCycle}<span className="unit"> Tage</span></div>
                  <div className="kpi-foot"><span className="kpi-caption">Erstellung bis Won</span></div>
                </div>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════
               VIEW 3 — EXECUTIVE
             ═══════════════════════════════════════════════════ */}
          {view === 'executive' && (
            <>
              <div className="exec-hero fade-up">
                <div className="exec-hero-grid">
                  <div>
                    <h2>Planbare <span className="it">Termine.</span><br />Bewiesene Architektur.</h2>
                    <p className="exec-hero-sub">
                      Der Monat steht stabil im Zielkorridor. Pipeline: {fmtEuro(data.pipelineValue)} mit {data.pipelineCount} offenen Deals.
                      Closing Rate bei {data.closingRate.toFixed(1)}%. Fokus: Hot-Deals in Won konvertieren.
                    </p>
                  </div>
                  <div className="exec-hero-stats">
                    <div className="exec-stat">
                      <div className="v">{data.wonTotal}<span className="it">/{data.wonTotal + data.lostCount}</span></div>
                      <div className="l">Won Deals &middot; Gesamt</div>
                    </div>
                    <div className="exec-stat">
                      <div className="v">&euro;&thinsp;{pipelineK}k</div>
                      <div className="l">Pipeline</div>
                    </div>
                    <div className="exec-stat">
                      <div className="v">{data.closingRate.toFixed(0)}%</div>
                      <div className="l">Closing Rate</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="kpi-grid">
                <div className="za-panel fade-up" style={{ animationDelay: '100ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Kunden</span><span className="kpi-delta up">&uarr; {data.kundenCount}</span></div>
                  <div className="kpi-value">{data.kundenCount}</div>
                  <div className="kpi-foot"><span className="kpi-caption">Active</span><SparklineChart data={sparkData.e} /></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '160ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Avg. Deal Size</span><span className="kpi-delta up">&uarr;</span></div>
                  <div className="kpi-value"><span className="kpi-unit-prefix">&euro;</span>{fmtNum(data.avgDealSize)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">&Oslash; Won Deal</span><SparklineChart data={sparkData.f} /></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '220ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Closing Rate</span><span className="kpi-delta up">&uarr; {data.closingRate.toFixed(1)}%</span></div>
                  <div className="kpi-value">{data.closingRate.toFixed(0)}<span className="unit">%</span></div>
                  <div className="kpi-foot"><span className="kpi-caption">{data.wonTotal} / {data.wonTotal + data.lostCount}</span><SparklineChart data={sparkData.g} /></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '280ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Total Revenue</span></div>
                  <div className="kpi-value"><span className="kpi-unit-prefix">&euro;</span>{fmtNum(Math.round(data.totalRevenue / 1000))}<span className="unit">k</span></div>
                  <div className="kpi-foot"><span className="kpi-caption">Gesamtumsatz</span><SparklineChart data={sparkData.h} /></div>
                </div>
              </div>

              <div className="row-grid row-2">
                <div className="za-panel fade-up" style={{ animationDelay: '340ms' }}>
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">Umsatzkurve &middot; 12 Monate</span>
                      <div className="panel-title">ARR &amp; Pipeline-Entwicklung</div>
                    </div>
                  </div>
                  <AreaChart series={chartData.execArea} labels={chartData.execLabels} height={280} />
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '400ms' }}>
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">Top Deals</span>
                      <div className="panel-title">Strategische Konten</div>
                    </div>
                  </div>
                  <div className="za-table-wrap">
                    <table className="za-table">
                      <thead><tr><th>Konto</th><th>Stage</th><th>Wert</th></tr></thead>
                      <tbody>
                        {hotDeals.map((deal, i) => (
                          <tr key={i}>
                            <td>
                              <div className="t-co">
                                <span className="t-co-mark">{deal.leadName.charAt(0)}</span>
                                <span className="t-co-name">{deal.leadName}</span>
                              </div>
                            </td>
                            <td><span className={`t-status ${getDealStatusClass(deal.status)}`}>{deal.status}</span></td>
                            <td>{fmtEuro(deal.value)}</td>
                          </tr>
                        ))}
                        {hotDeals.length === 0 && (
                          <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--za-fg-3)', padding: '20px' }}>Keine Pipeline Deals</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Forecast panel */}
              <div className="za-panel fade-up" style={{ animationDelay: '460ms', marginBottom: '16px' }}>
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

              {/* Monthly revenue chart */}
              <div className="za-panel fade-up" style={{ animationDelay: '520ms' }}>
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
