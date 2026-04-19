'use client'

import { useState, useEffect, useRef } from 'react'

// German number formatting
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

// Color mapping
function colorVar(color: string): string {
  const map: Record<string, string> = {
    'accent-blue': 'var(--color-accent-blue)',
    'accent-green': 'var(--color-accent-green)',
    'accent-red': 'var(--color-accent-red)',
    'accent-yellow': 'var(--color-accent-yellow)',
    'accent-purple': 'var(--color-accent-purple)',
    'accent-orange': 'var(--color-accent-orange)',
    'text-muted': 'var(--color-text-muted)',
  }
  return map[color] || 'var(--color-text-muted)'
}

// Pipeline status color
function pipelineStatusColor(label: string): string {
  if (label.includes('Closing') && label.includes('Terminiert')) return 'var(--color-accent-green)'
  if (label.includes('Angebot')) return 'var(--color-accent-yellow)'
  if (label.includes('CC2')) return 'var(--color-accent-blue)'
  if (label.includes('No Show')) return 'var(--color-accent-red)'
  return 'var(--color-text-muted)'
}

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
  leadStatusCounts: { label: string; count: number; color: string }[]
  weeklyCallData: { week: string; calls: number }[]
  monthlyChartData: { label: string; value: number; isCurrent: boolean }[]
  historicalPerformance: { label: string; value: number; isCurrent: boolean }[]
  revenueMTD: number
  linearForecast: number
  pipelineWeightedForecast: number
  avg3Months: number
  lastUpdated: string
  error?: string
}

export default function Dashboard({ data }: { data: DashboardData }) {
  const [activeTab, setActiveTab] = useState('sales')
  const touchStartX = useRef(0)
  const tabOrder = ['sales', 'fulfillment', 'marketing', 'finanzen', 'team']

  const [animatedBars, setAnimatedBars] = useState(false)

  useEffect(() => {
    // Trigger animation after mount
    const timer = setTimeout(() => setAnimatedBars(true), 100)
    return () => clearTimeout(timer)
  }, [])

  // Re-animate on tab change
  useEffect(() => {
    setAnimatedBars(false)
    const timer = setTimeout(() => setAnimatedBars(true), 50)
    return () => clearTimeout(timer)
  }, [activeTab])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].screenX
    if (Math.abs(diff) > 80) {
      const idx = tabOrder.indexOf(activeTab)
      const next = diff > 0 ? idx + 1 : idx - 1
      if (next >= 0 && next < tabOrder.length) {
        setActiveTab(tabOrder[next])
      }
    }
  }

  // Call trend - calculate bar heights
  const maxCalls = Math.max(...(data.weeklyCallData?.map(w => w.calls) || [1]), 1)

  // Monthly chart - calculate bar heights
  const maxMonthly = Math.max(...(data.monthlyChartData?.map(m => m.value) || [1]), 1)

  // Call change percentage
  const callChange = data.callsLastWeek > 0
    ? Math.round(((data.callsThisWeek - data.callsLastWeek) / data.callsLastWeek) * 100)
    : 0

  // MTD progress
  const target = 45000
  const progressPct = Math.min(Math.round((data.revenueMTD / target) * 100), 100)

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-bg-tertiary) 100%)',
        padding: '16px 20px 0',
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{
            fontSize: '20px',
            fontWeight: 700,
            background: 'linear-gradient(135deg, var(--color-accent-blue) 0%, #7ba3ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Content Leads — Admin
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'right' }}>
            <div>KW {data.currentWeek}</div>
            <div>{data.currentDate}</div>
          </div>
        </div>
        <nav style={{
          display: 'flex',
          gap: 0,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          margin: '0 -20px',
          padding: '0 20px',
        }}>
          {[
            { id: 'sales', label: 'Sales' },
            { id: 'fulfillment', label: 'Fulfillment' },
            { id: 'marketing', label: 'Marketing' },
            { id: 'finanzen', label: 'Finanzen' },
            { id: 'team', label: 'Team' },
          ].map(tab => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 16px',
                fontSize: '12px',
                fontWeight: 600,
                color: activeTab === tab.id ? 'var(--color-accent-blue)' : 'var(--color-text-muted)',
                borderBottom: `2px solid ${activeTab === tab.id ? 'var(--color-accent-blue)' : 'transparent'}`,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {tab.label}
            </div>
          ))}
        </nav>
      </header>

      {/* ===== SALES TAB ===== */}
      {activeTab === 'sales' && (
        <div style={{ padding: '16px' }}>
          <div className="section-title" style={{ fontSize: '16px', fontWeight: 600, margin: '4px 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Kennzahlen KW {data.currentWeek}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            <KpiCard label="Anwahlen" value={fmtNum(data.callsThisWeek)} sub={
              <><span className={callChange >= 0 ? 'up' : 'down'} style={{ color: callChange >= 0 ? 'var(--color-accent-green)' : 'var(--color-accent-red)', fontWeight: 600 }}>
                {callChange >= 0 ? '\u25B2' : '\u25BC'} {callChange >= 0 ? '+' : ''}{callChange}%
              </span> vs. VW ({fmtNum(data.callsLastWeek)})</>
            } />
            <KpiCard label="Won Deals" value={String(data.wonDealsCount)} sub={
              <><span style={{ color: 'var(--color-accent-green)', fontWeight: 600 }}>{fmtEuro(data.wonDealsValue)}</span> Wert</>
            } />
            <KpiCard label="Pipeline" value={String(data.pipelineCount)} sub={
              <><span style={{ color: 'var(--color-accent-green)', fontWeight: 600 }}>{fmtEuro(data.pipelineValue)}</span> Wert</>
            } />
            <KpiCard label="Closing Rate" value={`${data.closingRate}%`} sub={`${data.wonTotal} Won / ${data.closedTotal} Closed`} />
            <KpiCard label="Avg Deal" value={fmtEuro(data.avgDealSize)} sub={'\u00D8 Won Deal Size'} />
            <KpiCard label="Leads gesamt" value={fmtNum(data.totalLeads)} sub={`davon ${fmtNum(data.leadpoolCount)} im Leadpool`} />
          </div>

          <SectionTitle>Lead Status Verteilung</SectionTitle>
          <Card>
            {data.leadStatusCounts.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < data.leadStatusCounts.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <div>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block', marginRight: '8px', background: colorVar(s.color) }} />
                  {s.label}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{fmtNum(s.count)}</div>
              </div>
            ))}
          </Card>

          <SectionTitle>Wochentrend — Anwahlen</SectionTitle>
          <Card>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '6px', height: '160px', padding: '0 4px' }}>
              {data.weeklyCallData.map((w, i) => {
                const isLast = i === data.weeklyCallData.length - 1
                const heightPct = maxCalls > 0 ? Math.max((w.calls / maxCalls) * 100, w.calls > 0 ? 1 : 0) : 0
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ fontSize: '9px', fontWeight: 600, marginBottom: '2px' }}>{fmtNum(w.calls)}</div>
                    <div style={{
                      width: '100%',
                      minWidth: '24px',
                      maxWidth: '50px',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.5s ease',
                      height: animatedBars ? `${Math.max(heightPct, w.calls > 0 ? 1 : 0)}%` : '0',
                      minHeight: w.calls > 0 ? '4px' : '0',
                      background: isLast
                        ? 'linear-gradient(180deg, #34d399, #51e0b8)'
                        : 'linear-gradient(180deg, #4f8cff, #5a94ff)',
                    }} />
                    <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '4px' }}>{w.week}</div>
                  </div>
                )
              })}
            </div>
          </Card>

          <SectionTitle>Won Deals — {data.currentMonthName} {data.currentYear}</SectionTitle>
          {data.wonDealsDisplay.map((deal, i) => (
            <div key={i} style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '10px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{deal.name}</div>
                <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '5px', fontWeight: 600, background: 'rgba(52, 211, 153, 0.2)', color: 'var(--color-accent-green)' }}>Won</span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-accent-green)', marginBottom: '6px' }}>
                {fmtEuro(deal.value)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                <span>{fmtDate(deal.date)}</span>
                <span>{deal.user}</span>
              </div>
            </div>
          ))}

          <SectionTitle>Active Pipeline</SectionTitle>
          <Card>
            {data.pipelineSorted.map((p, i) => (
              <div key={i} style={{
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{p.count} {p.count === 1 ? 'Deal' : 'Deals'}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{p.label}</div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: pipelineStatusColor(p.label) }}>
                  {fmtEuro(p.value)}
                </div>
              </div>
            ))}
          </Card>

          {data.pipelineDealsWithValue.length > 0 && (
            <>
              <SectionTitle>Pipeline Deals mit Wert</SectionTitle>
              <Card>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginBottom: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead style={{ background: 'var(--color-bg-tertiary)', borderBottom: '2px solid var(--color-border)' }}>
                      <tr>
                        <th style={thStyle}>Lead</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Wert</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pipelineDealsWithValue.map((deal, i) => (
                        <tr key={i}>
                          <td style={{ ...tdStyle, borderBottom: i < data.pipelineDealsWithValue.length - 1 ? '1px solid var(--color-border)' : 'none' }}>{deal.leadName}</td>
                          <td style={{ ...tdStyle, borderBottom: i < data.pipelineDealsWithValue.length - 1 ? '1px solid var(--color-border)' : 'none' }}>{deal.status}</td>
                          <td style={{ ...tdStyle, borderBottom: i < data.pipelineDealsWithValue.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                            <span style={{ background: 'rgba(79, 140, 255, 0.15)', color: 'var(--color-accent-blue)', fontWeight: 600, borderRadius: '4px', padding: '2px 6px' }}>
                              {fmtEuro(deal.value)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          <SectionTitle>Month-to-Date</SectionTitle>
          <Card>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Umsatz {data.currentMonthName} (bis {data.currentDate})
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0' }}>{fmtEuro(data.revenueMTD)}</div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', margin: '6px 0' }}>
              <div style={{
                height: '100%',
                background: 'linear-gradient(90deg, var(--color-accent-blue) 0%, var(--color-accent-green) 100%)',
                borderRadius: '3px',
                transition: 'width 0.5s ease',
                width: animatedBars ? `${progressPct}%` : '0%',
              }} />
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Target: {fmtEuro(target)} | {progressPct}% erreicht
            </div>
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Forecast Monatsende</div>
              <div style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0', color: 'var(--color-accent-blue)' }}>{fmtEuro(data.linearForecast)}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Lineare Extrapolation ({data.currentDay}/{data.daysInMonth} Tage)</div>
            </div>
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Forecast inkl. Pipeline</div>
              <div style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0', color: 'var(--color-accent-green)' }}>{fmtEuro(data.pipelineWeightedForecast)}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>+ Pipeline ({fmtEuro(data.pipelineValue)} x {data.closingRate}% Win Rate)</div>
            </div>
          </Card>

          <SectionTitle>Historische Performance</SectionTitle>
          <Card>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Won Revenue pro Monat</div>
            {data.historicalPerformance.map((h, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < data.historicalPerformance.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <div style={{ fontSize: '13px' }}>{h.label}{h.isCurrent ? ' (MTD)' : ''}</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: h.isCurrent ? 'var(--color-accent-green)' : 'var(--color-text-primary)' }}>
                  {fmtEuro(h.value)}
                </div>
              </div>
            ))}
          </Card>

          <SectionTitle>Gesamtstatistik</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            <KpiCard label="Won (gesamt)" value={String(data.wonTotal)} valueColor="var(--color-accent-green)" sub={`${fmtEuro(data.totalRevenue)} Umsatz`} />
            <KpiCard label="Lost (gesamt)" value={String(data.lostCount)} valueColor="var(--color-accent-red)" sub={`${fmtEuro(data.totalLostValue)} entgangen`} />
            <KpiCard label="Kunden" value={String(data.kundenCount)} sub="Active Customers" />
            <KpiCard label="Calls (8W)" value={fmtNum(data.totalCalls8W)} sub="Letzte 8 Wochen" />
          </div>
        </div>
      )}

      {/* ===== FULFILLMENT TAB ===== */}
      {activeTab === 'fulfillment' && (
        <div style={{ padding: '16px' }}>
          <SectionTitle first>Lisa — Tagesproduktivit&auml;t</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            <KpiCard label="Heute erledigt" value="—" sub="Aufgaben abgehakt" />
            <KpiCard label="Woche gesamt" value="—" sub="Aufgaben diese Woche" />
            <KpiCard label={'\u00D8 pro Tag'} value="—" sub="Durchschnitt KW" />
            <KpiCard label="Offen" value="—" sub="Noch zu erledigen" />
          </div>

          <SectionTitle>Tagesaufschl&uuml;sselung</SectionTitle>
          <Card>
            {['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'].map((day, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 4 ? '1px solid var(--color-border)' : 'none' }}>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{day}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-accent-green)', minWidth: '30px', textAlign: 'right' }}>—</div>
                  <div style={{ width: '80px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '3px', width: '0%', background: 'var(--color-accent-green)' }} />
                  </div>
                </div>
              </div>
            ))}
          </Card>

          <SectionTitle>Wochen-Trend</SectionTitle>
          <Card>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '6px', height: '160px', padding: '0 4px' }}>
              {['KW12', 'KW13', 'KW14', 'KW15', 'KW16'].map((wk, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ fontSize: '9px', fontWeight: 600, marginBottom: '2px' }}>—</div>
                  <div style={{
                    width: '100%', minWidth: '24px', maxWidth: '50px', borderRadius: '4px 4px 0 0',
                    height: '10%',
                    background: i === 4 ? 'linear-gradient(180deg, #34d399, #51e0b8)' : 'linear-gradient(180deg, #a78bfa, #c4b5fd)',
                  }} />
                  <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '4px' }}>{wk}</div>
                </div>
              ))}
            </div>
          </Card>

          <SectionTitle>Kategorien</SectionTitle>
          <Card>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Aufgaben nach Typ</div>
            {['T\u00e4glich', 'W\u00f6chentlich', 'Monatlich'].map((typ, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--color-border)' : 'none' }}>
                <div style={{ fontSize: '13px' }}>{typ}</div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>—</div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* ===== MARKETING TAB ===== */}
      {activeTab === 'marketing' && (
        <div style={{ padding: '16px' }}>
          <SectionTitle first>Content Performance</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            <KpiCard label="Posts KW" value="—" sub="Alle Plattformen" />
            <KpiCard label="Impressions" value="—" sub="Gesamt KW" />
            <KpiCard label="Engagement" value="—" sub="Likes + Kommentare" />
            <KpiCard label="Leads" value="—" sub="via Content" />
          </div>

          <SectionTitle>LinkedIn</SectionTitle>
          <PlatformCard icon={'\uD83D\uDC64'} name="LinkedIn" stats={[
            { label: 'Impressions', value: '—' }, { label: 'Engagement', value: '—' },
            { label: 'Follower', value: '—' }, { label: 'Profilbesuche', value: '—' },
          ]} />

          <SectionTitle>Instagram</SectionTitle>
          <PlatformCard icon={'\uD83D\uDCF7'} name="Instagram" stats={[
            { label: 'Reichweite', value: '—' }, { label: 'Engagement', value: '—' },
            { label: 'Follower', value: '—' }, { label: 'Story Views', value: '—' },
          ]} />

          <SectionTitle>YouTube</SectionTitle>
          <PlatformCard icon={'\u25B6'} name="YouTube" stats={[
            { label: 'Views', value: '—' }, { label: 'Watch Time', value: '—' },
            { label: 'Subscriber', value: '—' }, { label: 'CTR', value: '—' },
          ]} />

          <SectionTitle>Perspective Funnels</SectionTitle>
          <Card>
            <EmptyState icon={'\uD83D\uDE80'} text="Perspective-Daten werden bald angebunden" sub="Funnel-Views, Conversion Rates, Opt-ins" />
          </Card>

          <SectionTitle>CopeCart</SectionTitle>
          <Card>
            <EmptyState icon={'\uD83D\uDCB0'} text="CopeCart-Daten werden bald angebunden" sub="Verk&auml;ufe, Umsatz, Conversion Rate" />
          </Card>

          <SectionTitle>OnePage</SectionTitle>
          <Card>
            <EmptyState icon={'\uD83C\uDF10'} text="OnePage-Daten werden bald angebunden" sub="Seitenbesucher, Conversions, Opt-in Rate" />
          </Card>
        </div>
      )}

      {/* ===== FINANZEN TAB ===== */}
      {activeTab === 'finanzen' && (
        <div style={{ padding: '16px' }}>
          <SectionTitle first>Umsatz&uuml;bersicht</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            <KpiCard label="Umsatz MTD" value={fmtEuro(data.revenueMTD)} valueColor="var(--color-accent-green)" sub={`${data.currentMonthName} ${data.currentYear}`} />
            <KpiCard label="Umsatz gesamt" value={fmtEuro(data.totalRevenue)} sub={`${data.wonTotal} Won Deals`} />
            <KpiCard label="Offene RG" value="—" sub="Easybill" />
            <KpiCard label="Kontostand" value="—" sub="Qonto" />
          </div>

          <SectionTitle>Monatsverlauf — Won Revenue</SectionTitle>
          <Card>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '6px', height: '160px', padding: '0 4px' }}>
              {data.monthlyChartData.map((m, i) => {
                const heightPct = maxMonthly > 0 ? Math.max((m.value / maxMonthly) * 100, 1) : 0
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ fontSize: '9px', fontWeight: 600, marginBottom: '2px' }}>
                      {m.value >= 1000 ? `\u20AC${Math.round(m.value / 1000)}k` : fmtEuro(m.value)}
                    </div>
                    <div style={{
                      width: '100%', minWidth: '24px', maxWidth: '50px', borderRadius: '4px 4px 0 0',
                      transition: 'height 0.5s ease',
                      height: animatedBars ? `${heightPct}%` : '0',
                      background: m.isCurrent
                        ? 'linear-gradient(180deg, #fbbf24, #fcd34d)'
                        : 'linear-gradient(180deg, #34d399, #51e0b8)',
                    }} />
                    <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '4px' }}>{m.label}</div>
                  </div>
                )
              })}
            </div>
          </Card>

          <SectionTitle>Forecast</SectionTitle>
          <Card>
            <MetricRow label={`${data.currentMonthName} MTD (${data.currentDay} Tage)`} value={fmtEuro(data.revenueMTD)} color="var(--color-accent-green)" />
            <MetricRow label={`Forecast ${data.currentMonthName} (linear)`} value={fmtEuro(data.linearForecast)} color="var(--color-accent-blue)" />
            <MetricRow label="Forecast + Pipeline" value={fmtEuro(data.pipelineWeightedForecast)} color="var(--color-accent-green)" />
            <MetricRow label="Pipeline Value (aktiv)" value={fmtEuro(data.pipelineValue)} />
            <MetricRow label="Avg. Monat (letzten 3)" value={fmtEuro(data.avg3Months)} last />
          </Card>

          <SectionTitle>Easybill</SectionTitle>
          <Card>
            <EmptyState icon={'\uD83D\uDCC4'} text="Easybill-Daten werden bald angebunden" sub="Rechnungen, Zahlungsstatus, Mahnwesen" />
          </Card>

          <SectionTitle>Qonto</SectionTitle>
          <Card>
            <EmptyState icon={'\uD83C\uDFE6'} text="Qonto-Daten werden bald angebunden" sub="Kontostand, Transaktionen, Cashflow" />
          </Card>
        </div>
      )}

      {/* ===== TEAM TAB ===== */}
      {activeTab === 'team' && (
        <div style={{ padding: '16px' }}>
          <SectionTitle first>Team-&Uuml;bersicht</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            <KpiCard label="Offene Tasks" value="—" sub="Monday.com" />
            <KpiCard label="Erledigt KW" value="—" sub="Diese Woche" />
            <KpiCard label={'\u00DCberf\u00e4llig'} value="—" valueColor="var(--color-accent-red)" sub="Past Due" />
            <KpiCard label="Boards" value="—" sub="Aktive Boards" />
          </div>

          <SectionTitle>Sales Team — Close CRM</SectionTitle>
          <Card>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Team Members</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '13px' }}>Felix Zoepp (Closer)</div>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>felix@content-leads.de</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: '13px' }}>John Santillan (Opener)</div>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>opener1@content-leads.de</div>
            </div>
          </Card>

          <SectionTitle>Boards &amp; Projekte</SectionTitle>
          <Card>
            <EmptyState icon={'\uD83D\uDCCB'} text="Monday.com Boards werden beim n\u00e4chsten Update geladen" sub="Board-Status, Fortschritt, Team-Zuteilung" />
          </Card>

          <SectionTitle>Team-Auslastung</SectionTitle>
          <Card>
            <EmptyState icon={'\uD83D\uDC65'} text="Team-Daten werden beim n\u00e4chsten Update geladen" sub="Tasks pro Person, Workload-Verteilung" />
          </Card>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '20px', fontSize: '11px', color: 'var(--color-text-muted)', opacity: 0.5, borderTop: '1px solid var(--color-border)', marginTop: '20px' }}>
        Content Leads Admin Dashboard — Daten aus Close CRM<br />
        <span>Letzte Aktualisierung: {data.currentDate} | Quelle: Close CRM API</span>
      </div>
    </div>
  )
}

// Sub-components

function KpiCard({ label, value, sub, valueColor }: { label: string; value: string; sub: React.ReactNode; valueColor?: string }) {
  return (
    <div style={{
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border)',
      borderRadius: '10px',
      padding: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    }}>
      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 700, lineHeight: 1, color: valueColor || 'var(--color-text-primary)' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>{sub}</div>
    </div>
  )
}

function SectionTitle({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div style={{ fontSize: '16px', fontWeight: 600, margin: first ? '4px 0 12px 0' : '20px 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
      {children}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border)',
      borderRadius: '10px',
      padding: '16px',
      marginBottom: '12px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    }}>
      {children}
    </div>
  )
}

function EmptyState({ icon, text, sub }: { icon: string; text: string; sub: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--color-text-muted)' }}>
      <div style={{ fontSize: '36px', marginBottom: '10px' }}>{icon}</div>
      <div style={{ fontSize: '13px', marginBottom: '4px' }}>{text}</div>
      <div style={{ fontSize: '11px', opacity: 0.7 }}>{sub}</div>
    </div>
  )
}

function PlatformCard({ icon, name, stats }: { icon: string; name: string; stats: { label: string; value: string }[] }) {
  return (
    <div style={{
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border)',
      borderRadius: '10px',
      padding: '14px',
      marginBottom: '10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '14px', fontWeight: 600 }}>
        {icon} {name}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {stats.map((s, i) => (
          <div key={i} style={{ background: 'var(--color-bg-primary)', borderRadius: '6px', padding: '8px 10px' }}>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{s.label}</div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricRow({ label, value, color, last }: { label: string; value: string; color?: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: last ? 'none' : '1px solid var(--color-border)' }}>
      <div style={{ fontSize: '13px' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: color || 'var(--color-text-primary)' }}>{value}</div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 8px',
  textAlign: 'left',
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  fontSize: '10px',
  letterSpacing: '0.5px',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 8px',
  color: 'var(--color-text-primary)',
  whiteSpace: 'nowrap',
}
