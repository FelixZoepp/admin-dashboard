'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────
interface StatusTransition {
  fromLabel: string
  toLabel: string
  count: number
}

interface PipelineQuality {
  settingTransitions: StatusTransition[]
  settingTotal: number
  settingNoShowCount: number
  settingNoShowRate: number
  settingToClosingCount: number
  settingToClosingRate: number
  settingLostCount: number
  settingLostRate: number
  settingFollowUpCount: number
  settingFollowUpRate: number
  closingTransitions: StatusTransition[]
  closingTotal: number
  closingNoShowCount: number
  closingNoShowRate: number
  closingWonCount: number
  closingWonRate: number
  closingLostCount: number
  closingLostRate: number
  closingFollowUpCount: number
  closingFollowUpRate: number
  closingAngebotCount: number
  closingCC2Count: number
  angebotWonCount: number
  cc2WonCount: number
  noShowRecovery: StatusTransition[]
}

interface FunnelPeriod {
  anwahlen: number
  gatekeeperErreicht: number
  entscheiderErreicht: number
  coldCalls: number
  followUps: number
  settingsGelegt: number
  closingsGelegt: number
  wonDeals: number
  wonRevenue: number
  erstdeals: number
  upsells: number
  erstdealRevenue: number
  upsellRevenue: number
  upsellRate: number
}

interface TeamMemberPerformance {
  name: string
  role: 'opener' | 'setter' | 'closer' | 'opener+setter' | 'setter+closer' | 'all'
  calls: number
  coldCallProtocols: number
  followUpProtocols: number
  gatekeeperErreicht: number
  entscheiderErreicht: number
  settingsGelegt: number
  closingsGelegt: number
  callsPerEntscheider: number
  callsPerSetting: number
}

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
  pipelineNeukunde: { leadName: string; status: string; value: number; date: string }[]
  pipelineBestandskunde: { leadName: string; status: string; value: number; date: string }[]
  pipelineNeukundeValue: number
  pipelineBestandskundeValue: number
  upsellDealsList: { leadName: string; value: number; date: string }[]
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
  nilsMetrics: {
    totalSoll: number
    totalIst: number
    differenz: number
    daysWorked: number
    avgHoursPerDay: number
    urlaubDays: number
    krankDays: number
    fehlendDays: number
    costPerMonth: number
    costPerHour: number
    costPerDay: number
    months: {
      month: string
      monthLabel: string
      sollHours: number
      istHours: number
      erfuellungPct: number
      daysWorked: number
      avgHoursPerDay: number
      urlaub: number
      krank: number
      fehlend: number
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
    weekCanceledSettings: number
    weekCanceledClosings: number
    monthCanceledSettings: number
    monthCanceledClosings: number
  }
  salesFunnel: {
    today: FunnelPeriod
    week: FunnelPeriod
    month: FunnelPeriod
    alltime: FunnelPeriod
    quoten: {
      gatekeeperQuote: number
      erreichquote: number
      settingQuote: number
      closingQuote: number
      abschlussQuote: number
      overallAnwahlenToWon: number
    }
    quotenAllTime: {
      gatekeeperQuote: number
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
  entscheiderOutcomesToday: Record<string, number>
  entscheiderOutcomesWeek: Record<string, number>
  entscheiderOutcomesMonth: Record<string, number>
  entscheiderOutcomesYear: Record<string, number>
  einwandToday: Record<string, number>
  einwandWeek: Record<string, number>
  einwandMonth: Record<string, number>
  einwandYear: Record<string, number>
  settingOutcomesToday: Record<string, number>
  settingOutcomesWeek: Record<string, number>
  settingOutcomesMonth: Record<string, number>
  settingOutcomesYear: Record<string, number>
  settingProtocolsMonth: number
  settingProtocolsWeek: number
  pipelineQualityAllTime: PipelineQuality
  pipelineQualityWeek: PipelineQuality
  pipelineQualityMonth: PipelineQuality
  teamPerformanceToday: TeamMemberPerformance[]
  teamPerformanceWeek: TeamMemberPerformance[]
  teamPerformanceMonth: TeamMemberPerformance[]
  teamPerformanceAllTime: TeamMemberPerformance[]
  funnelRatios: {
    anwahlenProEntscheider: number
    anwahlenProSetting: number
    settingsProClosing: number
    closingsProWon: number
    anwahlenProWon: number
    entscheiderProSetting: number
  }
  allWonDeals: { name: string; value: number; date: string; user: string }[]
  allLostDeals: { name: string; value: number; date: string }[]
  openerRevenue: { name: string; totalRevenue: number; mtdRevenue: number; dealCount: number; mtdDealCount: number; deals: { leadName: string; value: number; date: string }[] }[]
  openerRevenueTotal: number
  openerRevenueMTD: number
  openerQuality: any[]
  allCustomActivities: any[]
  customActivityTypeIds: any
  customFieldIds: any
  todayISO: string
  weekStartISO: string
  monthStartISO: string
  yearStartISO: string
  deliveryMetrics: {
    team: { name: string; role: string; hourlyRate: number; monthlyHours: number; monthlyCost: number }[]
    customers: {
      clId: string
      firma: string
      paket: string
      rateMonat: number
      cashInMonat: number
      billingDay: number
      status: string
      paymentStatus: 'zahlend' | 'streitfall'
      streitfallDetails: string
      streitfallGesamt: number
      delivery: {
        felixHours: number
        nilsHours: number
        marcelHours: number
        lisaHours: number
        tasks: string
        deliveryCost: number
        marginEuro: number
        marginPercent: number
      }
    }[]
    totalMRR: number
    totalDeliveryCost: number
    totalMargin: number
    avgMarginPercent: number
    totalHoursFelx: number
    totalHoursNils: number
    totalHoursMarcel: number
    totalHoursLisa: number
    totalTeamCost: number
    fixedCosts: { teamInklKK: number; toolsAmex: number; buchhaltung: number; total: number }
    totalFixedCosts: number
    netProfit: number
    netProfitPercent: number
    cashInMonatNetto: number
    cashInMonatBrutto: number
  }
  outreachMetrics: {
    available: boolean
    heyreach: {
      available: boolean
      connectionsSent: number; connectionsAccepted: number; connectionAcceptanceRate: number
      uniqueLeadsContacted: number; messagesSent: number; totalMessageStarted: number
      totalMessageReplies: number; inmailMessagesSent: number; profileViews: number
      postLikes: number; follows: number; replyRate: number
      dailyStats: { date: string; connectionsSent: number; connectionsAccepted: number; messagesSent: number; replies: number; profileViews: number }[]
      campaigns: { id: number; name: string; status: string; accountIds: number[]; progress: { totalUsers: number; inProgress: number; pending: number; finished: number } }[]
      accounts: { accountId: number; connectionsSent: number; connectionsAccepted: number; messagesSent: number; replies: number; uniqueLeadsContacted: number; acceptanceRate: number }[]
    }
    monday: {
      available: boolean
      totalLeads: number
      totalConnectionsSent: number
      funnel: Record<string, number>
      phases: Record<string, number>
      milestones: { angenommen: number; geantwortet: number; termin: number }
      members: {
        name: string; totalLeads: number; anfrageGesendet: number; angenommen: number
        erstnachrichtGesendet: number; geantwortet: number; callGebucht: number; keinInteresse: number
      }[]
      recentActivity: {
        name: string; company: string | null; status: string; statusColor: string
        updatedAt: string; assignee: string | null; group: string
      }[]
    }
    rates: {
      acceptanceRate: number; replyRate: number; bookingRate: number; overallConversion: number
    }
  }
  marketingMetrics: {
    available: boolean
    platforms: Record<string, { source: string; metrics: Record<string, any>; recorded_at: string }>
    kpis: { postsThisWeek: number; impressions: number; engagement: number; leadsViaMarketing: number }
    history: { source: string; metrics: Record<string, any>; recorded_at: string }[]
    perspective: {
      totalLeads: number; completedLeads: number; convertedLeads: number; conversionRate: number
      funnels: { name: string; leads: number; completed: number; converted: number }[]
      recentLeads: { funnel_name: string; name: string | null; email: string | null; completed: boolean; converted: boolean; recorded_at: string }[]
    }
    perspectiveByCampaign: { campaignId: string; leads: number; converted: number; completed: number; creatives: Record<string, number> }[]
  }
  facebookMetrics: {
    available: boolean
    period: { start: string; end: string }
    previousPeriod: { start: string; end: string } | null
    campaigns: {
      name: string; status: string; results: number; resultType: string
      reach: number; frequency: number; costPerResult: number; budget: number
      spend: number; impressions: number; cpm: number; linkClicks: number
      cpc: number; ctr: number; allClicks: number; landingPageViews: number
      videoViews3s: number; thruPlays: number
    }[]
    totals: { spend: number; impressions: number; reach: number; linkClicks: number; leads: number; cpl: number; ctr: number; cpm: number; landingPageViews: number }
    previousTotals: { spend: number; impressions: number; reach: number; linkClicks: number; leads: number; cpl: number; ctr: number; cpm: number; landingPageViews: number } | null
  }
  callAnalysisMetrics: {
    available: boolean
    latest: {
      date: string; opener_name: string; opener_user_id: string
      total_calls: number; calls_with_transcript: number; total_call_minutes: number
      skript_treue_score: number; tonalitaet_score: number; einwandbehandlung_score: number
      gespraechsfuehrung_score: number; overall_score: number
      analysis_text: string; strengths: string; weaknesses: string; patterns: string; recommendations: string
      call_summaries: { call_nr: number; note: string }[]
    }[]
    history: {
      date: string; opener_name: string; opener_user_id: string
      total_calls: number; calls_with_transcript: number; total_call_minutes: number
      skript_treue_score: number; tonalitaet_score: number; einwandbehandlung_score: number
      gespraechsfuehrung_score: number; overall_score: number
      analysis_text: string; strengths: string; weaknesses: string; patterns: string; recommendations: string
      call_summaries: { call_nr: number; note: string }[]
    }[]
    avgScores: Record<string, {
      skriptTreue: number; tonalitaet: number; einwandbehandlung: number
      gespraechsfuehrung: number; overall: number; totalCalls: number; totalDays: number
    }>
  }
  openerTracking: {
    openers: {
      name: string
      startDate: string
      targetTermine: number
      maxDays: number
      totalTermine: number
      dailyLog: { date: string; count: number; fruehbonus: boolean; bonus: { base: number; fruehbonus: number; total: number } }[]
      daysElapsed: number
      daysRemaining: number
      deadlineDate: string
      termineRemaining: number
      requiredPerDay: number
      onTrack: boolean
      progressPercent: number
      completed: boolean
      totalBonus: number
    }[]
    lastUpdated: string
  }
  eodReports: {
    vertriebler: {
      name: string
      reports: { date: string; accountable: number | null; performanceSatisfaction: number | null; onTrackWeekly: number | null; onTrackMonthly: number | null; tipsApplied: number | null; gesamtReview: string; reviewCallArt: string; status: string }[]
      avgAccountable: number
      avgPerformance: number
      avgOnTrackWeekly: number
      avgOnTrackMonthly: number
      avgTipsApplied: number
      overallAvg: number
      trend7d: number
      totalReports: number
    }[]
    lastUpdated: string
  }
  airtableCashIn: {
    nonPaying: { kundenId: string; firma: string; paket: string; rateMonat: number; reason: string; offenerBetrag: number }[]
    months: {
      month: number
      year: number
      label: string
      customers: { kundenId: string; firma: string; paket: string; cashInNetto: number; umsatztyp: string; isSetup: boolean }[]
      totalNetto: number
      totalBrutto: number
    }[]
    lastUpdated: string
  }
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
  { id: 'outreach', label: 'Outreach', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
  { id: 'sales', label: 'Sales', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-5"/></svg> },
  { id: 'fulfillment', label: 'Fulfillment', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> },
  { id: 'marketing', label: 'Marketing', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg> },
  { id: 'finanzen', label: 'Finanzen', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2.5 0 00-2.5-1h-1a2 2 0 000 4h2a2 2 0 010 4h-1a2.5 2.5 0 01-2.5-1M12 5.5v1M12 17.5v1"/></svg> },
  { id: 'kunden', label: 'Kunden', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg> },
  { id: 'recruiting', label: 'Recruiting', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><path d="M12 12v4"/><path d="M10 14h4"/></svg> },
  { id: 'team', label: 'Team', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
  { id: 'call-analyse', label: 'Call-Analyse', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><path d="M12 19v4"/><path d="M8 23h8"/></svg> },
]

// Sub-sections per tab for quick navigation
const TAB_SECTIONS: Record<string, { id: string; label: string }[]> = {
  outreach: [
    { id: 'sec-outreach-funnel', label: 'Funnel' },
    { id: 'sec-outreach-leaderboard', label: 'Leaderboard' },
    { id: 'sec-outreach-heyreach', label: 'HeyReach Stats' },
    { id: 'sec-outreach-activity', label: 'Aktivitäten' },
  ],
  sales: [
    { id: 'sec-sales-funnel', label: 'Sales Funnel' },
    { id: 'sec-sales-pipeline-quality', label: 'Pipeline-Qualität' },
    { id: 'sec-sales-calendly', label: 'Calendly Termine' },
    { id: 'sec-sales-pipeline', label: 'Pipeline & Upsells' },
    { id: 'sec-sales-leaderboard', label: 'Leaderboard' },
    { id: 'sec-sales-won', label: 'Won Deals' },
    { id: 'sec-sales-leads', label: 'Lead Status' },
    { id: 'sec-sales-revenue', label: 'Revenue & Forecast' },
  ],
  fulfillment: [
    { id: 'sec-fulfillment-clockodo', label: 'Zeiterfassung' },
    { id: 'sec-fulfillment-monday', label: 'Monday Tasks' },
    { id: 'sec-fulfillment-analyse', label: 'Analyse' },
  ],
  marketing: [
    { id: 'sec-marketing-facebook', label: 'Facebook Ads' },
    { id: 'sec-marketing-overview', label: 'Übersicht' },
  ],
  finanzen: [
    { id: 'sec-finanzen-overview', label: 'Übersicht' },
    { id: 'sec-finanzen-kunden', label: 'Kunden-P&L' },
    { id: 'sec-finanzen-nichtzahler', label: 'Nicht-Zahler' },
    { id: 'sec-finanzen-team', label: 'Team-Kosten' },
  ],
  kunden: [
    { id: 'sec-kunden-overview', label: 'Übersicht' },
  ],
  team: [
    { id: 'sec-team-quality', label: 'Opener Qualität' },
    { id: 'sec-team-umsatz', label: 'Opener Umsatz' },
    { id: 'sec-team-aufstieg', label: 'Opener Aufstieg' },
    { id: 'sec-team-eod', label: 'EOD Self-Assessment' },
  ],
}

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
// CALL-ANALYSE PANEL (own state: opener tabs, period)
// ══════════════════════════════════════════════════════════════

function CallAnalysePanel({ data }: { data: DashboardData }) {
  const cam = data.callAnalysisMetrics
  const [selectedOpener, setSelectedOpener] = useState<string>('all')

  if (!cam || !cam.available) {
    return (
      <div className="za-panel fade-up" style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', color: 'var(--za-fg-3)', marginBottom: '8px' }}>Noch keine Call-Analyse vorhanden</div>
        <div style={{ fontSize: '13px', color: 'var(--za-fg-4)' }}>Die t&auml;gliche Analyse l&auml;uft automatisch um 18:30 Uhr.</div>
      </div>
    )
  }

  const scoreColor = (s: number) => s >= 8 ? 'var(--za-success)' : s >= 6 ? 'var(--za-info)' : s >= 4 ? 'var(--za-gold-2)' : 'var(--za-danger)'

  const scoreBar = (score: number, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      <div style={{ width: '130px', fontSize: '11px', color: 'var(--za-fg-3)', textAlign: 'right' }}>{label}</div>
      <div style={{ flex: 1, height: '18px', background: 'rgba(249,249,249,0.04)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${score * 10}%`, height: '100%', background: scoreColor(score), borderRadius: '4px', transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ fontFamily: 'var(--za-serif)', fontSize: '14px', fontWeight: 700, color: scoreColor(score), width: '32px', textAlign: 'right' }}>{score}/10</div>
    </div>
  )

  const openerNames = [...new Set(cam.history.map(h => h.opener_name))]
  const openerTabs = [{ key: 'all', label: 'Alle' }, ...openerNames.map(n => ({ key: n, label: n.split(' ')[0] }))]

  // Filter data by selected opener
  const filteredLatest = selectedOpener === 'all' ? cam.latest : cam.latest.filter(e => e.opener_name === selectedOpener)
  const filteredHistory = selectedOpener === 'all' ? cam.history : cam.history.filter(e => e.opener_name === selectedOpener)

  // Score trend chart (SVG line chart)
  const TrendChart = ({ entries, metric, label, color }: { entries: typeof cam.history; metric: keyof typeof cam.history[0]; label: string; color: string }) => {
    const sorted = [...entries].filter(e => (e[metric] as number) > 0).reverse()
    if (sorted.length < 2) return null
    const values = sorted.map(e => e[metric] as number)
    const w = 400, h = 100, pad = 20
    const maxV = 10, minV = 0
    const step = (w - pad * 2) / (values.length - 1)
    const pts = values.map((v, i) => `${pad + i * step},${pad + (1 - (v - minV) / (maxV - minV)) * (h - pad * 2)}`)
    const dates = sorted.map(e => e.date.substring(5))

    return (
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{label}</div>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '80px' }}>
          {/* Grid lines */}
          {[2, 4, 6, 8].map(v => (
            <line key={v} x1={pad} x2={w - pad} y1={pad + (1 - v / 10) * (h - pad * 2)} y2={pad + (1 - v / 10) * (h - pad * 2)} stroke="rgba(249,249,249,0.06)" strokeWidth="0.5" />
          ))}
          {/* Line */}
          <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          {/* Dots */}
          {pts.map((p, i) => {
            const [x, y] = p.split(',').map(Number)
            return <circle key={i} cx={x} cy={y} r="3" fill={color} />
          })}
          {/* Labels */}
          {dates.map((d, i) => {
            if (dates.length > 10 && i % 2 !== 0) return null
            return <text key={i} x={pad + i * step} y={h - 2} textAnchor="middle" fill="rgba(249,249,249,0.3)" fontSize="7">{d}</text>
          })}
          {/* Y labels */}
          {[0, 5, 10].map(v => (
            <text key={v} x={pad - 6} y={pad + (1 - v / 10) * (h - pad * 2) + 3} textAnchor="end" fill="rgba(249,249,249,0.3)" fontSize="7">{v}</text>
          ))}
        </svg>
      </div>
    )
  }

  return (
    <>
      {/* Opener Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        {openerTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setSelectedOpener(tab.key)}
            style={{
              padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
              border: selectedOpener === tab.key ? '1px solid var(--za-violet)' : '1px solid rgba(249,249,249,0.1)',
              background: selectedOpener === tab.key ? 'rgba(124,92,191,0.15)' : 'rgba(249,249,249,0.04)',
              color: selectedOpener === tab.key ? 'var(--za-violet)' : 'var(--za-fg-3)',
              fontSize: '13px', fontWeight: 600,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Latest Analysis Cards per Opener */}
      <div style={{ display: 'grid', gridTemplateColumns: filteredLatest.length > 1 ? 'repeat(2, 1fr)' : '1fr', gap: '16px', marginBottom: '16px' }}>
        {filteredLatest.map((entry, i) => (
          <div key={i} className="za-panel fade-up" style={{ animationDelay: `${i * 80}ms`, borderTop: `2px solid ${scoreColor(entry.overall_score)}`, padding: '24px' }}>
            <div className="panel-head" style={{ marginBottom: '16px' }}>
              <div>
                <span className="panel-eyebrow" style={{ color: scoreColor(entry.overall_score) }}>{entry.opener_name}</span>
                <div className="panel-title" style={{ fontSize: '16px' }}>
                  {entry.date} &mdash; {entry.total_calls} Calls ({entry.calls_with_transcript} transkribiert)
                </div>
              </div>
              <div style={{ fontFamily: 'var(--za-serif)', fontSize: '28px', fontWeight: 700, color: scoreColor(entry.overall_score) }}>
                {entry.overall_score}/10
              </div>
            </div>

            {scoreBar(entry.skript_treue_score, 'Skript-Treue')}
            {scoreBar(entry.tonalitaet_score, 'Tonalit\u00e4t')}
            {scoreBar(entry.einwandbehandlung_score, 'Einwandbehandlung')}
            {scoreBar(entry.gespraechsfuehrung_score, 'Gespr\u00e4chsf\u00fchrung')}

            {entry.analysis_text && (
              <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(249,249,249,0.03)', borderRadius: '8px', fontSize: '13px', color: 'var(--za-fg-2)', lineHeight: 1.6 }}>
                {entry.analysis_text}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
              {entry.strengths && (
                <div style={{ padding: '12px', background: 'rgba(78,138,107,0.06)', borderRadius: '8px', borderLeft: '3px solid var(--za-success)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--za-success)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>St\u00e4rken</div>
                  <div style={{ fontSize: '12px', color: 'var(--za-fg-2)', lineHeight: 1.5 }}>{entry.strengths}</div>
                </div>
              )}
              {entry.weaknesses && (
                <div style={{ padding: '12px', background: 'rgba(192,57,43,0.06)', borderRadius: '8px', borderLeft: '3px solid var(--za-danger)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--za-danger)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Schw\u00e4chen</div>
                  <div style={{ fontSize: '12px', color: 'var(--za-fg-2)', lineHeight: 1.5 }}>{entry.weaknesses}</div>
                </div>
              )}
            </div>

            {entry.recommendations && (
              <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(59,130,246,0.06)', borderRadius: '8px', borderLeft: '3px solid var(--za-info)' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--za-info)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Morgen \u00fcben</div>
                <div style={{ fontSize: '12px', color: 'var(--za-fg-2)', lineHeight: 1.5 }}>{entry.recommendations}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Score Trend Graphs */}
      {filteredHistory.length >= 2 && (
        <div className="za-panel fade-up" style={{ animationDelay: '160ms', marginBottom: '16px', padding: '24px' }}>
          <div className="panel-head" style={{ marginBottom: '16px' }}>
            <div>
              <span className="panel-eyebrow" style={{ color: 'var(--za-gold-2)' }}>Score-Verlauf</span>
              <div className="panel-title" style={{ fontSize: '16px' }}>
                Performance &uuml;ber Zeit {selectedOpener !== 'all' ? `\u2014 ${selectedOpener}` : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <TrendChart entries={filteredHistory} metric="overall_score" label="Gesamt" color="var(--za-gold-2)" />
            <TrendChart entries={filteredHistory} metric="skript_treue_score" label="Skript-Treue" color="var(--za-info)" />
            <TrendChart entries={filteredHistory} metric="tonalitaet_score" label="Tonalit\u00e4t" color="var(--za-violet)" />
            <TrendChart entries={filteredHistory} metric="einwandbehandlung_score" label="Einwandbehandlung" color="var(--za-danger)" />
          </div>
        </div>
      )}

      {/* Vergleichstabelle */}
      {Object.keys(cam.avgScores).length > 0 && selectedOpener === 'all' && (
        <div className="za-panel fade-up" style={{ animationDelay: '240ms', marginBottom: '16px', padding: '24px' }}>
          <div className="panel-head" style={{ marginBottom: '16px' }}>
            <div>
              <span className="panel-eyebrow" style={{ color: 'var(--za-gold-2)' }}>30-Tage Durchschnitt</span>
              <div className="panel-title" style={{ fontSize: '16px' }}>Opener im Vergleich</div>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(249,249,249,0.1)' }}>
                  {['Opener', 'Tage', 'Calls', 'Skript', 'Tonalit\u00e4t', 'Einw\u00e4nde', 'F\u00fchrung', 'Gesamt'].map((h, j) => (
                    <th key={j} style={{ padding: '8px 10px', textAlign: j === 0 ? 'left' : 'right', fontSize: '10px', fontWeight: 700, color: 'var(--za-fg-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(cam.avgScores).map(([name, scores], j) => (
                  <tr key={j} style={{ borderBottom: '1px solid rgba(249,249,249,0.05)', cursor: 'pointer' }} onClick={() => setSelectedOpener(name)}>
                    <td style={{ padding: '10px', fontWeight: 600, color: '#fff' }}>{name}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: 'var(--za-fg-3)' }}>{scores.totalDays}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--za-serif)', fontWeight: 700 }}>{fmtNum(scores.totalCalls)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--za-serif)', fontWeight: 700, color: scoreColor(scores.skriptTreue) }}>{scores.skriptTreue}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--za-serif)', fontWeight: 700, color: scoreColor(scores.tonalitaet) }}>{scores.tonalitaet}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--za-serif)', fontWeight: 700, color: scoreColor(scores.einwandbehandlung) }}>{scores.einwandbehandlung}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--za-serif)', fontWeight: 700, color: scoreColor(scores.gespraechsfuehrung) }}>{scores.gespraechsfuehrung}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--za-serif)', fontSize: '16px', fontWeight: 700, color: scoreColor(scores.overall) }}>{scores.overall}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tageshistorie */}
      {filteredHistory.length > 0 && (
        <div className="za-panel fade-up" style={{ animationDelay: '320ms', marginBottom: '16px', padding: '24px' }}>
          <div className="panel-head" style={{ marginBottom: '16px' }}>
            <div>
              <span className="panel-eyebrow">Verlauf</span>
              <div className="panel-title" style={{ fontSize: '16px' }}>T&auml;gliche Analysen</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '400px', overflowY: 'auto' }}>
            {filteredHistory.map((entry, j) => (
              <div key={j} style={{
                display: 'grid', gridTemplateColumns: selectedOpener === 'all' ? '90px 140px 60px repeat(4, 50px) 60px' : '90px 60px repeat(4, 50px) 60px',
                alignItems: 'center', gap: '8px', padding: '8px 10px',
                background: j % 2 === 0 ? 'rgba(249,249,249,0.03)' : 'transparent',
                borderRadius: '6px',
              }}>
                <div style={{ fontSize: '12px', color: 'var(--za-fg-3)', fontFamily: 'var(--za-mono, monospace)' }}>{entry.date}</div>
                {selectedOpener === 'all' && <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{entry.opener_name.split(' ')[0]}</div>}
                <div style={{ fontSize: '11px', color: 'var(--za-fg-4)', textAlign: 'right' }}>{entry.total_calls} Calls</div>
                <div style={{ fontSize: '12px', textAlign: 'right', color: scoreColor(entry.skript_treue_score) }}>{entry.skript_treue_score}</div>
                <div style={{ fontSize: '12px', textAlign: 'right', color: scoreColor(entry.tonalitaet_score) }}>{entry.tonalitaet_score}</div>
                <div style={{ fontSize: '12px', textAlign: 'right', color: scoreColor(entry.einwandbehandlung_score) }}>{entry.einwandbehandlung_score}</div>
                <div style={{ fontSize: '12px', textAlign: 'right', color: scoreColor(entry.gespraechsfuehrung_score) }}>{entry.gespraechsfuehrung_score}</div>
                <div style={{ fontFamily: 'var(--za-serif)', fontSize: '14px', fontWeight: 700, textAlign: 'right', color: scoreColor(entry.overall_score) }}>{entry.overall_score}/10</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// OPENER PERFORMANCE PANEL (own period state)
// ══════════════════════════════════════════════════════════════

type OpenerPeriod = 'today' | 'week' | 'month' | 'alltime' | 'custom'

function OpenerPerformancePanel({ data }: { data: DashboardData }) {
  const [openerPeriod, setOpenerPeriod] = useState<OpenerPeriod>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [customData, setCustomData] = useState<{ team: TeamMemberPerformance[]; funnelRatios: typeof data.funnelRatios } | null>(null)
  const [customLoading, setCustomLoading] = useState(false)

  const periodMap: Record<Exclude<OpenerPeriod, 'custom'>, { team: TeamMemberPerformance[]; label: string }> = {
    today: { team: data.teamPerformanceToday, label: 'Heute' },
    week: { team: data.teamPerformanceWeek, label: 'Diese Woche' },
    month: { team: data.teamPerformanceMonth, label: 'Dieser Monat' },
    alltime: { team: data.teamPerformanceAllTime, label: `Gesamt ${new Date().getFullYear()}` },
  }

  // Fetch custom date range from API
  const fetchCustomRange = useCallback(async (from: string, to: string) => {
    if (!from) return
    setCustomLoading(true)
    try {
      const params = new URLSearchParams({ from })
      if (to) params.set('to', to)
      const res = await fetch(`/api/close/team-performance?${params}`)
      if (res.ok) {
        const result = await res.json()
        setCustomData({ team: result.team, funnelRatios: result.funnelRatios })
      }
    } catch {
      // ignore
    } finally {
      setCustomLoading(false)
    }
  }, [])

  // Trigger fetch when custom dates change
  useEffect(() => {
    if (openerPeriod === 'custom' && customFrom) {
      const timeout = setTimeout(() => fetchCustomRange(customFrom, customTo), 300)
      return () => clearTimeout(timeout)
    }
  }, [openerPeriod, customFrom, customTo, fetchCustomRange])

  let team: TeamMemberPerformance[]
  let periodLabel: string
  let fr = data.funnelRatios

  // Map openerPeriod to salesFunnel period key
  const funnelPeriodMap: Record<string, FunnelPeriod | undefined> = {
    today: data.salesFunnel.today,
    week: data.salesFunnel.week,
    month: data.salesFunnel.month,
    alltime: data.salesFunnel.alltime,
  }

  const computeRatios = (fp: FunnelPeriod) => {
    const r = (a: number, b: number) => b > 0 ? Math.round((a / b) * 10) / 10 : 0
    return {
      anwahlenProEntscheider: r(fp.anwahlen, fp.entscheiderErreicht),
      anwahlenProSetting: r(fp.anwahlen, fp.settingsGelegt),
      entscheiderProSetting: r(fp.entscheiderErreicht, fp.settingsGelegt),
      settingsProClosing: r(fp.settingsGelegt, fp.closingsGelegt),
      closingsProWon: r(fp.closingsGelegt, fp.wonDeals),
      anwahlenProWon: r(fp.anwahlen, fp.wonDeals),
    }
  }

  if (openerPeriod === 'custom') {
    if (customData) {
      team = customData.team
      fr = customData.funnelRatios
    } else {
      team = data.teamPerformanceMonth
    }
    periodLabel = customFrom ? `${customFrom}${customTo ? ` – ${customTo}` : ' – heute'}` : 'Zeitraum wählen'
  } else {
    const p = periodMap[openerPeriod]
    team = p.team
    periodLabel = p.label
    const fp = funnelPeriodMap[openerPeriod]
    if (fp) fr = computeRatios(fp)
  }

  if (!team || team.length === 0) return null

  const funnel = openerPeriod === 'custom'
    ? (funnelPeriodMap['month'] || data.salesFunnel.month)
    : (funnelPeriodMap[openerPeriod] || data.salesFunnel.month)

  const openers = team.filter(m => m.role === 'opener')

  const roleLabel = (r: string) => {
    switch (r) {
      case 'opener': return 'Opener'
      case 'setter': return 'Setter'
      case 'closer': return 'Closer'
      case 'setter+closer': return 'Setter + Closer'
      default: return r
    }
  }

  const roleColor = (r: string) => {
    switch (r) {
      case 'opener': return 'var(--za-info)'
      case 'setter+closer': return 'var(--za-violet)'
      default: return 'var(--za-gold-2)'
    }
  }

  const periodButtons: { key: OpenerPeriod; label: string }[] = [
    { key: 'today', label: 'Heute' },
    { key: 'week', label: 'Woche' },
    { key: 'month', label: 'Monat' },
    { key: 'alltime', label: 'Gesamt' },
    { key: 'custom', label: 'Custom' },
  ]

  return (
    <div className="za-panel fade-up" style={{ animationDelay: '485ms', marginBottom: '16px', borderTop: '2px solid var(--za-info)', padding: '24px' }}>
      <div className="panel-head" style={{ marginBottom: '16px' }}>
        <div>
          <span className="panel-eyebrow" style={{ color: 'var(--za-info)' }}>Team Performance</span>
          <div className="panel-title" style={{ fontSize: '18px' }}>
            Opener &amp; Setter &mdash; {periodLabel}{customLoading ? ' ...' : ''}
          </div>
        </div>
      </div>

      {/* Period Toggle */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        {periodButtons.map(pb => (
          <button
            key={pb.key}
            onClick={() => setOpenerPeriod(pb.key)}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: openerPeriod === pb.key ? '1px solid var(--za-info)' : '1px solid rgba(249,249,249,0.1)',
              background: openerPeriod === pb.key ? 'rgba(59,130,246,0.15)' : 'rgba(249,249,249,0.04)',
              color: openerPeriod === pb.key ? 'var(--za-info)' : 'var(--za-fg-3)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {pb.label}
          </button>
        ))}
        {openerPeriod === 'custom' && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: '8px' }}>
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              style={{
                padding: '5px 8px', borderRadius: '6px', border: '1px solid rgba(249,249,249,0.15)',
                background: 'rgba(249,249,249,0.06)', color: '#fff', fontSize: '12px',
              }}
            />
            <span style={{ color: 'var(--za-fg-4)', fontSize: '12px' }}>–</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              style={{
                padding: '5px 8px', borderRadius: '6px', border: '1px solid rgba(249,249,249,0.15)',
                background: 'rgba(249,249,249,0.06)', color: '#fff', fontSize: '12px',
              }}
            />
          </div>
        )}
      </div>

      {/* Funnel Step-by-Step Conversion */}
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--za-gold-2)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
        Funnel-Stufen ({periodLabel})
      </div>
      {(() => {
        const steps = [
          { label: 'Anwahlen', count: funnel.anwahlen, color: 'var(--za-fg-2)' },
          { label: 'Gatekeeper', count: funnel.gatekeeperErreicht || 0, color: '#f59e0b' },
          { label: 'Entscheider', count: funnel.entscheiderErreicht, color: 'var(--za-info)' },
          { label: 'Settings', count: funnel.settingsGelegt, color: 'var(--za-violet)' },
          { label: 'Closings', count: funnel.closingsGelegt, color: '#c084fc' },
          { label: 'Neukunden', count: funnel.erstdeals || 0, color: 'var(--za-success)' },
        ]
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {steps.map((step, i) => {
              const prevCount = i > 0 ? steps[i - 1].count : 0
              const rate = i > 0 && prevCount > 0 ? Math.round((step.count / prevCount) * 1000) / 10 : null
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {i > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 2px' }}>
                      <span style={{ fontSize: '14px', color: 'var(--za-fg-4)' }}>&rarr;</span>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: rate && rate >= 20 ? 'var(--za-success)' : rate && rate >= 10 ? 'var(--za-gold)' : 'var(--za-danger)', marginTop: '-2px' }}>
                        {rate !== null ? `${rate}%` : '-'}
                      </span>
                    </div>
                  )}
                  <div style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    background: `color-mix(in srgb, ${step.color} 10%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${step.color} 25%, transparent)`,
                    textAlign: 'center',
                    minWidth: '80px',
                  }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--za-serif)', color: step.color }}>{fmtNum(step.count)}</div>
                    <div style={{ fontSize: '10px', color: 'var(--za-fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>{step.label}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Funnel Efficiency Ratios */}
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--za-gold-2)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
        Effizienz-Kennzahlen ({periodLabel})
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
        {[
          { label: 'Gatekeeper-Rate', value: `${funnel.anwahlen > 0 ? Math.round(((funnel.gatekeeperErreicht || 0) / funnel.anwahlen) * 1000) / 10 : 0}%`, sub: 'Jemand hat abgenommen', color: '#f59e0b' },
          { label: 'Entscheider-Rate', value: `${funnel.anwahlen > 0 ? Math.round((funnel.entscheiderErreicht / funnel.anwahlen) * 1000) / 10 : 0}%`, sub: 'Entscheider am Telefon', color: 'var(--za-info)' },
          { label: 'Terminierungs-Rate', value: `${funnel.entscheiderErreicht > 0 ? Math.round((funnel.settingsGelegt / funnel.entscheiderErreicht) * 1000) / 10 : 0}%`, sub: 'Entscheider zu Setting', color: 'var(--za-violet)' },
          { label: 'Calls pro Setting', value: `${fr.anwahlenProSetting}x`, sub: 'Anwahlen pro Termin', color: 'var(--za-fg-2)' },
          { label: 'Closing-Rate', value: `${funnel.settingsGelegt > 0 ? Math.round((funnel.closingsGelegt / funnel.settingsGelegt) * 1000) / 10 : 0}%`, sub: 'Setting zu Closing', color: '#c084fc' },
          { label: 'Neukunden-Rate', value: `${funnel.closingsGelegt > 0 ? Math.round(((funnel.erstdeals || 0) / funnel.closingsGelegt) * 1000) / 10 : 0}%`, sub: 'Closing zu Neukunde', color: 'var(--za-success)' },
          ...(funnel.upsells > 0 ? [{ label: 'Upsells', value: `${funnel.upsells}`, sub: `${funnel.upsellRate || 0}% der Abschlüsse`, color: 'var(--za-gold)' }] : []),
        ].map((kpi, i) => (
          <div key={i} style={{ padding: '12px', background: 'rgba(249,249,249,0.03)', borderRadius: '8px', borderLeft: `3px solid ${kpi.color}` }}>
            <div style={{ fontSize: '10px', color: 'var(--za-fg-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>{kpi.label}</div>
            <div style={{ fontFamily: 'var(--za-serif)', fontSize: '20px', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--za-fg-4)', marginTop: '1px' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Per-member table */}
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--za-info)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
        Performance pro Teammitglied
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(249,249,249,0.1)' }}>
              {['Name', 'Rolle', 'Anwahlen', 'Gatekeeper', 'Entscheider', 'Settings', 'Closings', 'Calls/Entsch.', 'Calls/Setting'].map((h, i) => (
                <th key={i} style={{ padding: '8px 10px', textAlign: i < 2 ? 'left' : 'right', fontSize: '10px', fontWeight: 700, color: 'var(--za-fg-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {team.map((m, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(249,249,249,0.05)' }}>
                <td style={{ padding: '10px', fontWeight: 600, color: '#fff' }}>{m.name}</td>
                <td style={{ padding: '10px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 8px', borderRadius: '8px', background: `color-mix(in srgb, ${roleColor(m.role)} 15%, transparent)`, color: roleColor(m.role) }}>
                    {roleLabel(m.role)}
                  </span>
                </td>
                <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--za-serif)', fontWeight: 700 }}>{fmtNum(m.calls)}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--za-serif)', fontWeight: 700, color: '#f59e0b' }}>{fmtNum(m.gatekeeperErreicht)}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--za-serif)', fontWeight: 700 }}>{fmtNum(m.entscheiderErreicht)}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--za-serif)', fontWeight: 700, color: 'var(--za-info)' }}>{m.settingsGelegt}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--za-serif)', fontWeight: 700, color: 'var(--za-violet)' }}>{m.closingsGelegt}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--za-serif)', color: 'var(--za-fg-3)' }}>{m.callsPerEntscheider > 0 ? `${m.callsPerEntscheider}x` : '-'}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--za-serif)', color: 'var(--za-fg-3)' }}>{m.callsPerSetting > 0 ? `${m.callsPerSetting}x` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Opener highlight cards */}
      {openers.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--za-info)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
            Opener Detail
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(openers.length, 3)}, 1fr)`, gap: '12px' }}>
            {openers.map((op, i) => (
              <div key={i} style={{ padding: '16px', background: 'rgba(59,130,246,0.06)', borderRadius: '10px', border: '1px solid rgba(59,130,246,0.15)' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>{op.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { label: 'Anwahlen', value: fmtNum(op.calls) },
                    { label: 'Gatekeeper', value: fmtNum(op.gatekeeperErreicht), sub: op.calls > 0 ? `${Math.round((op.gatekeeperErreicht / op.calls) * 1000) / 10}%` : '-' },
                    { label: 'Entscheider', value: fmtNum(op.entscheiderErreicht), sub: op.gatekeeperErreicht > 0 ? `${Math.round((op.entscheiderErreicht / op.gatekeeperErreicht) * 1000) / 10}%` : '-' },
                    { label: 'Settings gelegt', value: String(op.settingsGelegt), sub: op.entscheiderErreicht > 0 ? `${Math.round((op.settingsGelegt / op.entscheiderErreicht) * 1000) / 10}%` : '-' },
                    { label: 'Calls/Setting', value: op.callsPerSetting > 0 ? `${op.callsPerSetting}x` : '-' },
                    { label: 'Protokolle', value: `${fmtNum(op.coldCallProtocols)} / ${fmtNum(op.followUpProtocols)}`, sub: 'CC / FU' },
                  ].map((stat: any, j: number) => (
                    <div key={j}>
                      <div style={{ fontSize: '10px', color: 'var(--za-fg-4)', textTransform: 'uppercase' }}>{stat.label}</div>
                      <div style={{ fontFamily: 'var(--za-serif)', fontSize: '16px', fontWeight: 700, color: '#fff' }}>{stat.value}</div>
                      {stat.sub && <div style={{ fontSize: '10px', color: 'var(--za-fg-4)', marginTop: '1px' }}>{stat.sub}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════

export default function Dashboard({ data }: { data: DashboardData }) {
  const [activeNav, setActiveNav] = useState('sales')
  const [activeSection, setActiveSection] = useState<string>('sec-sales-funnel')
  const [kundenSubTab, setKundenSubTab] = useState<'zahlend' | 'streitfaelle'>('zahlend')
  const [period, setPeriod] = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [customTo, setCustomTo] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth());
    const lastDay = new Date(d.getFullYear(), d.getMonth(), 0).getDate()
    const m = new Date(); m.setMonth(m.getMonth() - 1);
    return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  })
  const [useCustomRange, setUseCustomRange] = useState(false)

  const [finanzMonat, setFinanzMonat] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [expandedStatuses, setExpandedStatuses] = useState<Set<string>>(new Set())
  const [expandedLeadStatuses, setExpandedLeadStatuses] = useState<Set<string>>(new Set())
  const [outreachView, setOutreachView] = useState<'heyreach' | 'monday'>('heyreach')

  // Won Deal Celebration
  const [celebrationDeal, setCelebrationDeal] = useState<{ name: string; value: number; user: string; date: string } | null>(null)
  const [celebClosing, setCelebClosing] = useState(false)
  const celebShownRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const todayDeals = (data.allWonDeals || []).filter(d => d.date === data.todayISO)
    for (const deal of todayDeals) {
      const key = `${deal.name}-${deal.date}-${deal.value}`
      if (!celebShownRef.current.has(key)) {
        celebShownRef.current.add(key)
        setCelebrationDeal(deal)
        const timer = setTimeout(() => { setCelebClosing(true); setTimeout(() => { setCelebrationDeal(null); setCelebClosing(false) }, 500) }, 6000)
        return () => clearTimeout(timer)
      }
    }
  }, [data.allWonDeals, data.todayISO])

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
  const periodStart = useCustomRange ? customFrom
    : period === 'today' ? data.todayISO
    : period === 'week' ? data.weekStartISO
    : period === 'month' ? data.monthStartISO
    : data.yearStartISO
  const periodEnd = useCustomRange ? customTo + 'T23:59:59' : '9999-12-31'

  const filteredWon = (data.allWonDeals || []).filter(d => d.date >= periodStart && d.date <= periodEnd)
  const filteredLost = (data.allLostDeals || []).filter(d => d.date >= periodStart && d.date <= periodEnd)
  const periodRevenue = filteredWon.reduce((s, d) => s + d.value, 0)
  const periodLostValue = filteredLost.reduce((s, d) => s + d.value, 0)
  const periodClosedTotal = filteredWon.length + filteredLost.length
  const periodClosingRate = periodClosedTotal > 0 ? Math.round((filteredWon.length / periodClosedTotal) * 100) : 0

  // Anwahlen, Entscheider, Settings from salesFunnel (pre-computed in data.ts)
  const funnelPeriod = period === 'today' ? 'today' : period === 'week' ? 'week' : 'month'
  const periodFunnel = data.salesFunnel?.[funnelPeriod] || data.salesFunnel?.month || { anwahlen: 0, entscheiderErreicht: 0, settingsGelegt: 0 }
  const periodAnwahlen = periodFunnel.anwahlen || 0
  const periodEntscheider = periodFunnel.entscheiderErreicht || 0
  const periodSettings = periodFunnel.settingsGelegt || 0

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

  // Confetti generator
  const confettiColors = ['#C5A059', '#E9CB8B', '#7FC29B', '#8BB6E8', '#B49AE8', '#fff']
  const confettiPieces = celebrationDeal ? Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 2 + Math.random() * 2,
    color: confettiColors[i % confettiColors.length],
    size: 6 + Math.random() * 8,
    rotation: Math.random() * 360,
  })) : []

  return (
    <>
      {/* Won Deal Celebration Overlay */}
      {celebrationDeal && (
        <>
          <div className="confetti-container" aria-hidden="true">
            {confettiPieces.map(p => (
              <div key={p.id} className="confetti-piece" style={{
                left: `${p.left}%`,
                width: `${p.size}px`, height: `${p.size}px`,
                background: p.color,
                borderRadius: p.size > 10 ? '50%' : '2px',
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                transform: `rotate(${p.rotation}deg)`,
              }} />
            ))}
          </div>
          <div className={`celebration-overlay${celebClosing ? ' closing' : ''}`} onClick={() => { setCelebClosing(true); setTimeout(() => { setCelebrationDeal(null); setCelebClosing(false) }, 500) }}>
            <div className="celebration-card">
              <div className="celebration-trophy">&#127942;</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--za-gold)', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '8px' }}>Deal gewonnen!</div>
              <div className="celebration-amount">{fmtEuro(celebrationDeal.value)}</div>
              <div className="celebration-name">{celebrationDeal.name}</div>
              <div className="celebration-meta">Geschlossen von {celebrationDeal.user} &middot; {fmtDate(celebrationDeal.date)}</div>
              <div style={{ marginTop: '20px', fontSize: '11px', color: 'var(--za-fg-4)' }}>Klicken zum Schliessen</div>
            </div>
          </div>
        </>
      )}

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
              <React.Fragment key={item.id}>
                <a
                  className={`sb-item ${activeNav === item.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setActiveNav(item.id)
                    const sections = TAB_SECTIONS[item.id]
                    setActiveSection(sections ? sections[0].id : '')
                  }}
                >
                  {item.icon}
                  {item.label}
                </a>
                {activeNav === item.id && TAB_SECTIONS[item.id] && (
                  <div className="sb-subsections">
                    {TAB_SECTIONS[item.id].map(sec => (
                      <a
                        key={sec.id}
                        className={`sb-subitem ${activeSection === sec.id ? 'is-active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveSection(sec.id)
                        }}
                      >
                        {sec.label}
                      </a>
                    ))}
                  </div>
                )}
              </React.Fragment>
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
               TAB: OUTREACH
             ═══════════════════════════════════════════════════ */}
          {activeNav === 'outreach' && (() => {
            const om = data.outreachMetrics
            if (!om?.available) return (
              <div className="za-panel fade-up" style={{ padding: '48px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#128279;</div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>LinkedIn Outreach nicht verbunden</h3>
                <p style={{ fontSize: '13px', color: 'var(--za-fg-3)', maxWidth: '400px', margin: '0 auto' }}>
                  Setze <code>HEYREACH_API_KEY</code> und/oder <code>MONDAY_API_TOKEN</code> in den Vercel Environment Variables.
                </p>
              </div>
            )

            const hr = om.heyreach
            const mo = om.monday

            // Waterfall funnel — cumulative, each step = leads that reached this stage or beyond
            const f = mo.funnel
            const waterfallSteps = [
              { label: 'Anfrage gesendet', value: mo.totalConnectionsSent, color: '#9d50dd' },
              { label: 'Angenommen', value: (f['Angenommen'] || 0) + (f['Permission-Ja'] || 0) + (f['Erstnachricht gesendet'] || 0) + (f['Video bereit'] || 0) + (f['Video gesendet'] || 0) + (f['Angeschaut'] || 0) + (f['Geantwortet'] || 0) + (f['Call gebucht'] || 0), color: '#037f4c' },
              { label: 'Erstnachricht', value: (f['Erstnachricht gesendet'] || 0) + (f['Video bereit'] || 0) + (f['Video gesendet'] || 0) + (f['Angeschaut'] || 0) + (f['Geantwortet'] || 0) + (f['Call gebucht'] || 0), color: '#784bd1' },
              { label: 'Video gesendet', value: (f['Video gesendet'] || 0) + (f['Angeschaut'] || 0) + (f['Geantwortet'] || 0) + (f['Call gebucht'] || 0), color: '#cab641' },
              { label: 'Geantwortet', value: (f['Geantwortet'] || 0) + (f['Call gebucht'] || 0), color: '#ffcb00' },
              { label: 'Call gebucht', value: f['Call gebucht'] || 0, color: '#bb3354' },
            ]
            const maxFunnel = waterfallSteps[0]?.value || 1

            // Dropout rows
            const dropouts = [
              { label: 'Kein Interesse', value: f['Kein Interesse'] || 0, color: '#ff007f' },
              { label: 'Abgelehnt nach Erstnachricht', value: f['Abgelehnt nach Erstnachricht'] || 0, color: '#9cd326' },
            ]

            return (
            <>
              {/* Connection status badges */}
              <div className="fade-up" style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '4px', background: hr.available ? 'rgba(34,197,94,0.15)' : 'rgba(249,249,249,0.06)', color: hr.available ? '#4ade80' : 'var(--za-fg-3)' }}>
                  HeyReach {hr.available ? 'verbunden' : 'nicht verbunden'}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '4px', background: mo.available ? 'rgba(34,197,94,0.15)' : 'rgba(249,249,249,0.06)', color: mo.available ? '#4ade80' : 'var(--za-fg-3)' }}>
                  Monday.com {mo.available ? 'verbunden' : 'nicht verbunden'}
                </span>
              </div>

              {/* View switch: HeyReach / Monday */}
              <div className="view-switch" style={{ marginBottom: '16px' }}>
                <button className={outreachView === 'heyreach' ? 'is-active' : ''} onClick={() => setOutreachView('heyreach')}>HeyReach</button>
                <button className={outreachView === 'monday' ? 'is-active' : ''} onClick={() => setOutreachView('monday')}>Monday.com</button>
              </div>

              {/* ── HeyReach View ── */}
              {outreachView === 'heyreach' && (
              <>
              {/* Hero KPIs — HeyReach */}
              <div className="kpi-grid">
                <div className="za-panel fade-up" style={{ animationDelay: '60ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">Vernetzungen gesendet</span></div>
                  <div className="kpi-value">{fmtNum(hr.connectionsSent)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">HeyReach Automation</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '140ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">Angenommen</span></div>
                  <div className="kpi-value">{fmtNum(hr.connectionsAccepted)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">{hr.connectionAcceptanceRate}% Annahmerate</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '220ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">Nachrichten</span></div>
                  <div className="kpi-value">{fmtNum(hr.messagesSent)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">letzte 90 Tage</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '300ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">Antworten</span></div>
                  <div className="kpi-value">{fmtNum(hr.totalMessageReplies)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">{hr.replyRate}% Antwortrate</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '380ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">Leads kontaktiert</span></div>
                  <div className="kpi-value">{fmtNum(hr.uniqueLeadsContacted)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">Unique Leads</span></div>
                </div>
              </div>

              <div id="sec-outreach-funnel" style={{ display: activeSection === 'sec-outreach-funnel' || !activeSection ? undefined : 'none' }}>
              {/* HeyReach Waterfall: Leads → Connections → Accepted → Messages → Replies */}
              {hr.available && (() => {
                const hrWaterfallSteps = [
                  { label: 'Leads kontaktiert', value: hr.uniqueLeadsContacted, color: '#f59e0b' },
                  { label: 'Vernetzungen', value: hr.connectionsSent, color: '#9d50dd' },
                  { label: 'Angenommen', value: hr.connectionsAccepted, color: '#037f4c' },
                  { label: 'Nachrichten', value: hr.messagesSent, color: '#579bfc' },
                  { label: 'Antworten', value: hr.totalMessageReplies, color: '#4ade80' },
                ]
                const hrMaxFunnel = hrWaterfallSteps[0]?.value || 1
                return (
                  <div className="za-panel fade-up" style={{ animationDelay: '440ms', marginBottom: '16px' }}>
                    <div className="panel-head">
                      <div>
                        <span className="panel-eyebrow">HeyReach Waterfall</span>
                        <div className="panel-title">{fmtNum(hr.uniqueLeadsContacted)} Leads &rarr; {fmtNum(hr.connectionsAccepted)} Angenommen &rarr; {hr.totalMessageReplies} Antworten</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {hrWaterfallSteps.map((step, i) => {
                        const prevValue = i === 0 ? step.value : hrWaterfallSteps[i - 1].value
                        const convRate = i === 0 ? 100 : (prevValue > 0 ? Math.round((step.value / prevValue) * 1000) / 10 : 0)
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '130px', flexShrink: 0 }}>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--za-fg-2)' }}>{step.label}</div>
                              {i > 0 && <div style={{ fontSize: '10px', color: convRate >= 50 ? '#4ade80' : convRate >= 20 ? '#fbbf24' : '#f87171' }}>{convRate}% von {hrWaterfallSteps[i - 1].label}</div>}
                            </div>
                            <div style={{ flex: 1, height: '32px', position: 'relative' }}>
                              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(249,249,249,0.04)', borderRadius: '6px' }} />
                              <div style={{
                                width: `${Math.max((step.value / hrMaxFunnel) * 100, step.value > 0 ? 3 : 0)}%`,
                                height: '100%',
                                background: `linear-gradient(90deg, ${step.color}, ${step.color}cc)`,
                                borderRadius: '6px',
                                transition: 'width 0.8s ease',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                position: 'relative',
                              }}>
                                {step.value > 0 && <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{step.value}</span>}
                              </div>
                            </div>
                            <div style={{ width: '55px', textAlign: 'right', fontFamily: 'var(--za-serif)', fontSize: '15px', fontWeight: 700, color: step.color }}>{step.value}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Per-Profile Performance */}
              {hr.available && hr.accounts.length > 0 && (() => {
                const sortedAccounts = [...hr.accounts].sort((a, b) => b.connectionsSent - a.connectionsSent)
                return (
                  <div className="za-panel fade-up" style={{ animationDelay: '480ms', marginBottom: '16px' }}>
                    <div className="panel-head">
                      <div>
                        <span className="panel-eyebrow">LinkedIn Profile Performance</span>
                        <div className="panel-title">{sortedAccounts.length} Profile &middot; letzte 90 Tage</div>
                      </div>
                    </div>
                    <div className="za-table-wrap">
                      <table className="za-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Profil</th>
                            <th style={{ textAlign: 'right' }}>Connections</th>
                            <th style={{ textAlign: 'right' }}>Accepted</th>
                            <th style={{ textAlign: 'right' }}>Annahme%</th>
                            <th style={{ textAlign: 'right' }}>Nachrichten</th>
                            <th style={{ textAlign: 'right' }}>Antworten</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedAccounts.map((a, i) => (
                            <tr key={a.accountId}>
                              <td style={{ fontWeight: 600, color: 'var(--za-fg-3)' }}>{i + 1}</td>
                              <td>
                                <div className="t-co">
                                  <span className="t-co-mark" style={{ background: 'linear-gradient(135deg, #579bfc, #784bd1)' }}>P</span>
                                  <span className="t-co-name">Profil {a.accountId}</span>
                                </div>
                              </td>
                              <td style={{ textAlign: 'right', fontFamily: 'var(--za-serif)', fontWeight: 700 }}>{fmtNum(a.connectionsSent)}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'var(--za-serif)', fontWeight: 700 }}>{fmtNum(a.connectionsAccepted)}</td>
                              <td style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: a.acceptanceRate >= 10 ? '#4ade80' : a.acceptanceRate >= 5 ? '#fbbf24' : 'var(--za-fg-3)' }}>{a.acceptanceRate}%</span>
                              </td>
                              <td style={{ textAlign: 'right', fontFamily: 'var(--za-serif)', fontWeight: 700 }}>{fmtNum(a.messagesSent)}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'var(--za-serif)', fontWeight: 700 }}>{fmtNum(a.replies)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}
              </div>

              <div id="sec-outreach-heyreach" style={{ display: activeSection === 'sec-outreach-heyreach' || !activeSection ? undefined : 'none' }}>
              {/* Daily trend + additional stats */}
              {hr.available ? (
                <div className="za-panel fade-up" style={{ animationDelay: '560ms', marginBottom: '16px' }}>
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">HeyReach Automation</span>
                      <div className="panel-title">LinkedIn Outreach &middot; letzte 90 Tage</div>
                    </div>
                  </div>

                  {/* Daily trend - last 14 days */}
                  {hr.dailyStats.length > 0 && (() => {
                    const last14 = hr.dailyStats.slice(-14)
                    const maxVal = Math.max(...last14.map(d => Math.max(d.connectionsSent, d.messagesSent)), 1)
                    return (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--za-fg-2)', marginBottom: '10px' }}>Tagesverlauf (14 Tage)</div>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '80px' }}>
                          {last14.map((d, i) => (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <div style={{ width: '100%', background: '#9d50dd', borderRadius: '3px 3px 0 0', height: `${Math.max((d.connectionsSent / maxVal) * 60, 2)}px`, transition: 'height 0.6s ease', position: 'relative' }} title={`${d.date}: ${d.connectionsSent} Connections, ${d.connectionsAccepted} Accepted, ${d.messagesSent} Nachrichten`}>
                                {d.connectionsAccepted > 0 && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${Math.max((d.connectionsAccepted / maxVal) * 60, 2)}px`, background: '#4ade80', borderRadius: '3px 3px 0 0' }} />}
                              </div>
                              <span style={{ fontSize: '9px', color: 'var(--za-fg-3)', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>{d.date.slice(5)}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '10px', color: 'var(--za-fg-3)' }}>
                          <span><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: '#9d50dd', marginRight: '4px' }} />Connections</span>
                          <span><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: '#4ade80', marginRight: '4px' }} />Accepted</span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Additional stats */}
                  <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(249,249,249,0.06)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--za-fg-3)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weitere Metriken</div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '6px', background: 'rgba(249,249,249,0.06)', color: 'var(--za-fg-2)' }}>
                        Follows: <strong style={{ color: 'var(--za-fg-1)' }}>{fmtNum(hr.follows)}</strong>
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '6px', background: 'rgba(249,249,249,0.06)', color: 'var(--za-fg-2)' }}>
                        Post Likes: <strong style={{ color: 'var(--za-fg-1)' }}>{fmtNum(hr.postLikes)}</strong>
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '6px', background: 'rgba(249,249,249,0.06)', color: 'var(--za-fg-2)' }}>
                        Konversationen gestartet: <strong style={{ color: 'var(--za-fg-1)' }}>{fmtNum(hr.totalMessageStarted)}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="za-panel fade-up" style={{ animationDelay: '560ms', marginBottom: '16px', padding: '32px', textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', color: 'var(--za-fg-3)' }}>HeyReach nicht verbunden &mdash; setze <code>HEYREACH_API_KEY</code></div>
                </div>
              )}
              </div>

              <div id="sec-outreach-leaderboard" style={{ display: activeSection === 'sec-outreach-leaderboard' || !activeSection ? undefined : 'none' }}>
              {/* Campaigns list */}
              {hr.available && hr.campaigns.length > 0 && (
                <div className="za-panel fade-up" style={{ animationDelay: '620ms', marginBottom: '16px' }}>
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">Kampagnen</span>
                      <div className="panel-title">HeyReach Campaigns &middot; {hr.campaigns.length}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {hr.campaigns.map((c) => {
                      const p = c.progress
                      const progressPct = p.totalUsers > 0 ? Math.round((p.inProgress / p.totalUsers) * 100) : 0
                      const finishedPct = p.totalUsers > 0 ? Math.round((p.finished / p.totalUsers) * 100) : 0
                      const statusColor = c.status === 'IN_PROGRESS' ? '#4ade80' : c.status === 'PAUSED' ? '#fbbf24' : '#64748b'
                      const statusBg = c.status === 'IN_PROGRESS' ? 'rgba(34,197,94,0.15)' : c.status === 'PAUSED' ? 'rgba(251,191,36,0.15)' : 'rgba(249,249,249,0.06)'
                      return (
                        <div key={c.id} style={{ padding: '12px 16px', background: 'rgba(249,249,249,0.03)', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span className="t-co-mark" style={{ background: 'linear-gradient(135deg, #9d50dd, #784bd1)', width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{c.name.charAt(0)}</span>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--za-fg-1)' }}>{c.name}</span>
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: statusBg, color: statusColor }}>
                              {c.status}
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div style={{ height: '6px', background: 'rgba(249,249,249,0.06)', borderRadius: '3px', marginBottom: '8px', overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: `${finishedPct}%`, background: '#4ade80', transition: 'width 0.6s ease' }} />
                            <div style={{ width: `${progressPct}%`, background: '#579bfc', transition: 'width 0.6s ease' }} />
                          </div>
                          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--za-fg-3)' }}>
                            <span>Total: <strong style={{ color: 'var(--za-fg-1)' }}>{fmtNum(p.totalUsers)}</strong></span>
                            <span>In Progress: <strong style={{ color: '#579bfc' }}>{fmtNum(p.inProgress)}</strong></span>
                            <span>Pending: <strong style={{ color: 'var(--za-fg-2)' }}>{fmtNum(p.pending)}</strong></span>
                            <span>Finished: <strong style={{ color: '#4ade80' }}>{fmtNum(p.finished)}</strong></span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              </div>

              <div id="sec-outreach-activity" style={{ display: activeSection === 'sec-outreach-activity' || !activeSection ? undefined : 'none' }}>
              {/* Recent Activity from Monday (also shown in HeyReach view) */}
              <div className="za-panel fade-up" style={{ animationDelay: '680ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Letzte Aktivit&auml;ten</span>
                    <div className="panel-title">Aktuelle Status-&Auml;nderungen &middot; Monday.com</div>
                  </div>
                </div>
                {mo.recentActivity.length > 0 ? (
                  <div className="za-table-wrap">
                    <table className="za-table">
                      <thead>
                        <tr>
                          <th>Lead</th>
                          <th>Firma</th>
                          <th>Status</th>
                          <th>Zust&auml;ndig</th>
                          <th>Letzter Touch</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mo.recentActivity.map((a, i) => (
                          <tr key={i}>
                            <td>
                              <div className="t-co">
                                <span className="t-co-mark">{a.name.charAt(0)}</span>
                                <span className="t-co-name">{a.name}</span>
                              </div>
                            </td>
                            <td style={{ fontSize: '12px', color: 'var(--za-fg-2)' }}>{a.company || '\u2013'}</td>
                            <td><span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: `${a.statusColor}20`, color: a.statusColor }}>{a.status}</span></td>
                            <td style={{ fontSize: '12px', color: 'var(--za-fg-2)' }}>{a.assignee || '\u2013'}</td>
                            <td style={{ fontSize: '12px', color: 'var(--za-fg-3)', fontFamily: 'var(--za-serif)' }}>{a.updatedAt}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--za-fg-3)' }}>Keine aktuellen Aktivit&auml;ten</div>
                )}
              </div>
              </div>
              </>
              )}

              {/* ── Monday.com View ── */}
              {outreachView === 'monday' && (
              <>
              {/* Hero KPIs — Monday */}
              <div className="kpi-grid">
                <div className="za-panel fade-up" style={{ animationDelay: '60ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">Leads gesamt</span></div>
                  <div className="kpi-value">{fmtNum(mo.totalLeads)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">Monday.com Pipeline</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '140ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">Vernetzungen gesendet</span></div>
                  <div className="kpi-value">{fmtNum(mo.totalConnectionsSent)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">Monday Pipeline (kumulativ: Status 5+)</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '220ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">Angenommen</span></div>
                  <div className="kpi-value" style={{ color: '#037f4c' }}>{mo.milestones.angenommen}</div>
                  <div className="kpi-foot"><span className="kpi-caption">{om.rates.acceptanceRate}% Annahmerate</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '300ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">Geantwortet</span></div>
                  <div className="kpi-value" style={{ color: om.rates.replyRate >= 20 ? 'var(--za-success)' : '#fbbf24' }}>{mo.milestones.geantwortet}</div>
                  <div className="kpi-foot"><span className="kpi-caption">{om.rates.replyRate}% Antwortrate</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '380ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">Termine gebucht</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-success)' }}>{mo.milestones.termin}</div>
                  <div className="kpi-foot"><span className="kpi-caption">{om.rates.overallConversion}% Gesamtkonversion</span></div>
                </div>
              </div>

              <div id="sec-outreach-funnel" style={{ display: activeSection === 'sec-outreach-funnel' || !activeSection ? undefined : 'none' }}>
              {/* Pipeline Funnel Waterfall */}
              <div className="za-panel fade-up" style={{ animationDelay: '440ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Outreach Waterfall</span>
                    <div className="panel-title">{fmtNum(mo.totalConnectionsSent)} Anfragen &rarr; {waterfallSteps[waterfallSteps.length - 1]?.value || 0} Calls</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {waterfallSteps.map((step, i) => {
                    const prevValue = i === 0 ? step.value : waterfallSteps[i - 1].value
                    const convRate = i === 0 ? 100 : (prevValue > 0 ? Math.round((step.value / prevValue) * 1000) / 10 : 0)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '130px', flexShrink: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--za-fg-2)' }}>{step.label}</div>
                          {i > 0 && <div style={{ fontSize: '10px', color: convRate >= 50 ? '#4ade80' : convRate >= 20 ? '#fbbf24' : '#f87171' }}>{convRate}% von {waterfallSteps[i - 1].label}</div>}
                        </div>
                        <div style={{ flex: 1, height: '32px', position: 'relative' }}>
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(249,249,249,0.04)', borderRadius: '6px' }} />
                          <div style={{
                            width: `${Math.max((step.value / maxFunnel) * 100, step.value > 0 ? 3 : 0)}%`,
                            height: '100%',
                            background: `linear-gradient(90deg, ${step.color}, ${step.color}cc)`,
                            borderRadius: '6px',
                            transition: 'width 0.8s ease',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            position: 'relative',
                          }}>
                            {step.value > 0 && <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{step.value}</span>}
                          </div>
                        </div>
                        <div style={{ width: '55px', textAlign: 'right', fontFamily: 'var(--za-serif)', fontSize: '15px', fontWeight: 700, color: step.color }}>{step.value}</div>
                      </div>
                    )
                  })}
                </div>

                {/* Dropout section */}
                {dropouts.some(d => d.value > 0) && (
                  <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(249,249,249,0.06)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--za-fg-3)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Abg&auml;nge</div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {dropouts.filter(d => d.value > 0).map((d, i) => (
                        <span key={i} style={{ fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '6px', background: `${d.color}15`, color: d.color }}>
                          {d.label}: {d.value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Phase breakdown */}
                {Object.keys(mo.phases).length > 0 && (
                  <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(249,249,249,0.06)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--za-fg-3)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monday Phasen</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {Object.entries(mo.phases).filter(([, v]) => v > 0).map(([phase, count]) => (
                        <span key={phase} style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', background: 'rgba(249,249,249,0.06)', color: 'var(--za-fg-2)' }}>
                          {phase}: <strong style={{ color: 'var(--za-fg-1)' }}>{count}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              </div>

              <div id="sec-outreach-leaderboard" style={{ display: activeSection === 'sec-outreach-leaderboard' || !activeSection ? undefined : 'none' }}>
              {/* Team Leaderboard */}
              {mo.members.length > 0 && (
                <div className="za-panel fade-up" style={{ animationDelay: '500ms', marginBottom: '16px' }}>
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">Team Leaderboard</span>
                      <div className="panel-title">Felix vs Marcel &middot; Monday.com</div>
                    </div>
                  </div>
                  <div className="za-table-wrap">
                    <table className="za-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Name</th>
                          <th>Leads</th>
                          <th>Anfragen</th>
                          <th>Angenommen</th>
                          <th>Erstnachricht</th>
                          <th>Geantwortet</th>
                          <th>Call gebucht</th>
                          <th>Kein Interesse</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mo.members.map((m, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 700, color: i === 0 ? '#fbbf24' : 'var(--za-fg-3)' }}>{i + 1}</td>
                            <td>
                              <div className="t-co">
                                <span className="t-co-mark" style={i === 0 ? { background: 'linear-gradient(135deg, var(--za-gold), var(--za-gold-2))' } : {}}>{m.name.charAt(0)}</span>
                                <span className="t-co-name">{m.name}</span>
                              </div>
                            </td>
                            <td style={{ fontFamily: 'var(--za-serif)', fontWeight: 600 }}>{m.totalLeads}</td>
                            <td style={{ fontFamily: 'var(--za-serif)', fontWeight: 600 }}>{m.anfrageGesendet}</td>
                            <td style={{ color: '#037f4c', fontWeight: 700 }}>{m.angenommen}</td>
                            <td style={{ fontFamily: 'var(--za-serif)', fontWeight: 600 }}>{m.erstnachrichtGesendet}</td>
                            <td style={{ fontWeight: 700 }}>{m.geantwortet}</td>
                            <td style={{ fontFamily: 'var(--za-serif)', fontWeight: 700, color: m.callGebucht > 0 ? '#bb3354' : 'var(--za-fg-3)' }}>{m.callGebucht}</td>
                            <td style={{ color: '#ff007f' }}>{m.keinInteresse}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              </div>

              <div id="sec-outreach-heyreach" style={{ display: activeSection === 'sec-outreach-heyreach' || !activeSection ? undefined : 'none' }}>
              {/* HeyReach Stats summary in Monday view */}
              {hr.available ? (
                <div className="za-panel fade-up" style={{ animationDelay: '560ms', marginBottom: '16px' }}>
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">HeyReach Automation</span>
                      <div className="panel-title">LinkedIn Outreach &middot; letzte 90 Tage</div>
                    </div>
                  </div>
                  <div className="kpi-grid" style={{ marginBottom: '16px' }}>
                    <div style={{ textAlign: 'center', padding: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--za-fg-3)', marginBottom: '4px' }}>Vernetzungen</div>
                      <div style={{ fontFamily: 'var(--za-serif)', fontSize: '22px', fontWeight: 700 }}>{fmtNum(hr.connectionsSent)}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--za-fg-3)', marginBottom: '4px' }}>Angenommen</div>
                      <div style={{ fontFamily: 'var(--za-serif)', fontSize: '22px', fontWeight: 700 }}>{fmtNum(hr.connectionsAccepted)}</div>
                      <div style={{ fontSize: '10px', color: 'var(--za-fg-3)' }}>{hr.connectionAcceptanceRate}%</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--za-fg-3)', marginBottom: '4px' }}>Nachrichten</div>
                      <div style={{ fontFamily: 'var(--za-serif)', fontSize: '22px', fontWeight: 700 }}>{fmtNum(hr.messagesSent)}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--za-fg-3)', marginBottom: '4px' }}>Antworten</div>
                      <div style={{ fontFamily: 'var(--za-serif)', fontSize: '22px', fontWeight: 700 }}>{fmtNum(hr.totalMessageReplies)}</div>
                      <div style={{ fontSize: '10px', color: 'var(--za-fg-3)' }}>{hr.replyRate}%</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--za-fg-3)', marginBottom: '4px' }}>Leads kontaktiert</div>
                      <div style={{ fontFamily: 'var(--za-serif)', fontSize: '22px', fontWeight: 700 }}>{fmtNum(hr.uniqueLeadsContacted)}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--za-fg-3)', marginBottom: '4px' }}>Profilaufrufe</div>
                      <div style={{ fontFamily: 'var(--za-serif)', fontSize: '22px', fontWeight: 700 }}>{fmtNum(hr.profileViews)}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="za-panel fade-up" style={{ animationDelay: '560ms', marginBottom: '16px', padding: '32px', textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', color: 'var(--za-fg-3)' }}>HeyReach nicht verbunden &mdash; setze <code>HEYREACH_API_KEY</code></div>
                </div>
              )}
              </div>

              <div id="sec-outreach-activity" style={{ display: activeSection === 'sec-outreach-activity' || !activeSection ? undefined : 'none' }}>
              {/* Recent Activity from Monday */}
              <div className="za-panel fade-up" style={{ animationDelay: '620ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Letzte Aktivit&auml;ten</span>
                    <div className="panel-title">Aktuelle Status-&Auml;nderungen &middot; Monday.com</div>
                  </div>
                </div>
                {mo.recentActivity.length > 0 ? (
                  <div className="za-table-wrap">
                    <table className="za-table">
                      <thead>
                        <tr>
                          <th>Lead</th>
                          <th>Firma</th>
                          <th>Status</th>
                          <th>Zust&auml;ndig</th>
                          <th>Letzter Touch</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mo.recentActivity.map((a, i) => (
                          <tr key={i}>
                            <td>
                              <div className="t-co">
                                <span className="t-co-mark">{a.name.charAt(0)}</span>
                                <span className="t-co-name">{a.name}</span>
                              </div>
                            </td>
                            <td style={{ fontSize: '12px', color: 'var(--za-fg-2)' }}>{a.company || '\u2013'}</td>
                            <td><span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: `${a.statusColor}20`, color: a.statusColor }}>{a.status}</span></td>
                            <td style={{ fontSize: '12px', color: 'var(--za-fg-2)' }}>{a.assignee || '\u2013'}</td>
                            <td style={{ fontSize: '12px', color: 'var(--za-fg-3)', fontFamily: 'var(--za-serif)' }}>{a.updatedAt}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--za-fg-3)' }}>Keine aktuellen Aktivit&auml;ten</div>
                )}
              </div>
              </div>
              </>
              )}
            </>
            )
          })()}

          {/* ═══════════════════════════════════════════════════
               TAB: SALES
             ═══════════════════════════════════════════════════ */}
          {activeNav === 'sales' && (
            <>
              {/* Period selector with calendar */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }} className="fade-up">
                <div className="view-switch">
                  {(['today', 'week', 'month', 'year'] as Period[]).map(p => (
                    <button key={p} className={period === p && !useCustomRange ? 'is-active' : ''} onClick={() => { setPeriod(p); setUseCustomRange(false); }}>
                      {PERIOD_LABELS[p]}
                    </button>
                  ))}
                  <button className={useCustomRange ? 'is-active' : ''} onClick={() => setUseCustomRange(true)}>
                    Zeitraum
                  </button>
                </div>

                {useCustomRange && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                      style={{ background: 'rgba(249,249,249,0.06)', border: '1px solid rgba(249,249,249,0.12)', borderRadius: '8px', padding: '6px 10px', color: '#fff', fontSize: '12px' }} />
                    <span style={{ color: 'var(--za-fg-3)', fontSize: '12px' }}>bis</span>
                    <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                      style={{ background: 'rgba(249,249,249,0.06)', border: '1px solid rgba(249,249,249,0.12)', borderRadius: '8px', padding: '6px 10px', color: '#fff', fontSize: '12px' }} />
                  </div>
                )}

                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                  <button className="za-glass-btn" onClick={() => {
                    const month = useCustomRange ? customFrom.slice(0, 7) : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                    window.open(`/api/report?period=custom&month=${month}`, '_blank');
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                    PDF Report
                  </button>
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
                    <span className="kpi-label">Anwahlen</span>
                  </div>
                  <div className="kpi-value">{fmtNum(periodAnwahlen)}</div>
                  <div className="kpi-foot">
                    <span className="kpi-caption">{fmtNum(periodEntscheider)} Entscheider &middot; {fmtNum(periodSettings)} Settings</span>
                  </div>
                </div>
              </div>

              {/* ═══ SALES FUNNEL — HERO ═══ */}
              <div id="sec-sales-funnel" style={{ display: activeSection === 'sec-sales-funnel' || !activeSection ? undefined : 'none' }}>
              {(() => {
                const funnelData = period === 'today' ? data.salesFunnel.today
                  : period === 'week' ? data.salesFunnel.week
                  : period === 'year' ? data.salesFunnel.alltime
                  : data.salesFunnel.month
                const periodNote = period === 'year' ? ` (${new Date().getFullYear()})` : ''
                const quoten = period === 'year' ? data.salesFunnel.quotenAllTime : data.salesFunnel.quoten

                // Outcome breakdowns per period
                const entscheiderOutcomes = period === 'today' ? data.entscheiderOutcomesToday
                  : period === 'week' ? data.entscheiderOutcomesWeek
                  : period === 'year' ? data.entscheiderOutcomesYear
                  : data.entscheiderOutcomesMonth

                const einwandBreakdown = period === 'today' ? data.einwandToday
                  : period === 'week' ? data.einwandWeek
                  : period === 'year' ? data.einwandYear
                  : data.einwandMonth

                const settingOutcomes = period === 'today' ? data.settingOutcomesToday
                  : period === 'week' ? data.settingOutcomesWeek
                  : period === 'year' ? data.settingOutcomesYear
                  : data.settingOutcomesMonth

                const stages = [
                  { label: 'Anwahlen', value: funnelData.anwahlen, rate: null, rateLabel: '', breakdownIdx: -1 },
                  { label: 'Entscheider erreicht', value: funnelData.entscheiderErreicht, rate: quoten.erreichquote, rateLabel: 'Erreichquote', sub: `(${funnelData.coldCalls} Cold Calls + ${funnelData.followUps} Follow-Ups)`, breakdownIdx: 1 },
                  { label: 'Settings gelegt', value: funnelData.settingsGelegt, rate: quoten.settingQuote, rateLabel: 'Setting-Quote', breakdownIdx: -1 },
                  { label: 'Beratungsgespr\u00e4che (Closings)', value: funnelData.closingsGelegt, rate: quoten.closingQuote, rateLabel: 'Closing-Quote', breakdownIdx: 2 },
                  { label: 'Abschl\u00fcsse (Won)', value: funnelData.wonDeals, rate: quoten.abschlussQuote, rateLabel: 'Abschlussquote', revenue: funnelData.wonRevenue, breakdownIdx: -1 },
                ]

                // Upsell info
                const hasUpsells = funnelData.wonDeals > 0
                const maxVal = Math.max(...stages.map(s => s.value), 1)

                // Render a breakdown section
                const BreakdownSection = ({ outcomes, title }: { outcomes: Record<string, number>; title: string }) => {
                  const sorted = Object.entries(outcomes).sort(([, a], [, b]) => b - a)
                  const total = sorted.reduce((s, [, c]) => s + c, 0)
                  if (sorted.length === 0) return null
                  return (
                    <div style={{ margin: '6px 0 6px 170px', padding: '10px 14px', background: 'rgba(197,160,89,0.04)', borderRadius: '8px', borderLeft: '2px solid rgba(197,160,89,0.3)' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--za-gold-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                        {title}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {sorted.map(([label, count], j) => {
                          const pct = total > 0 ? Math.round((count / total) * 100) : 0
                          const isSuccess = label.toLowerCase().includes('setting vereinbart') || label.toLowerCase().includes('setting gelegt') || label.toLowerCase().includes('closing gelegt')
                          const isHard = label.toLowerCase().includes('kein') || label.toLowerCase().includes('nicht') || label.toLowerCase().includes('no show') || label.toLowerCase().includes('verloren') || label.toLowerCase().includes('disqualif')
                          const isSoft = label.toLowerCase().includes('follow') || label.toLowerCase().includes('nochmal') || label.toLowerCase().includes('später') || label.toLowerCase().includes('termin')
                          const dotColor = isSuccess ? 'var(--za-success)' : isHard ? 'var(--za-danger)' : isSoft ? 'var(--za-gold-2)' : 'var(--za-info)'
                          return (
                            <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                              <span style={{ fontSize: '11px', color: 'var(--za-fg-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>{label}</span>
                              <span style={{ fontFamily: 'var(--za-serif)', fontSize: '12px', fontWeight: 700, color: '#fff', minWidth: '28px', textAlign: 'right' }}>{count}</span>
                              <span style={{ fontSize: '10px', color: 'var(--za-fg-4)', minWidth: '32px', textAlign: 'right' }}>{pct}%</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                }

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
                                {i === 0 ? '100%' : (stage as any).revenue !== undefined ? fmtEuro((stage as any).revenue) : `${maxVal > 0 ? ((stage.value / maxVal) * 100).toFixed(0) : 0}%`}
                              </div>
                            </div>

                            {/* Breakdown: Entscheider → Settings (why not more settings?) */}
                            {i === 1 && entscheiderOutcomes && Object.keys(entscheiderOutcomes).length > 0 && (
                              <BreakdownSection outcomes={entscheiderOutcomes} title="Alle Entscheider-Ergebnisse" />
                            )}
                            {i === 1 && einwandBreakdown && Object.keys(einwandBreakdown).length > 0 && (
                              <BreakdownSection outcomes={einwandBreakdown} title="Einw\u00e4nde der Entscheider" />
                            )}

                            {/* Breakdown: Settings → Closings (why not more closings?) */}
                            {i === 2 && settingOutcomes && Object.keys(settingOutcomes).length > 0 && (
                              <BreakdownSection outcomes={settingOutcomes} title="Alle Setting-Ergebnisse" />
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Upsell Breakdown after Won */}
                    {hasUpsells && (
                      <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(78,138,107,0.06)', borderRadius: '10px', border: '1px solid rgba(78,138,107,0.15)' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--za-success)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                          Abschl&uuml;sse aufgeschl&uuml;sselt: Erstdeal vs. Upsell
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                          <div style={{ padding: '12px', background: 'rgba(249,249,249,0.03)', borderRadius: '8px', borderLeft: '3px solid var(--za-success)' }}>
                            <div style={{ fontSize: '10px', color: 'var(--za-fg-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>Erstdeals</div>
                            <div style={{ fontFamily: 'var(--za-serif)', fontSize: '22px', fontWeight: 700, color: 'var(--za-success)' }}>{funnelData.erstdeals}</div>
                            <div style={{ fontSize: '11px', color: 'var(--za-fg-4)', marginTop: '1px' }}>{fmtEuro(funnelData.erstdealRevenue)}</div>
                          </div>
                          <div style={{ padding: '12px', background: 'rgba(249,249,249,0.03)', borderRadius: '8px', borderLeft: '3px solid var(--za-violet)' }}>
                            <div style={{ fontSize: '10px', color: 'var(--za-fg-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>Upsells</div>
                            <div style={{ fontFamily: 'var(--za-serif)', fontSize: '22px', fontWeight: 700, color: 'var(--za-violet)' }}>{funnelData.upsells}</div>
                            <div style={{ fontSize: '11px', color: 'var(--za-fg-4)', marginTop: '1px' }}>{fmtEuro(funnelData.upsellRevenue)}</div>
                          </div>
                          <div style={{ padding: '12px', background: 'rgba(249,249,249,0.03)', borderRadius: '8px', borderLeft: '3px solid var(--za-gold-2)' }}>
                            <div style={{ fontSize: '10px', color: 'var(--za-fg-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>Upsell-Rate</div>
                            <div style={{ fontFamily: 'var(--za-serif)', fontSize: '22px', fontWeight: 700, color: 'var(--za-gold-2)' }}>{funnelData.upsellRate}%</div>
                            <div style={{ fontSize: '11px', color: 'var(--za-fg-4)', marginTop: '1px' }}>der Abschl&uuml;sse</div>
                          </div>
                          <div style={{ padding: '12px', background: 'rgba(249,249,249,0.03)', borderRadius: '8px', borderLeft: '3px solid #fff' }}>
                            <div style={{ fontSize: '10px', color: 'var(--za-fg-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>Echte Neukunden</div>
                            <div style={{ fontFamily: 'var(--za-serif)', fontSize: '22px', fontWeight: 700, color: '#fff' }}>{funnelData.erstdeals}</div>
                            <div style={{ fontSize: '11px', color: 'var(--za-fg-4)', marginTop: '1px' }}>von {funnelData.wonDeals} Won</div>
                          </div>
                        </div>

                        {/* Visual bar showing Erstdeal vs Upsell split */}
                        {funnelData.wonDeals > 0 && (
                          <div style={{ marginTop: '12px' }}>
                            <div style={{ display: 'flex', height: '24px', borderRadius: '6px', overflow: 'hidden' }}>
                              <div style={{
                                width: `${100 - funnelData.upsellRate}%`,
                                background: 'linear-gradient(90deg, #4E8A6B, #7FC29B)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '10px', fontWeight: 700, color: '#fff',
                                minWidth: funnelData.erstdeals > 0 ? '40px' : '0',
                              }}>
                                {funnelData.erstdeals > 0 ? `${funnelData.erstdeals} Erst` : ''}
                              </div>
                              {funnelData.upsells > 0 && (
                                <div style={{
                                  width: `${funnelData.upsellRate}%`,
                                  background: 'linear-gradient(90deg, #7C5CBF, #A78BDA)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '10px', fontWeight: 700, color: '#fff',
                                  minWidth: '40px',
                                }}>
                                  {funnelData.upsells} Upsell
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* ═══ OPENER PERFORMANCE & FUNNEL RATIOS ═══ */}
              <OpenerPerformancePanel data={data} />
              </div>

              {/* ═══ SETTING- & CLOSING-QUALITÄT (Pipeline-Statuswechsel) ═══ */}
              <div id="sec-sales-pipeline-quality" style={{ display: activeSection === 'sec-sales-pipeline-quality' || !activeSection ? undefined : 'none' }}>
              {(() => {
                const isWeek = period === 'today' || period === 'week'
                const pq: PipelineQuality = isWeek ? data.pipelineQualityWeek : data.pipelineQualityMonth
                const pqAll = data.pipelineQualityAllTime
                const periodLabel = isWeek ? 'diese Woche' : 'diesen Monat'
                const cal = data.calendlyMetrics

                // Calendly no-show data
                const calActiveSettings = isWeek ? cal.weekSettings : cal.monthSettings
                const calCanceledSettings = isWeek ? cal.weekCanceledSettings : cal.monthCanceledSettings
                const calActiveClosings = isWeek ? cal.weekClosings : cal.monthClosings
                const calCanceledClosings = isWeek ? cal.weekCanceledClosings : cal.monthCanceledClosings

                // Use pipeline quality data, fall back to all-time if period has no data
                const sq = pq.settingTotal > 0 ? pq : pqAll
                const cq = pq.closingTotal > 0 ? pq : pqAll
                const sqLabel = pq.settingTotal > 0 ? periodLabel : 'gesamt (90 Tage)'
                const cqLabel = pq.closingTotal > 0 ? periodLabel : 'gesamt (90 Tage)'

                if (sq.settingTotal === 0 && cq.closingTotal === 0) return null

                // Render a transition bar row
                const TransitionBar = ({ label, count, total, color }: { label: string; count: number; total: number; color: string }) => {
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0
                  const maxCount = total
                  const widthPct = Math.max((count / maxCount) * 100, 3)
                  return (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '180px 1fr 45px 45px',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '5px 0',
                    }}>
                      <div style={{ fontSize: '12px', color: 'var(--za-fg-2)', fontWeight: 500, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>
                        {label}
                      </div>
                      <div style={{ height: '20px', background: 'rgba(249,249,249,0.04)', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{ width: `${widthPct}%`, height: '100%', background: color, borderRadius: '5px', transition: 'width 0.6s ease', opacity: 0.85 }} />
                      </div>
                      <div style={{ fontFamily: 'var(--za-serif)', fontSize: '14px', fontWeight: 700, color: '#fff', textAlign: 'right' }}>{count}</div>
                      <div style={{ fontSize: '11px', color: 'var(--za-fg-4)', textAlign: 'right' }}>{pct}%</div>
                    </div>
                  )
                }

                return (
                  <div className="za-panel fade-up" style={{ animationDelay: '490ms', marginBottom: '16px', borderTop: '2px solid var(--za-violet)', padding: '24px' }}>
                    <div className="panel-head" style={{ marginBottom: '20px' }}>
                      <div>
                        <span className="panel-eyebrow" style={{ color: 'var(--za-violet)' }}>Pipeline-Qualit&auml;t</span>
                        <div className="panel-title" style={{ fontSize: '18px' }}>
                          Setting &amp; Closing Conversion
                        </div>
                      </div>
                      <span className="panel-sub" style={{ fontFamily: 'var(--za-serif)', fontSize: '13px', color: 'var(--za-fg-3)' }}>
                        Basierend auf Statuswechseln in Close
                      </span>
                    </div>

                    {/* ── SETTING PHASE ── */}
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--za-info)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
                      Setting-Phase &mdash; {sqLabel} ({sq.settingTotal} Statuswechsel)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '14px' }}>
                      {[
                        { label: '→ Closing', value: `${sq.settingToClosingRate}%`, sub: `${sq.settingToClosingCount} von ${sq.settingTotal}`, color: 'var(--za-success)' },
                        { label: 'No Show', value: `${sq.settingNoShowRate}%`, sub: `${sq.settingNoShowCount}x`, color: 'var(--za-danger)' },
                        { label: 'Follow Up', value: `${sq.settingFollowUpRate}%`, sub: `${sq.settingFollowUpCount}x`, color: 'var(--za-gold-2)' },
                        { label: 'Verloren', value: `${sq.settingLostRate}%`, sub: `${sq.settingLostCount}x`, color: 'var(--za-danger)' },
                      ].map((kpi, i) => (
                        <div key={i} style={{ padding: '12px', background: 'rgba(249,249,249,0.03)', borderRadius: '8px', borderLeft: `3px solid ${kpi.color}` }}>
                          <div style={{ fontSize: '10px', color: 'var(--za-fg-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>{kpi.label}</div>
                          <div style={{ fontFamily: 'var(--za-serif)', fontSize: '20px', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                          <div style={{ fontSize: '11px', color: 'var(--za-fg-4)', marginTop: '1px' }}>{kpi.sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* Setting transition bars */}
                    <div style={{ marginBottom: '24px' }}>
                      {sq.settingTransitions.map((t, i) => {
                        const color = t.toLabel.includes('Closing') ? 'var(--za-success)'
                          : t.toLabel.includes('No Show') ? 'var(--za-danger)'
                          : t.toLabel.includes('Verloren') ? '#c0392b'
                          : t.toLabel.includes('Follow') ? 'var(--za-gold-2)'
                          : t.toLabel.includes('Close') ? 'var(--za-success)'
                          : 'var(--za-violet)'
                        return <TransitionBar key={i} label={t.toLabel} count={t.count} total={sq.settingTotal} color={color} />
                      })}
                    </div>

                    {/* Calendly Setting Show-Rate */}
                    {(calActiveSettings + calCanceledSettings) > 0 && (
                      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', padding: '12px', background: 'rgba(249,249,249,0.03)', borderRadius: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--za-fg-4)' }}>Calendly Settings {periodLabel}:</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--za-success)' }}>{calActiveSettings} aktiv</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--za-danger)' }}>{calCanceledSettings} abgesagt</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>
                          Show-Rate: {Math.round((calActiveSettings / (calActiveSettings + calCanceledSettings)) * 100)}%
                        </span>
                      </div>
                    )}

                    {/* ── CLOSING PHASE ── */}
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--za-violet)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
                      Closing-Phase &mdash; {cqLabel} ({cq.closingTotal} Statuswechsel)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '14px' }}>
                      {[
                        { label: 'Gewonnen', value: `${cq.closingWonRate}%`, sub: `${cq.closingWonCount} Deals`, color: 'var(--za-success)' },
                        { label: 'No Show', value: `${cq.closingNoShowRate}%`, sub: `${cq.closingNoShowCount}x`, color: 'var(--za-danger)' },
                        { label: 'Verloren', value: `${cq.closingLostRate}%`, sub: `${cq.closingLostCount}x`, color: 'var(--za-danger)' },
                        { label: 'Follow Up / CC2', value: `${cq.closingFollowUpRate}%`, sub: `${cq.closingFollowUpCount} FU + ${cq.closingCC2Count} CC2`, color: 'var(--za-gold-2)' },
                      ].map((kpi, i) => (
                        <div key={i} style={{ padding: '12px', background: 'rgba(249,249,249,0.03)', borderRadius: '8px', borderLeft: `3px solid ${kpi.color}` }}>
                          <div style={{ fontSize: '10px', color: 'var(--za-fg-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>{kpi.label}</div>
                          <div style={{ fontFamily: 'var(--za-serif)', fontSize: '20px', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                          <div style={{ fontSize: '11px', color: 'var(--za-fg-4)', marginTop: '1px' }}>{kpi.sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* ── ANGEBOT & CC2 → WON ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '14px' }}>
                      {[
                        { label: 'Angebot → Won', value: cq.angebotWonCount, sub: cq.closingAngebotCount > 0 ? `${Math.round((cq.angebotWonCount / cq.closingAngebotCount) * 100)}% von ${cq.closingAngebotCount} Angeboten` : 'Keine Angebote', color: 'var(--za-info)' },
                        { label: 'CC2 → Won', value: cq.cc2WonCount, sub: cq.closingCC2Count > 0 ? `${Math.round((cq.cc2WonCount / cq.closingCC2Count) * 100)}% von ${cq.closingCC2Count} CC2s` : 'Keine CC2s', color: 'var(--za-info)' },
                      ].map((kpi, i) => (
                        <div key={i} style={{ padding: '12px', background: 'rgba(249,249,249,0.03)', borderRadius: '8px', borderLeft: `3px solid ${kpi.color}` }}>
                          <div style={{ fontSize: '10px', color: 'var(--za-fg-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>{kpi.label}</div>
                          <div style={{ fontFamily: 'var(--za-serif)', fontSize: '20px', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                          <div style={{ fontSize: '11px', color: 'var(--za-fg-4)', marginTop: '1px' }}>{kpi.sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* Closing transition bars */}
                    <div style={{ marginBottom: '24px' }}>
                      {cq.closingTransitions.map((t, i) => {
                        const color = t.toLabel.includes('Close') || t.toLabel === 'Close' ? 'var(--za-success)'
                          : t.toLabel.includes('Verloren') ? '#c0392b'
                          : t.toLabel.includes('No Show') ? 'var(--za-danger)'
                          : t.toLabel.includes('Angebot') ? 'var(--za-info)'
                          : t.toLabel.includes('CC2') ? 'var(--za-info)'
                          : t.toLabel.includes('Follow') ? 'var(--za-gold-2)'
                          : 'var(--za-violet)'
                        return <TransitionBar key={i} label={t.toLabel} count={t.count} total={cq.closingTotal} color={color} />
                      })}
                    </div>

                    {/* Calendly Closing Show-Rate */}
                    {(calActiveClosings + calCanceledClosings) > 0 && (
                      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', padding: '12px', background: 'rgba(249,249,249,0.03)', borderRadius: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--za-fg-4)' }}>Calendly Closings {periodLabel}:</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--za-success)' }}>{calActiveClosings} aktiv</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--za-danger)' }}>{calCanceledClosings} abgesagt</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>
                          Show-Rate: {Math.round((calActiveClosings / (calActiveClosings + calCanceledClosings)) * 100)}%
                        </span>
                      </div>
                    )}

                    {/* ── NO-SHOW RECOVERY ── */}
                    {pqAll.noShowRecovery.length > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--za-gold-2)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                          No-Show Recovery (gesamt)
                        </div>
                        {pqAll.noShowRecovery.map((t, i) => (
                          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0', fontSize: '12px' }}>
                            <span style={{ color: 'var(--za-fg-4)', minWidth: '130px', textAlign: 'right' }}>{t.fromLabel}</span>
                            <span style={{ color: 'var(--za-gold)' }}>&rarr;</span>
                            <span style={{ color: 'var(--za-fg-2)', fontWeight: 500 }}>{t.toLabel}</span>
                            <span style={{ fontFamily: 'var(--za-serif)', fontWeight: 700, color: '#fff' }}>{t.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              </div>

              {/* ═══ CALENDLY TERME ═══ */}
              <div id="sec-sales-calendly" style={{ display: activeSection === 'sec-sales-calendly' || !activeSection ? undefined : 'none' }}>
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

              </div>

              {/* ═══ PIPELINE: NEUKUNDE vs. BESTANDSKUNDE ═══ */}
              <div id="sec-sales-pipeline" style={{ display: activeSection === 'sec-sales-pipeline' || !activeSection ? undefined : 'none' }}>
              <div className="za-panel fade-up" style={{ animationDelay: '540ms', marginBottom: '16px', borderTop: '2px solid var(--za-success)', padding: '24px' }}>
                <div className="panel-head" style={{ marginBottom: '16px' }}>
                  <div>
                    <span className="panel-eyebrow" style={{ color: 'var(--za-success)' }}>Pipeline &amp; Upsells</span>
                    <div className="panel-title" style={{ fontSize: '18px' }}>
                      Neukunden vs. Bestandskunden
                    </div>
                  </div>
                </div>

                {/* KPI row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                  {[
                    { label: 'Neukunden-Deals', value: `${data.pipelineNeukunde.length}`, sub: fmtEuro(data.pipelineNeukundeValue), color: 'var(--za-info)' },
                    { label: 'Bestandskunden-Deals', value: `${data.pipelineBestandskunde.length}`, sub: fmtEuro(data.pipelineBestandskundeValue), color: 'var(--za-violet)' },
                    { label: 'Upsells (Won)', value: `${data.upsellDealsList.length}`, sub: `${fmtEuro(data.upsellDealsList.reduce((s, d) => s + d.value, 0))} Umsatz`, color: 'var(--za-success)' },
                    { label: 'Upsell-Rate', value: `${data.customerAnalytics.upsellRate}%`, sub: `${data.customerAnalytics.upsellCustomers} von ${data.customerAnalytics.totalCustomers} Kunden`, color: 'var(--za-gold-2)' },
                  ].map((kpi, i) => (
                    <div key={i} style={{ padding: '14px', background: 'rgba(249,249,249,0.03)', borderRadius: '8px', borderLeft: `3px solid ${kpi.color}` }}>
                      <div style={{ fontSize: '10px', color: 'var(--za-fg-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>{kpi.label}</div>
                      <div style={{ fontFamily: 'var(--za-serif)', fontSize: '22px', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                      <div style={{ fontSize: '11px', color: 'var(--za-fg-4)', marginTop: '1px' }}>{kpi.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Two columns: Neukunde | Bestandskunde pipeline */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  {/* Neukunden Pipeline */}
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--za-info)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                      Neukunden in Pipeline ({data.pipelineNeukunde.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                      {data.pipelineNeukunde.length === 0 && <div style={{ fontSize: '12px', color: 'var(--za-fg-4)' }}>Keine aktiven Deals</div>}
                      {data.pipelineNeukunde.map((d, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '8px 10px', background: 'rgba(249,249,249,0.03)', borderRadius: '6px',
                          borderLeft: '3px solid var(--za-info)',
                        }}>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{d.leadName}</div>
                            <div style={{ fontSize: '10px', color: 'var(--za-fg-4)' }}>{d.status}</div>
                          </div>
                          <div style={{ fontFamily: 'var(--za-serif)', fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                            {d.value > 0 ? fmtEuro(d.value) : '-'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bestandskunden Pipeline */}
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--za-violet)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                      Bestandskunden in Pipeline ({data.pipelineBestandskunde.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                      {data.pipelineBestandskunde.length === 0 && <div style={{ fontSize: '12px', color: 'var(--za-fg-4)' }}>Keine aktiven Deals</div>}
                      {data.pipelineBestandskunde.map((d, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '8px 10px', background: 'rgba(249,249,249,0.03)', borderRadius: '6px',
                          borderLeft: '3px solid var(--za-violet)',
                        }}>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{d.leadName}</div>
                            <div style={{ fontSize: '10px', color: 'var(--za-fg-4)' }}>{d.status}</div>
                          </div>
                          <div style={{ fontFamily: 'var(--za-serif)', fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                            {d.value > 0 ? fmtEuro(d.value) : '-'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Upsell History */}
                {data.upsellDealsList.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--za-success)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                      Abgeschlossene Upsells
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {data.upsellDealsList.map((d, i) => (
                        <div key={i} style={{
                          display: 'grid', gridTemplateColumns: '1fr auto auto',
                          alignItems: 'center', gap: '12px',
                          padding: '8px 10px', background: 'rgba(78,138,107,0.06)', borderRadius: '6px',
                          borderLeft: '3px solid var(--za-success)',
                        }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{d.leadName}</div>
                          <div style={{ fontFamily: 'var(--za-serif)', fontSize: '13px', fontWeight: 700, color: 'var(--za-success)' }}>
                            {fmtEuro(d.value)}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--za-fg-4)' }}>{fmtDate(d.date)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

              </div>

              <div id="sec-sales-leaderboard" style={{ display: activeSection === 'sec-sales-leaderboard' || !activeSection ? undefined : 'none' }}>
              {/* Weekly Leaderboard with Points */}
              {(() => {
                const weekTeam = data.teamPerformanceWeek || []
                // Build ranked list: 1 Setting = 50 Punkte, 1 Anwahl = 1 Punkt
                const ranked = [...weekTeam]
                  .map(m => ({ ...m, punkte: m.settingsGelegt * 50 + m.calls }))
                  .sort((a, b) => b.punkte - a.punkte)
                const maxPunkte = Math.max(...ranked.map(m => m.punkte), 1)
                return (
                  <div className="za-panel fade-up" style={{ animationDelay: '720ms', marginBottom: '16px' }}>
                    <div className="panel-head">
                      <div>
                        <span className="panel-eyebrow">Leaderboard</span>
                        <div className="panel-title">Diese Woche &middot; KW {data.currentWeek}</div>
                      </div>
                      <span className="panel-sub" style={{ fontSize: '10px', color: 'var(--za-fg-4)' }}>1 Setting = 50 Pkt &middot; 1 Anwahl = 1 Pkt</span>
                    </div>
                    {ranked.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--za-fg-3)', fontSize: '12px' }}>Noch keine Aktivit&auml;ten diese Woche</div>
                    ) : (
                      <div style={{ marginTop: '4px' }}>
                        {ranked.map((m, i) => {
                          const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''
                          const firstName = m.name.split(' ')[0]
                          return (
                            <div key={m.name} className="leaderboard-row" style={{ marginBottom: '8px' }}>
                              <div className={`leaderboard-pos ${posClass}`} style={i >= 3 ? { background: 'rgba(255,255,255,0.06)', color: 'var(--za-fg-3)' } : undefined}>{i + 1}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{firstName}</span>
                                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                    <div style={{ textAlign: 'center' }}>
                                      <div style={{ fontSize: '10px', color: 'var(--za-fg-4)', marginBottom: '1px' }}>Anwahlen</div>
                                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--za-info)' }}>{m.calls}</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                      <div style={{ fontSize: '10px', color: 'var(--za-fg-4)', marginBottom: '1px' }}>Settings</div>
                                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--za-gold)' }}>{m.settingsGelegt}</div>
                                    </div>
                                    <div style={{ textAlign: 'center', minWidth: '52px' }}>
                                      <div style={{ fontSize: '10px', color: 'var(--za-fg-4)', marginBottom: '1px' }}>Punkte</div>
                                      <div style={{ fontSize: '15px', fontWeight: 800, color: i === 0 ? 'var(--za-gold-2)' : '#fff' }}>{m.punkte}</div>
                                    </div>
                                  </div>
                                </div>
                                <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                  <div className="leaderboard-bar" style={{ width: `${(m.punkte / maxPunkte) * 100}%` }} />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Opener Streak Tracker */}
              {(() => {
                const openers = data.openerTracking?.openers || []
                // Also compute streaks from team performance (settings per day) for non-openers
                const allMembers = data.teamPerformanceWeek || []
                // For streaks we use opener tracking data (daily log)
                if (openers.length === 0 && allMembers.length === 0) return null
                return (
                  <div className="za-panel fade-up" style={{ animationDelay: '740ms', marginBottom: '16px' }}>
                    <div className="panel-head">
                      <div>
                        <span className="panel-eyebrow">Streak Tracker</span>
                        <div className="panel-title">Aufeinanderfolgende Arbeitstage mit Terminen</div>
                      </div>
                    </div>
                    {openers.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--za-fg-3)', fontSize: '12px' }}>
                        Keine Opener-Tracking-Daten vorhanden. Streaks werden aus der Supabase-Tabelle <em>opener_aufstieg</em> berechnet.
                      </div>
                    ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${openers.length}, 1fr)`, gap: '16px' }}>
                      {openers.map((opener, idx) => {
                        const sortedLog = [...opener.dailyLog].sort((a, b) => b.date.localeCompare(a.date))
                        let streak = 0
                        const today = data.todayISO
                        let checkDate = new Date(today + 'T12:00:00')
                        const todayEntry = sortedLog.find(e => e.date === today)
                        if (!todayEntry || todayEntry.count === 0) {
                          checkDate = new Date(checkDate.getTime() - 86400000)
                        }
                        for (let d = 0; d < 365; d++) {
                          const dateStr = checkDate.toISOString().split('T')[0]
                          const dayOfWeek = checkDate.getDay()
                          if (dayOfWeek === 0 || dayOfWeek === 6) {
                            checkDate = new Date(checkDate.getTime() - 86400000)
                            continue
                          }
                          const entry = sortedLog.find(e => e.date === dateStr)
                          if (entry && entry.count > 0) {
                            streak++
                            checkDate = new Date(checkDate.getTime() - 86400000)
                          } else {
                            break
                          }
                        }
                        let bestStreak = 0
                        let currentRun = 0
                        const chronLog = [...opener.dailyLog].sort((a, b) => a.date.localeCompare(b.date))
                        for (const entry of chronLog) {
                          const d = new Date(entry.date + 'T12:00:00')
                          if (d.getDay() === 0 || d.getDay() === 6) continue
                          if (entry.count > 0) { currentRun++; bestStreak = Math.max(bestStreak, currentRun) }
                          else { currentRun = 0 }
                        }

                        const firstName = opener.name.split(' ')[0]
                        const flameSize = Math.min(streak, 10)
                        const flames = streak >= 10 ? '\uD83D\uDD25\uD83D\uDD25\uD83D\uDD25' : streak >= 5 ? '\uD83D\uDD25\uD83D\uDD25' : streak >= 1 ? '\uD83D\uDD25' : '\u2744\uFE0F'

                        return (
                          <div key={idx} style={{ textAlign: 'center', padding: '16px 0' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--za-fg-2)', marginBottom: '10px' }}>{firstName}</div>
                            <div className={streak > 0 ? 'streak-flame' : ''} style={{ fontSize: `${20 + flameSize * 3}px`, lineHeight: 1 }}>
                              {flames}
                            </div>
                            <div style={{ fontSize: '36px', fontWeight: 700, fontFamily: 'var(--za-serif)', color: streak > 0 ? '#fff' : 'var(--za-fg-3)', marginTop: '6px' }}>
                              {streak}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--za-fg-3)', marginTop: '2px' }}>
                              {streak === 1 ? 'Tag' : 'Tage'} in Folge
                            </div>
                            {bestStreak > streak && (
                              <div style={{ fontSize: '10px', color: 'var(--za-fg-4)', marginTop: '6px' }}>
                                Rekord: {bestStreak} Tage
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    )}
                  </div>
                )
              })()}

              </div>

              <div id="sec-sales-won" style={{ display: activeSection === 'sec-sales-won' || !activeSection ? undefined : 'none' }}>
              {/* Won Deals list */}
              <div className="za-panel fade-up" style={{ animationDelay: '760ms', marginBottom: '16px' }}>
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

              </div>

              <div id="sec-sales-leads" style={{ display: activeSection === 'sec-sales-leads' || !activeSection ? undefined : 'none' }}>
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

              </div>

              <div id="sec-sales-revenue" style={{ display: activeSection === 'sec-sales-revenue' || !activeSection ? undefined : 'none' }}>
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
              </div>

            </>
          )}

          {/* ═══════════════════════════════════════════════════
               TAB: FULFILLMENT
             ═══════════════════════════════════════════════════ */}
          {activeNav === 'fulfillment' && (
            <>
              <div id="sec-fulfillment-clockodo" style={{ display: activeSection === 'sec-fulfillment-clockodo' || !activeSection ? undefined : 'none' }}>
              {/* ── Nils Holland — Stundenkonto (Hero Panel) ── */}
              <div className="za-panel fade-up" style={{ animationDelay: '20ms', borderTop: '2px solid var(--za-gold, #d4a843)', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Clockodo Zeiterfassung</span>
                    <div className="panel-title">Nils Holland &mdash; Stundenkonto</div>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>Jan&ndash;Apr 2026</span>
                </div>
                <div className="kpi-grid" style={{ padding: '0 16px 16px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--za-fg-2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Ist-Stunden</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--za-success, #4ade80)' }}>{fmtNum(data.nilsMetrics.totalIst)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>Soll: {fmtNum(data.nilsMetrics.totalSoll)}h ({data.nilsMetrics.differenz >= 0 ? '+' : ''}{data.nilsMetrics.differenz}h {data.nilsMetrics.differenz >= 0 ? '\u00DCberstunden' : 'Fehlstunden'})</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--za-fg-2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Erf&uuml;llung</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--za-success, #4ade80)' }}>{data.nilsMetrics.totalSoll > 0 ? Math.round((data.nilsMetrics.totalIst / data.nilsMetrics.totalSoll) * 100) : 0}%</div>
                    <div style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>Soll vs. Ist gesamt</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--za-fg-2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>&Oslash; Stunden/Tag</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--za-fg-1)' }}>{data.nilsMetrics.avgHoursPerDay.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h</div>
                    <div style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>{data.nilsMetrics.daysWorked} Arbeitstage</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--za-fg-2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Fehlzeiten</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--za-fg-1)' }}>{data.nilsMetrics.urlaubDays + data.nilsMetrics.krankDays + data.nilsMetrics.fehlendDays} Tage</div>
                    <div style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>{data.nilsMetrics.urlaubDays} Urlaub, {data.nilsMetrics.krankDays} Krank, {data.nilsMetrics.fehlendDays} Fehlend</div>
                  </div>
                </div>
              </div>

              {/* ── Monthly Breakdown — Chart + Table ── */}
              <div className="za-panel fade-up" style={{ animationDelay: '40ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Monats&uuml;bersicht</span>
                    <div className="panel-title">Ist vs. Soll &mdash; pro Monat</div>
                  </div>
                </div>
                {/* Bar Chart */}
                <div style={{ padding: '0 16px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '140px', marginBottom: '12px' }}>
                    {data.nilsMetrics.months.map((m, i) => {
                      const maxH = Math.max(...data.nilsMetrics.months.map(x => Math.max(x.istHours, x.sollHours)))
                      const istPct = maxH > 0 ? (m.istHours / maxH) * 100 : 0
                      const sollPct = maxH > 0 ? (m.sollHours / maxH) * 100 : 0
                      const shortLabel = m.monthLabel.split(' ')[0].substring(0, 3)
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <div style={{ fontSize: '10px', fontWeight: 600, color: m.erfuellungPct >= 100 ? 'var(--za-success, #4ade80)' : 'var(--za-fg-2)' }}>{m.istHours}h</div>
                          <div style={{ width: '100%', display: 'flex', gap: '4px', alignItems: 'flex-end', justifyContent: 'center', height: '100px' }}>
                            <div style={{ width: '40%', height: `${sollPct}%`, background: 'rgba(255,255,255,0.08)', borderRadius: '4px 4px 0 0', minHeight: '4px' }} title={`Soll: ${m.sollHours}h`} />
                            <div style={{ width: '40%', height: `${istPct}%`, background: m.erfuellungPct >= 100 ? 'var(--za-success, #4ade80)' : m.erfuellungPct >= 95 ? 'var(--za-warning, #fb923c)' : 'var(--za-error, #f87171)', borderRadius: '4px 4px 0 0', minHeight: '4px', opacity: 0.85 }} title={`Ist: ${m.istHours}h`} />
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--za-fg-3)' }}>{shortLabel}</div>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', fontSize: '10px', color: 'var(--za-fg-3)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', display: 'inline-block' }} /> Soll</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--za-success, #4ade80)', opacity: 0.85, display: 'inline-block' }} /> Ist</span>
                  </div>
                </div>
                {/* Table */}
                <div className="za-table-wrap">
                  <table className="za-table">
                    <thead>
                      <tr>
                        <th>Monat</th>
                        <th style={{ textAlign: 'right' }}>Soll</th>
                        <th style={{ textAlign: 'right' }}>Ist</th>
                        <th style={{ textAlign: 'right' }}>Erf&uuml;llung</th>
                        <th style={{ textAlign: 'right' }}>Tage</th>
                        <th style={{ textAlign: 'right' }}>&Oslash;/Tag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.nilsMetrics.months.map((m, i) => {
                        const erfColor = m.erfuellungPct >= 100 ? 'var(--za-success, #4ade80)' : m.erfuellungPct >= 95 ? 'var(--za-warning, #fb923c)' : 'var(--za-error, #f87171)'
                        const shortLabel = m.monthLabel.split(' ')[0].substring(0, 3) + ' ' + m.monthLabel.split(' ')[1]
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{shortLabel}</td>
                            <td style={{ textAlign: 'right' }}>{m.sollHours}h</td>
                            <td style={{ textAlign: 'right' }}>{m.istHours}h</td>
                            <td style={{ textAlign: 'right', color: erfColor, fontWeight: 600 }}>{m.erfuellungPct}%{m.erfuellungPct >= 100 ? ' \u2705' : ''}</td>
                            <td style={{ textAlign: 'right' }}>{m.daysWorked}</td>
                            <td style={{ textAlign: 'right' }}>{m.avgHoursPerDay.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Updated Cost Panel (real data) ── */}
              <div className="za-panel fade-up" style={{ animationDelay: '50ms', borderTop: '2px solid var(--za-gold, #d4a843)', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Kostenanalyse (tats&auml;chlich)</span>
                    <div className="panel-title">Nils Holland &mdash; Kosten</div>
                  </div>
                </div>
                <div className="kpi-grid" style={{ padding: '0 16px 16px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--za-fg-2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Cost/Stunde</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--za-gold, #d4a843)' }}>&euro;{data.nilsMetrics.costPerHour.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>tats&auml;chlich (Ist-Stunden)</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--za-fg-2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Cost/Tag</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--za-fg-1)' }}>&euro;{data.nilsMetrics.costPerDay.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>tats&auml;chlich ({data.nilsMetrics.daysWorked} Tage)</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--za-fg-2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Cost/Kunde/Mo</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--za-fg-1)' }}>&euro;800</div>
                    <div style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>{fmtEuro(data.nilsMetrics.costPerMonth)} / 6 Kunden</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--za-fg-2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Delivery Q1</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--za-fg-1)' }}>&euro;{(data.nilsMetrics.costPerMonth * 3).toLocaleString('de-DE')}</div>
                    <div style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>3 Mon. &times; {fmtEuro(data.nilsMetrics.costPerMonth)}</div>
                  </div>
                </div>
              </div>

              {/* KPI Grid — Monday.com Snapshot (hardcoded, will be automated via API later) */}
              <div className="kpi-grid">
                <div className="za-panel fade-up" style={{ animationDelay: '60ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Tasks gesamt</span></div>
                  <div className="kpi-value">64</div>
                  <div className="kpi-foot"><span className="kpi-caption">Lisa: 38, Nils: 26</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '140ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Erledigt</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-success, #4ade80)' }}>5</div>
                  <div className="kpi-foot"><span className="kpi-caption">Lisa: 1, Nils: 4</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '220ms' }}>
                  <div className="kpi-top"><span className="kpi-label">In Arbeit</span></div>
                  <div className="kpi-value">24</div>
                  <div className="kpi-foot"><span className="kpi-caption">Bearbeitung + Warte auf Ausf&uuml;hrung</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '300ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Offen</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-warning, #fb923c)' }}>35</div>
                  <div className="kpi-foot"><span className="kpi-caption">Noch nicht begonnen</span></div>
                </div>
              </div>

              {/* Team Overview — Lisa vs Nils */}
              </div>
              <div id="sec-fulfillment-monday" style={{ display: activeSection === 'sec-fulfillment-monday' || !activeSection ? undefined : 'none' }}>
              <div className="za-panel fade-up" style={{ animationDelay: '360ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Monday.com Boards</span>
                    <div className="panel-title">Team&uuml;bersicht</div>
                  </div>
                </div>
                <div className="za-table-wrap">
                  <table className="za-table">
                    <thead><tr><th></th><th>Lisa</th><th>Nils</th></tr></thead>
                    <tbody>
                      <tr><td style={{ fontWeight: 600 }}>Tasks gesamt</td><td>38</td><td>26</td></tr>
                      <tr><td style={{ fontWeight: 600 }}>Erledigt</td><td>1 <span style={{ color: 'var(--za-warning, #fb923c)', fontSize: '11px' }}>(3%)</span></td><td>4 <span style={{ color: 'var(--za-success, #4ade80)', fontSize: '11px' }}>(15%)</span></td></tr>
                      <tr><td style={{ fontWeight: 600 }}>In Bearbeitung</td><td>3</td><td>0</td></tr>
                      <tr><td style={{ fontWeight: 600 }}>Wartend</td><td>5</td><td>16</td></tr>
                      <tr><td style={{ fontWeight: 600 }}>Neu/Offen</td><td>29</td><td>6</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Lisa's Tasks */}
              <div className="za-panel fade-up" style={{ animationDelay: '420ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Board 5093790899</span>
                    <div className="panel-title">Lisa &mdash; Tasks</div>
                  </div>
                </div>
                {[
                  { group: 'T\u00e4glich', tasks: ['Felix LinkedIn', 'Lisa LinkedIn', 'Felix Reels', 'Nils Check-In pr\u00fcfen'] },
                  { group: 'W\u00f6chentlich', tasks: ['Wochen-Reviews', 'Content-Vorlauf', 'Finanzen'] },
                  { group: 'Monatlich', tasks: ['USt-Voranmeldung', 'Monatsabschluss', 'SEPA'] },
                ].map((cat, i) => (
                  <div key={i} style={{ padding: '0 16px 12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--za-fg-2)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{cat.group}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {cat.tasks.map((t, j) => (
                        <span key={j} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: 'var(--za-fg-3)', border: '1px solid var(--za-border)' }}>{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Nils' Tasks */}
              <div className="za-panel fade-up" style={{ animationDelay: '480ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Board 1980813409</span>
                    <div className="panel-title">Nils &mdash; Tasks</div>
                  </div>
                </div>
                {[
                  { group: 'T\u00e4glich', tasks: ['Check-In', 'Clockodo', 'Reels schneiden', 'LinkedIn Posts', 'Check-Out'] },
                  { group: 'Projekte', tasks: ['Testimonial Karussell', 'Funnel D2D', 'Fallstudien PDF', 'Phantom Buster'] },
                  { group: 'Kunden', tasks: ['Hendrik', 'Felix Zoepp', 'Michael Kr\u00fcger', 'Sales Promotion', 'ManyReasons'] },
                ].map((cat, i) => (
                  <div key={i} style={{ padding: '0 16px 12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--za-fg-2)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{cat.group}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {cat.tasks.map((t, j) => (
                        <span key={j} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: 'var(--za-fg-3)', border: '1px solid var(--za-border)' }}>{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              </div>
              <div id="sec-fulfillment-analyse" style={{ display: activeSection === 'sec-fulfillment-analyse' || !activeSection ? undefined : 'none' }}>
              {/* Insights */}
              <div className="za-panel fade-up" style={{ animationDelay: '540ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Analyse</span>
                    <div className="panel-title">Insights &amp; Empfehlungen</div>
                  </div>
                </div>
                <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--za-warning, #fb923c)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span>{'\u26A0\uFE0F'}</span><span>Lisa: 76% der Tasks noch nicht begonnen (29/38 auf &laquo;Neu&raquo;)</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--za-warning, #fb923c)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span>{'\u26A0\uFE0F'}</span><span>Nils: 62% der Tasks warten auf Ausf&uuml;hrung (16/26)</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--za-info, #60a5fa)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span>{'\uD83D\uDCA1'}</span><span>Empfehlung: Tasks t&auml;gliches Abhaken einf&uuml;hren f&uuml;r Produktivit&auml;ts-Tracking</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--za-fg-3)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span>{'\uD83D\uDCCA'}</span><span>Board zuletzt aktualisiert: Lisa 14.04, Nils 19.04</span>
                  </div>
                </div>
              </div>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════
               TAB: MARKETING
             ═══════════════════════════════════════════════════ */}
          {activeNav === 'marketing' && (() => {
            const fb = data.facebookMetrics
            const mk = data.marketingMetrics
            const t = fb.totals
            const prev = fb.previousTotals

            // Delta helper
            const delta = (current: number, previous: number | undefined) => {
              if (!previous || previous === 0) return null
              const pct = ((current - previous) / previous) * 100
              return pct
            }
            const deltaStyle = (d: number | null, invertColor = false) => {
              if (d === null) return {}
              const isGood = invertColor ? d < 0 : d > 0
              return { color: isGood ? 'var(--za-green, #22c55e)' : d === 0 ? 'var(--za-fg-3)' : 'var(--za-red, #ef4444)', fontSize: '11px' }
            }
            const fmtDelta = (d: number | null) => d === null ? '' : `${d > 0 ? '+' : ''}${d.toFixed(1)}%`

            // Sort campaigns: active first, then by spend desc
            const sortedCampaigns = [...fb.campaigns]
              .filter(c => c.spend > 0)
              .sort((a, b) => {
                if (a.status === 'active' && b.status !== 'active') return -1
                if (b.status === 'active' && a.status !== 'active') return 1
                return b.spend - a.spend
              })

            // Webhook platforms
            const platformLabels: Record<string, string> = {
              onepage: 'OnePage', perspective: 'Perspective Funnels', copecart: 'CopeCart',
            }

            return (
            <>
              <div id="sec-marketing-facebook" style={{ display: activeSection === 'sec-marketing-facebook' || !activeSection ? undefined : 'none' }}>
              {/* Facebook Ads KPIs */}
              {fb.available && (
                <>
                  <div style={{ fontSize: '10px', color: 'var(--za-fg-4)', marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    Facebook Ads &middot; {fmtDate(fb.period.start)} &ndash; {fmtDate(fb.period.end)}
                  </div>
                  <div className="kpi-grid">
                    {[
                      { label: 'Ad Spend', value: fmtEuro(t.spend), delta: delta(t.spend, prev?.spend), invert: true },
                      { label: 'Impressions', value: fmtNum(t.impressions), delta: delta(t.impressions, prev?.impressions) },
                      { label: 'Reichweite', value: fmtNum(t.reach), delta: delta(t.reach, prev?.reach) },
                      { label: 'Link-Klicks', value: fmtNum(t.linkClicks), delta: delta(t.linkClicks, prev?.linkClicks) },
                      { label: 'Leads', value: fmtNum(t.leads), delta: delta(t.leads, prev?.leads) },
                      { label: 'CPL', value: t.cpl > 0 ? fmtEuro(t.cpl) : '\u2014', delta: delta(t.cpl, prev?.cpl), invert: true },
                      { label: 'CTR', value: `${t.ctr}%`, delta: delta(t.ctr, prev?.ctr) },
                      { label: 'LP Views', value: fmtNum(t.landingPageViews), delta: delta(t.landingPageViews, prev?.landingPageViews) },
                    ].map((kpi, i) => (
                      <div key={i} className="za-panel fade-up" style={{ animationDelay: `${60 + i * 40}ms` }}>
                        <div className="kpi-top"><span className="kpi-label">{kpi.label}</span></div>
                        <div className="kpi-value">{kpi.value}</div>
                        <div className="kpi-foot">
                          {kpi.delta !== null && kpi.delta !== undefined ? (
                            <span style={deltaStyle(kpi.delta, kpi.invert)}>{fmtDelta(kpi.delta)} vs. Vorperiode</span>
                          ) : (
                            <span className="kpi-caption">&nbsp;</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Campaign Table — with real Perspective Funnel Leads */}
                  {(() => {
                    // Map utm_campaign IDs to Facebook campaign names
                    const campaignIdMap: Record<string, string> = {
                      '120242496581910485': 'Cold Traffic I Leads I Erstgespräch',
                      '120241213207600485': 'Cold Traffic I Leads I Sales Call Aufzeichnung',
                      '120240917728170485': 'April I Direktansprache auf VSL',
                      '120241672667400485': 'Cold Traffic I Leads I Erstgespräch',
                    }

                    // Enrich campaigns with Perspective funnel lead counts
                    const enriched = sortedCampaigns.map(c => {
                      // Find matching perspective campaign by name
                      const matchingPerspective = mk.perspectiveByCampaign.filter(pc => {
                        const fbName = campaignIdMap[pc.campaignId]
                        return fbName && c.name.includes(fbName.split(' I ')[0])
                      })
                      // Or exact match via campaignIdMap
                      const exactMatch = mk.perspectiveByCampaign.find(pc => campaignIdMap[pc.campaignId] === c.name)

                      const funnelLeads = exactMatch?.leads || matchingPerspective.reduce((s, p) => s + p.leads, 0)
                      const funnelConverted = exactMatch?.converted || matchingPerspective.reduce((s, p) => s + p.converted, 0)
                      const realCPL = funnelLeads > 0 ? Math.round(c.spend / funnelLeads * 100) / 100 : 0

                      return { ...c, funnelLeads, funnelConverted, realCPL }
                    })

                    // Total funnel leads
                    const totalFunnelLeads = mk.perspective.totalLeads
                    const totalAdSpend = t.spend
                    const realTotalCPL = totalFunnelLeads > 0 ? Math.round(totalAdSpend / totalFunnelLeads * 100) / 100 : 0

                    return (
                    <div className="za-panel fade-up" style={{ animationDelay: '380ms', marginBottom: '16px' }}>
                      <div className="panel-head">
                        <div><div className="panel-title">Kampagnen &rarr; Perspective Funnel Performance</div></div>
                      </div>
                      <div style={{ overflow: 'auto' }}>
                        <table className="za-table" style={{ width: '100%' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left' }}>Kampagne</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'right' }}>Spend</th>
                              <th style={{ textAlign: 'right' }}>Reichweite</th>
                              <th style={{ textAlign: 'right' }}>Klicks</th>
                              <th style={{ textAlign: 'right' }}>CTR</th>
                              <th style={{ textAlign: 'right' }}>LP Views</th>
                              <th style={{ textAlign: 'right', background: 'rgba(34,197,94,0.05)' }}>Funnel Leads</th>
                              <th style={{ textAlign: 'right', background: 'rgba(34,197,94,0.05)' }}>CPL (real)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {enriched.map((c, i) => {
                              const cplColor = c.realCPL > 0
                                ? c.realCPL < 80 ? 'var(--za-green, #22c55e)' : c.realCPL > 200 ? 'var(--za-red, #ef4444)' : 'var(--za-fg-2)'
                                : 'var(--za-fg-3)'
                              return (
                                <tr key={i}>
                                  <td style={{ fontWeight: 500, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</td>
                                  <td style={{ textAlign: 'center' }}>
                                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: c.status === 'active' ? 'var(--za-green, #22c55e)' : 'var(--za-fg-4)' }} />
                                  </td>
                                  <td style={{ textAlign: 'right' }}>{fmtEuro(c.spend)}</td>
                                  <td style={{ textAlign: 'right' }}>{fmtNum(c.reach)}</td>
                                  <td style={{ textAlign: 'right' }}>{fmtNum(c.linkClicks)}</td>
                                  <td style={{ textAlign: 'right' }}>{c.ctr > 0 ? `${c.ctr.toFixed(1)}%` : '\u2014'}</td>
                                  <td style={{ textAlign: 'right' }}>{c.landingPageViews > 0 ? fmtNum(c.landingPageViews) : '\u2014'}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 600, background: 'rgba(34,197,94,0.05)' }}>{c.funnelLeads > 0 ? c.funnelLeads : '\u2014'}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 600, color: cplColor, background: 'rgba(34,197,94,0.05)' }}>{c.realCPL > 0 ? fmtEuro(c.realCPL) : '\u2014'}</td>
                                </tr>
                              )
                            })}
                            <tr style={{ borderTop: '2px solid var(--za-border)', fontWeight: 600 }}>
                              <td>GESAMT</td>
                              <td></td>
                              <td style={{ textAlign: 'right' }}>{fmtEuro(totalAdSpend)}</td>
                              <td style={{ textAlign: 'right' }}>{fmtNum(t.reach)}</td>
                              <td style={{ textAlign: 'right' }}>{fmtNum(t.linkClicks)}</td>
                              <td style={{ textAlign: 'right' }}>{t.ctr}%</td>
                              <td style={{ textAlign: 'right' }}>{fmtNum(t.landingPageViews)}</td>
                              <td style={{ textAlign: 'right', background: 'rgba(34,197,94,0.05)' }}>{totalFunnelLeads}</td>
                              <td style={{ textAlign: 'right', background: 'rgba(34,197,94,0.05)' }}>{realTotalCPL > 0 ? fmtEuro(realTotalCPL) : '\u2014'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Performance Analyse */}
                      {totalFunnelLeads > 0 && (
                        <div style={{ padding: '12px 0', borderTop: '1px solid var(--za-border)', marginTop: '8px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--za-fg-2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Performance Analyse</div>
                          {enriched.filter(c => c.funnelLeads > 0).sort((a, b) => a.realCPL - b.realCPL).map((c, i, arr) => {
                            const isBest = i === 0
                            const isWorst = i === arr.length - 1 && arr.length > 1
                            const lpToFunnel = c.landingPageViews > 0 ? Math.round(c.funnelLeads / c.landingPageViews * 1000) / 10 : 0
                            return (
                              <div key={i} style={{ fontSize: '12px', color: 'var(--za-fg-3)', padding: '4px 0', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isBest ? 'var(--za-green, #22c55e)' : isWorst ? 'var(--za-red, #ef4444)' : 'var(--za-fg-4)', flexShrink: 0 }} />
                                <span>
                                  <strong>{c.name}</strong>: {fmtEuro(c.realCPL)}/Lead, {c.funnelLeads} Leads, LP→Funnel Conv. {lpToFunnel}%
                                  {isBest && <span style={{ color: 'var(--za-green, #22c55e)', fontWeight: 600 }}> — Top Performer, skalieren!</span>}
                                  {isWorst && c.realCPL > 200 && <span style={{ color: 'var(--za-red, #ef4444)', fontWeight: 600 }}> — CPL zu hoch, optimieren oder killen</span>}
                                </span>
                              </div>
                            )
                          })}
                          <div style={{ fontSize: '12px', color: 'var(--za-fg-3)', padding: '6px 0 2px', marginTop: '4px', borderTop: '1px solid var(--za-border)' }}>
                            Gesamt: <strong>{fmtEuro(totalAdSpend)}</strong> Adspend &rarr; <strong>{totalFunnelLeads}</strong> Funnel-Leads &rarr; <strong>{fmtEuro(realTotalCPL)}</strong>/Lead
                          </div>
                        </div>
                      )}
                    </div>
                    )
                  })()}
                </>
              )}

              </div>
              <div id="sec-marketing-overview" style={{ display: activeSection === 'sec-marketing-overview' || !activeSection ? undefined : 'none' }}>
              {/* Perspective Funnels Section */}
              {mk.perspective.totalLeads > 0 && (
                <>
                  <div style={{ fontSize: '10px', color: 'var(--za-fg-4)', marginBottom: '8px', marginTop: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    Perspective Funnels &middot; {mk.perspective.totalLeads} Leads gesamt
                  </div>

                  <div className="kpi-grid" style={{ marginBottom: '16px' }}>
                    <div className="za-panel fade-up" style={{ animationDelay: '420ms' }}>
                      <div className="kpi-top"><span className="kpi-label">Funnel Leads</span></div>
                      <div className="kpi-value">{fmtNum(mk.perspective.totalLeads)}</div>
                      <div className="kpi-foot"><span className="kpi-caption">Gesamt</span></div>
                    </div>
                    <div className="za-panel fade-up" style={{ animationDelay: '460ms' }}>
                      <div className="kpi-top"><span className="kpi-label">Completed</span></div>
                      <div className="kpi-value">{fmtNum(mk.perspective.completedLeads)}</div>
                      <div className="kpi-foot"><span className="kpi-caption">Funnel abgeschlossen</span></div>
                    </div>
                    <div className="za-panel fade-up" style={{ animationDelay: '500ms' }}>
                      <div className="kpi-top"><span className="kpi-label">Converted</span></div>
                      <div className="kpi-value">{fmtNum(mk.perspective.convertedLeads)}</div>
                      <div className="kpi-foot"><span className="kpi-caption">Kontakt hinterlassen</span></div>
                    </div>
                    <div className="za-panel fade-up" style={{ animationDelay: '540ms' }}>
                      <div className="kpi-top"><span className="kpi-label">Conv. Rate</span></div>
                      <div className="kpi-value">{mk.perspective.conversionRate}%</div>
                      <div className="kpi-foot"><span className="kpi-caption">Lead &rarr; Converted</span></div>
                    </div>
                  </div>

                  {/* Funnel breakdown */}
                  {mk.perspective.funnels.length > 0 && (
                    <div className="za-panel fade-up" style={{ animationDelay: '560ms', marginBottom: '16px' }}>
                      <div className="panel-head">
                        <div><div className="panel-title">Funnel Breakdown</div></div>
                      </div>
                      <table className="za-table" style={{ width: '100%' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left' }}>Funnel</th>
                            <th style={{ textAlign: 'right' }}>Leads</th>
                            <th style={{ textAlign: 'right' }}>Completed</th>
                            <th style={{ textAlign: 'right' }}>Converted</th>
                            <th style={{ textAlign: 'right' }}>Conv. Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mk.perspective.funnels.map((f, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 500 }}>{f.name}</td>
                              <td style={{ textAlign: 'right' }}>{f.leads}</td>
                              <td style={{ textAlign: 'right' }}>{f.completed}</td>
                              <td style={{ textAlign: 'right' }}>{f.converted}</td>
                              <td style={{ textAlign: 'right' }}>{f.leads > 0 ? `${(f.converted / f.leads * 100).toFixed(1)}%` : '\u2014'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Recent Perspective Leads */}
                  {mk.perspective.recentLeads.length > 0 && (
                    <div className="za-panel fade-up" style={{ animationDelay: '600ms', marginBottom: '16px' }}>
                      <div className="panel-head">
                        <div><div className="panel-title">Letzte Perspective Leads</div></div>
                      </div>
                      <div style={{ maxHeight: '250px', overflow: 'auto' }}>
                        <table className="za-table" style={{ width: '100%' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left' }}>Name</th>
                              <th style={{ textAlign: 'left' }}>Funnel</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'right' }}>Zeitpunkt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mk.perspective.recentLeads.map((l, i) => (
                              <tr key={i}>
                                <td style={{ fontWeight: 500 }}>{l.name || l.email || 'Anonym'}</td>
                                <td style={{ color: 'var(--za-fg-3)', fontSize: '12px' }}>{l.funnel_name}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <span style={{
                                    display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                                    background: l.converted ? 'rgba(34,197,94,0.15)' : l.completed ? 'rgba(234,179,8,0.15)' : 'rgba(148,163,184,0.15)',
                                    color: l.converted ? 'var(--za-green, #22c55e)' : l.completed ? '#eab308' : 'var(--za-fg-3)',
                                  }}>
                                    {l.converted ? 'Converted' : l.completed ? 'Completed' : 'Started'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right', color: 'var(--za-fg-3)', fontSize: '11px' }}>{new Date(l.recorded_at).toLocaleString('de-DE')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Webhook Platform Cards (OnePage, CopeCart) */}
              <div style={{ fontSize: '10px', color: 'var(--za-fg-4)', marginBottom: '8px', marginTop: fb.available ? '8px' : '0', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Weitere Tools
              </div>
              <div className="row-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
                {['onepage', 'copecart'].map((key, i) => {
                  const p = mk.platforms[key]
                  const label = platformLabels[key] || key
                  return (
                    <div key={key} className="za-panel fade-up" style={{ animationDelay: `${480 + i * 60}ms` }}>
                      <div className="panel-head">
                        <div>
                          <div className="panel-title">{label}</div>
                          {p && <div style={{ fontSize: '10px', color: 'var(--za-fg-4)' }}>Stand: {new Date(p.recorded_at).toLocaleDateString('de-DE')}</div>}
                        </div>
                      </div>
                      <div style={{ padding: '4px 0' }}>
                        {p ? Object.entries(p.metrics).map(([k, v], j, arr) => (
                          <div key={k} style={{ fontSize: '12px', color: 'var(--za-fg-2)', padding: '6px 0', borderBottom: j < arr.length - 1 ? '1px solid var(--za-border)' : 'none', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--za-fg-3)' }}>{k}</span>
                            <span style={{ fontWeight: 500 }}>{typeof v === 'number' ? fmtNum(v) : String(v)}</span>
                          </div>
                        )) : (
                          <div style={{ fontSize: '12px', color: 'var(--za-fg-4)', padding: '12px 0', textAlign: 'center' }}>
                            Webhook: POST /api/marketing-webhook
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              </div>
            </>
            )
          })()}

          {/* ═══════════════════════════════════════════════════
               TAB: FINANZEN
             ═══════════════════════════════════════════════════ */}
          {activeNav === 'finanzen' && (() => {
            const dm = data.deliveryMetrics
            const deliveryCostPct = dm.totalMRR > 0 ? (dm.totalDeliveryCost / dm.totalMRR * 100).toFixed(1) : '0'
            const overheadPct = dm.totalMRR > 0 ? (dm.totalTeamCost / dm.totalMRR * 100).toFixed(1) : '0'
            const customersSorted = [...dm.customers].sort((a, b) => b.delivery.marginEuro - a.delivery.marginEuro)
            const top5 = customersSorted.slice(0, 5)

            // Team utilization data with Nils actual cost override
            const teamUtil = [
              { name: 'Felix', role: 'CEO/Sales', hours: dm.totalHoursFelx, maxHours: 160, cost: 5000 },
              { name: 'Nils', role: 'Content', hours: dm.totalHoursNils, maxHours: 160, cost: 4800 },
              { name: 'Marcel', role: 'Oversight', hours: dm.totalHoursMarcel, maxHours: 40, cost: 1250 },
              { name: 'Lisa', role: 'Operations', hours: dm.totalHoursLisa, maxHours: 160, cost: 2500 },
            ]

            // Airtable Cash-In Monatsauswahl
            const cashInMonths = data.airtableCashIn?.months || []
            const [selYear, selMonth] = finanzMonat.split('-').map(Number)
            const selectedCashIn = cashInMonths.find(m => m.year === selYear && m.month === selMonth)
            const cashInNetto = selectedCashIn?.totalNetto ?? dm.cashInMonatNetto
            const cashInBrutto = selectedCashIn?.totalBrutto ?? dm.cashInMonatBrutto
            const cashInCustomers = selectedCashIn?.customers || []
            const cashInLabel = selectedCashIn?.label || finanzMonat
            const fc = dm.fixedCosts || { teamInklKK: 15000, toolsAmex: 10000, buchhaltung: 2500, total: 27500 }
            const totalFixedCosts = fc.total || dm.totalFixedCosts || 27500
            const netProfit = cashInNetto - totalFixedCosts
            const netProfitPct = cashInNetto > 0 ? (netProfit / cashInNetto * 100).toFixed(1) : '0'

            return (
            <>
              <div id="sec-finanzen-overview" style={{ display: activeSection === 'sec-finanzen-overview' || !activeSection ? undefined : 'none' }}>

              {/* Monats-Picker */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {cashInMonths.map((m) => {
                  const key = `${m.year}-${String(m.month).padStart(2, '0')}`
                  const isActive = key === finanzMonat
                  return (
                    <button key={key} onClick={() => setFinanzMonat(key)} style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: isActive ? '1px solid var(--za-gold)' : '1px solid rgba(249,249,249,0.1)',
                      background: isActive ? 'rgba(197,160,89,0.15)' : 'rgba(249,249,249,0.04)',
                      color: isActive ? 'var(--za-gold)' : 'var(--za-fg-3)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}>
                      {m.label.split(' ')[0].slice(0, 3)} {m.year}
                    </button>
                  )
                })}
              </div>

              {/* Cash-In Hero */}
              <div className="kpi-grid">
                <div className="za-panel fade-up" style={{ animationDelay: '40ms', borderTop: '3px solid var(--za-success, #22c55e)' }}>
                  <div className="kpi-top"><span className="kpi-label">Cash-In {cashInLabel} (netto)</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-success, #22c55e)' }}><span className="kpi-unit-prefix">&euro;</span>{fmtNum(cashInNetto)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">{cashInCustomers.length} Positionen</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '100ms', borderTop: '3px solid var(--za-success, #22c55e)' }}>
                  <div className="kpi-top"><span className="kpi-label">Cash-In {cashInLabel} (brutto)</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-success, #22c55e)' }}><span className="kpi-unit-prefix">&euro;</span>{fmtNum(cashInBrutto)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">inkl. 19% MwSt.</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '160ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">Fixkosten gesamt</span></div>
                  <div className="kpi-value"><span className="kpi-unit-prefix">&euro;</span>{fmtNum(totalFixedCosts)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">Team {fmtNum(fc.teamInklKK)} + Tools {fmtNum(fc.toolsAmex)} + BH {fmtNum(fc.buchhaltung)}</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '220ms', borderTop: `2px solid ${netProfit >= 0 ? 'var(--za-success)' : 'var(--za-danger)'}` }}>
                  <div className="kpi-top"><span className="kpi-label">Net Profit</span></div>
                  <div className="kpi-value" style={{ color: netProfit >= 0 ? 'var(--za-success)' : 'var(--za-danger)' }}><span className="kpi-unit-prefix">&euro;</span>{fmtNum(netProfit)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">{netProfitPct}% Nettomarge</span></div>
                </div>
              </div>

              {/* Cash-In Kunden-Tabelle für gewählten Monat */}
              {cashInCustomers.length > 0 && (
                <div className="za-panel fade-up" style={{ animationDelay: '280ms', marginBottom: '16px' }}>
                  <div className="panel-head">
                    <div>
                      <span className="panel-eyebrow">Cash-In Detail</span>
                      <div className="panel-title">{cashInLabel} &middot; {cashInCustomers.length} Positionen &middot; &euro;{fmtNum(cashInNetto)} netto</div>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="za-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Kunde</th>
                          <th style={{ textAlign: 'left' }}>Paket</th>
                          <th style={{ textAlign: 'left' }}>Typ</th>
                          <th style={{ textAlign: 'right' }}>Netto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cashInCustomers.map((c, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{c.firma}</td>
                            <td style={{ color: 'var(--za-fg-3)', fontSize: '12px' }}>{c.paket}</td>
                            <td>
                              <span style={{
                                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                                padding: '2px 8px', borderRadius: '4px',
                                background: c.isSetup ? 'rgba(139,92,246,0.12)' : c.umsatztyp === 'Einmalig' ? 'rgba(59,130,246,0.12)' : 'rgba(34,197,94,0.12)',
                                color: c.isSetup ? '#a78bfa' : c.umsatztyp === 'Einmalig' ? 'var(--za-info)' : 'var(--za-success)',
                              }}>
                                {c.umsatztyp}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--za-serif)', fontWeight: 700, color: 'var(--za-gold)' }}>&euro;{fmtNum(c.cashInNetto)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Revenue vs Cost Bar */}
              {cashInNetto > 0 && (
              <div className="za-panel fade-up" style={{ animationDelay: '360ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">P&amp;L Aufschl&uuml;sselung</span>
                    <div className="panel-title">{cashInLabel} &middot; &euro;{fmtNum(cashInNetto)} Cash-In</div>
                  </div>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', height: '40px', borderRadius: '8px', overflow: 'hidden', background: 'rgba(249,249,249,0.04)' }}>
                    {netProfit > 0 && (
                    <div style={{ width: `${(netProfit / cashInNetto) * 100}%`, background: 'linear-gradient(90deg, #22c55e, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', minWidth: '50px' }}>
                      {(netProfit / cashInNetto * 100).toFixed(0)}%
                    </div>
                    )}
                    <div style={{ width: `${(fc.teamInklKK / cashInNetto) * 100}%`, background: 'linear-gradient(90deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff', minWidth: '40px' }}>
                      Team
                    </div>
                    <div style={{ width: `${(fc.toolsAmex / cashInNetto) * 100}%`, background: 'linear-gradient(90deg, #8b5cf6, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff', minWidth: '40px' }}>
                      Tools
                    </div>
                    <div style={{ width: `${(fc.buchhaltung / cashInNetto) * 100}%`, background: 'linear-gradient(90deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff', minWidth: '30px' }}>
                      BH
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '10px', fontSize: '12px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#22c55e', display: 'inline-block' }} />Net Profit &euro;{fmtNum(netProfit)}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#f59e0b', display: 'inline-block' }} />Team &euro;{fmtNum(fc.teamInklKK)}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#8b5cf6', display: 'inline-block' }} />Tools/Amex &euro;{fmtNum(fc.toolsAmex)}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#6366f1', display: 'inline-block' }} />Buchhaltung &euro;{fmtNum(fc.buchhaltung)}</span>
                  </div>
                </div>
              </div>
              )}

              </div>
              <div id="sec-finanzen-kunden" style={{ display: activeSection === 'sec-finanzen-kunden' || !activeSection ? undefined : 'none' }}>
              {/* Customer Profitability Table */}
              <div className="za-panel fade-up" style={{ animationDelay: '420ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Customer Profitability</span>
                    <div className="panel-title">Deckungsbeitrag pro Kunde</div>
                  </div>
                </div>
                <div className="za-table-wrap">
                  <table className="za-table">
                    <thead>
                      <tr>
                        <th>Kunde</th>
                        <th>Paket</th>
                        <th>Rate/Mo</th>
                        <th>Delivery</th>
                        <th>Margin</th>
                        <th>Margin %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customersSorted.map((c, i) => {
                        const mp = c.delivery.marginPercent
                        const marginColor = mp >= 95 ? '#22c55e' : mp >= 90 ? '#eab308' : '#f97316'
                        return (
                          <tr key={i}>
                            <td>
                              <div className="t-co">
                                <span className="t-co-mark">{c.firma.charAt(0)}</span>
                                <span className="t-co-name">{c.firma}</span>
                              </div>
                            </td>
                            <td><span style={{ fontSize: '12px', color: 'var(--za-fg-2)' }}>{c.paket}</span></td>
                            <td style={{ fontFamily: 'var(--za-serif)', fontWeight: 600 }}>&euro;{fmtNum(c.rateMonat)}</td>
                            <td style={{ fontFamily: 'var(--za-serif)', color: 'var(--za-fg-2)' }}>&euro;{c.delivery.deliveryCost.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                            <td style={{ fontFamily: 'var(--za-serif)', fontWeight: 700, color: marginColor }}>&euro;{fmtNum(Math.round(c.delivery.marginEuro))}</td>
                            <td>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: marginColor, padding: '2px 8px', borderRadius: '4px', background: `${marginColor}15` }}>
                                {c.delivery.marginPercent.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              </div>

              {/* ── Nicht-Zahler ─────────────────────────────────── */}
              <div id="sec-finanzen-nichtzahler" style={{ display: activeSection === 'sec-finanzen-nichtzahler' || !activeSection ? undefined : 'none' }}>
              {(() => {
                const nonPaying = data.airtableCashIn?.nonPaying || []
                const streitfaelle = nonPaying.filter(c => c.reason.includes('Streitfall'))
                const inaktive = nonPaying.filter(c => !c.reason.includes('Streitfall'))
                const totalOffen = streitfaelle.reduce((s, c) => s + c.offenerBetrag, 0)
                const totalEntgangenMRR = nonPaying.reduce((s, c) => s + c.rateMonat, 0)

                return (
                  <>
                    {/* KPIs */}
                    <div className="kpi-grid">
                      <div className="za-panel fade-up" style={{ animationDelay: '40ms', borderTop: '3px solid var(--za-danger)' }}>
                        <div className="kpi-top"><span className="kpi-label">Offene Forderungen</span></div>
                        <div className="kpi-value" style={{ color: 'var(--za-danger)' }}><span className="kpi-unit-prefix">&euro;</span>{fmtNum(totalOffen)}</div>
                        <div className="kpi-foot"><span className="kpi-caption">{streitfaelle.length} Streitf&auml;lle beim Anwalt</span></div>
                      </div>
                      <div className="za-panel fade-up" style={{ animationDelay: '100ms', borderTop: '2px solid var(--za-gold)' }}>
                        <div className="kpi-top"><span className="kpi-label">Entgangener MRR</span></div>
                        <div className="kpi-value"><span className="kpi-unit-prefix">&euro;</span>{fmtNum(totalEntgangenMRR)}</div>
                        <div className="kpi-foot"><span className="kpi-caption">{nonPaying.length} nicht-zahlende Kunden</span></div>
                      </div>
                      <div className="za-panel fade-up" style={{ animationDelay: '160ms' }}>
                        <div className="kpi-top"><span className="kpi-label">Nicht-Zahler</span></div>
                        <div className="kpi-value">{nonPaying.length}</div>
                        <div className="kpi-foot"><span className="kpi-caption">{streitfaelle.length} Streitf&auml;lle &middot; {inaktive.length} Inaktive</span></div>
                      </div>
                    </div>

                    {/* Streitfälle */}
                    {streitfaelle.length > 0 && (
                      <div className="za-panel fade-up" style={{ animationDelay: '200ms', marginBottom: '16px' }}>
                        <div className="panel-head">
                          <div>
                            <span className="panel-eyebrow">Beim Anwalt</span>
                            <div className="panel-title">Streitf&auml;lle &middot; &euro;{fmtNum(totalOffen)} offen</div>
                          </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table className="za-table" style={{ width: '100%' }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left' }}>Kunde</th>
                                <th style={{ textAlign: 'left' }}>Paket</th>
                                <th style={{ textAlign: 'right' }}>Rate/Mo</th>
                                <th style={{ textAlign: 'right' }}>Offen</th>
                                <th style={{ textAlign: 'left' }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {streitfaelle.sort((a, b) => b.offenerBetrag - a.offenerBetrag).map((c, i) => (
                                <tr key={i}>
                                  <td style={{ fontWeight: 600 }}>{c.firma}</td>
                                  <td style={{ color: 'var(--za-fg-3)', fontSize: '12px' }}>{c.paket}</td>
                                  <td style={{ textAlign: 'right', fontFamily: 'var(--za-serif)' }}>&euro;{fmtNum(c.rateMonat)}</td>
                                  <td style={{ textAlign: 'right', fontFamily: 'var(--za-serif)', fontWeight: 700, color: 'var(--za-danger)' }}>&euro;{fmtNum(c.offenerBetrag)}</td>
                                  <td><span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 8px', borderRadius: '4px', background: 'rgba(239,68,68,0.12)', color: 'var(--za-danger)' }}>Streitfall</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Inaktive / Sonstige */}
                    {inaktive.length > 0 && (
                      <div className="za-panel fade-up" style={{ animationDelay: '300ms' }}>
                        <div className="panel-head">
                          <div>
                            <span className="panel-eyebrow">Inaktiv / Sonstige</span>
                            <div className="panel-title">{inaktive.length} nicht-zahlende Kunden</div>
                          </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table className="za-table" style={{ width: '100%' }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left' }}>Kunde</th>
                                <th style={{ textAlign: 'left' }}>Paket</th>
                                <th style={{ textAlign: 'right' }}>Letzte Rate</th>
                                <th style={{ textAlign: 'left' }}>Grund</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inaktive.sort((a, b) => b.rateMonat - a.rateMonat).map((c, i) => (
                                <tr key={i}>
                                  <td style={{ fontWeight: 600 }}>{c.firma}</td>
                                  <td style={{ color: 'var(--za-fg-3)', fontSize: '12px' }}>{c.paket}</td>
                                  <td style={{ textAlign: 'right', fontFamily: 'var(--za-serif)' }}>&euro;{fmtNum(c.rateMonat)}</td>
                                  <td><span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 8px', borderRadius: '4px', background: 'rgba(249,249,249,0.08)', color: 'var(--za-fg-3)' }}>{c.reason}</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
              </div>

              <div id="sec-finanzen-team" style={{ display: activeSection === 'sec-finanzen-team' || !activeSection ? undefined : 'none' }}>
              {/* Team Auslastung Panel */}
              <div className="za-panel fade-up" style={{ animationDelay: '480ms', marginBottom: '16px' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Team</span>
                    <div className="panel-title">Auslastung &amp; Kosten</div>
                  </div>
                </div>
                <div className="za-table-wrap">
                  <table className="za-table">
                    <thead>
                      <tr>
                        <th>Team</th>
                        <th>Rolle</th>
                        <th>Stunden/Mo</th>
                        <th>Kosten/Mo</th>
                        <th style={{ width: '200px' }}>Auslastung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamUtil.map((t, i) => {
                        const pct = t.maxHours > 0 ? (t.hours / t.maxHours * 100) : 0
                        const pctStr = pct.toFixed(1)
                        return (
                          <tr key={i}>
                            <td><span style={{ fontWeight: 700 }}>{t.name}</span></td>
                            <td><span style={{ fontSize: '12px', color: 'var(--za-fg-2)' }}>{t.role}</span></td>
                            <td style={{ fontFamily: 'var(--za-serif)' }}>{t.hours.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}h / {t.maxHours}h</td>
                            <td style={{ fontFamily: 'var(--za-serif)', fontWeight: 600 }}>&euro;{fmtNum(t.cost)}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ flex: 1, height: '8px', background: 'rgba(249,249,249,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: pct > 80 ? '#f59e0b' : pct > 50 ? 'var(--za-info)' : 'var(--za-success)', borderRadius: '4px', transition: 'width 0.8s ease' }} />
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--za-fg-2)', minWidth: '42px', textAlign: 'right' }}>{pctStr}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top Margin Customers */}
              <div className="za-panel fade-up" style={{ animationDelay: '540ms', marginBottom: '16px', borderTop: '2px solid var(--za-gold)' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow" style={{ color: 'var(--za-gold-2)' }}>Top 5</span>
                    <div className="panel-title">H&ouml;chste Marge (absolut)</div>
                  </div>
                </div>
                {top5.map((c, i) => (
                  <div key={i} className="za-panel" style={{ margin: '8px 0', padding: '12px 16px', background: 'rgba(197,160,89,0.04)', border: '1px solid rgba(197,160,89,0.12)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', color: 'var(--za-gold-2)', background: 'rgba(197,160,89,0.12)' }}>{i + 1}</span>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{c.firma}</div>
                          <div style={{ fontSize: '12px', color: 'var(--za-fg-3)' }}>{c.paket}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--za-serif)', fontSize: '16px', fontWeight: 700, color: 'var(--za-gold-2)' }}>&euro;{fmtNum(Math.round(c.delivery.marginEuro))}</div>
                        <div style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>{c.delivery.marginPercent.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% Marge</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Insights */}
              <div className="za-panel fade-up" style={{ animationDelay: '600ms', marginBottom: '16px', borderLeft: '3px solid var(--za-gold)' }}>
                <div className="panel-head">
                  <div>
                    <span className="panel-eyebrow">Insights</span>
                    <div className="panel-title">Delivery &amp; Profitabilit&auml;t</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { icon: '\uD83D\uDCB0', text: `${dm.avgMarginPercent}% \u00D8 Marge \u2014 extrem kapitaleffizient` },
                    { icon: '\u26A0\uFE0F', text: 'Sales Promotion: h\u00F6chster Felix-Aufwand (10h) f\u00FCr \u20AC3.500 \u2014 Automatisierung pr\u00FCfen' },
                    { icon: '\uD83D\uDCCA', text: `Nils\u2019 Kapazit\u00E4t: ${dm.totalHoursNils}h/160h genutzt = ${(160 - dm.totalHoursNils).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}h frei f\u00FCr neue Kunden` },
                    { icon: '\uD83C\uDFAF', text: 'Jeder neue DFY-Kunde bringt ~\u20AC1.200 Netto bei ~3h Nils-Aufwand' },
                  ].map((insight, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', padding: '10px 14px', background: 'rgba(249,249,249,0.03)', borderRadius: '8px', fontSize: '13px', color: 'var(--za-fg-2)', lineHeight: 1.5 }}>
                      <span style={{ fontSize: '16px', flexShrink: 0 }}>{insight.icon}</span>
                      <span>{insight.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Existing Finanzen content: Revenue from Close CRM */}
              <div style={{ borderTop: '1px solid rgba(249,249,249,0.06)', paddingTop: '24px', marginTop: '8px' }}>
                <div style={{ fontSize: '10px', color: 'var(--za-fg-3)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '16px' }}>Close CRM Revenue</div>

                <div className="kpi-grid">
                  <div className="za-panel fade-up" style={{ animationDelay: '660ms' }}>
                    <div className="kpi-top"><span className="kpi-label">Umsatz MTD</span></div>
                    <div className="kpi-value" style={{ color: 'var(--za-success)' }}>{fmtEuro(data.revenueMTD)}</div>
                    <div className="kpi-foot"><span className="kpi-caption">{data.currentMonthName} {data.currentYear}</span><SparklineChart data={sparkData.d} color="#7FC29B" /></div>
                  </div>
                  <div className="za-panel fade-up" style={{ animationDelay: '720ms' }}>
                    <div className="kpi-top"><span className="kpi-label">Umsatz gesamt</span></div>
                    <div className="kpi-value">{fmtEuro(data.totalRevenue)}</div>
                    <div className="kpi-foot"><span className="kpi-caption">Close CRM</span><SparklineChart data={sparkData.h} /></div>
                  </div>
                  <div className="za-panel fade-up" style={{ animationDelay: '780ms' }}>
                    <div className="kpi-top"><span className="kpi-label">Offene RG</span></div>
                    <div className="kpi-value" style={{ color: 'var(--za-fg-3)' }}>&mdash;</div>
                    <div className="kpi-foot"><span className="kpi-caption">Easybill</span></div>
                  </div>
                  <div className="za-panel fade-up" style={{ animationDelay: '840ms' }}>
                    <div className="kpi-top"><span className="kpi-label">Kontostand</span></div>
                    <div className="kpi-value" style={{ color: 'var(--za-fg-3)' }}>&mdash;</div>
                    <div className="kpi-foot"><span className="kpi-caption">Qonto</span></div>
                  </div>
                </div>

                {/* Monthly revenue chart */}
                <div className="za-panel fade-up" style={{ animationDelay: '900ms', marginBottom: '16px' }}>
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
                <div className="za-panel fade-up" style={{ animationDelay: '960ms', marginBottom: '16px' }}>
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
                  <div className="za-panel fade-up" style={{ animationDelay: '1020ms' }}>
                    <EmptyState
                      icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/></svg>}
                      title="Easybill &mdash; Rechnungsdaten"
                      subtitle="Integration in Vorbereitung. Offene und bezahlte Rechnungen werden hier angezeigt."
                    />
                  </div>
                  <div className="za-panel fade-up" style={{ animationDelay: '1080ms' }}>
                    <EmptyState
                      icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2.5 0 00-2.5-1h-1a2 2 0 000 4h2a2 2 0 010 4h-1a2.5 2.5 0 01-2.5-1M12 5.5v1M12 17.5v1"/></svg>}
                      title="Qonto &mdash; Bankdaten"
                      subtitle="Integration in Vorbereitung. Kontostand und Transaktionen werden hier angezeigt."
                    />
                  </div>
                </div>
              </div>
              </div>
            </>
            )
          })()}

          {/* ═══════════════════════════════════════════════════
               TAB: KUNDEN
             ═══════════════════════════════════════════════════ */}
          {activeNav === 'kunden' && (
            <>
              <div id="sec-kunden-overview" style={{ display: activeSection === 'sec-kunden-overview' || !activeSection ? undefined : 'none' }}>
              {/* Sub-Tab Navigation */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'rgba(249,249,249,0.03)', borderRadius: '10px', padding: '4px', border: '1px solid rgba(249,249,249,0.06)' }}>
                {[
                  { id: 'zahlend' as const, label: 'Zahlende Kunden' },
                  { id: 'streitfaelle' as const, label: 'Streitfälle' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setKundenSubTab(tab.id)}
                    style={{
                      flex: 1, padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                      fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
                      background: kundenSubTab === tab.id ? 'linear-gradient(135deg, var(--za-gold), var(--za-gold-2))' : 'transparent',
                      color: kundenSubTab === tab.id ? '#0a0a0a' : 'var(--za-fg-3)',
                    }}
                  >
                    {tab.label}
                    {tab.id === 'streitfaelle' && (() => {
                      const count = data.deliveryMetrics.customers.filter(c => c.paymentStatus === 'streitfall').length
                      return count > 0 ? <span style={{ marginLeft: '6px', background: 'var(--za-danger)', color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 700 }}>{count}</span> : null
                    })()}
                  </button>
                ))}
              </div>

              {kundenSubTab === 'zahlend' && (<>
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

              {/* Umsatz nach Kategorie */}
              {(() => {
                const categoryMap: Record<string, string> = {
                  'Coaching 90-Tage': 'Coaching',
                  'Agentur Champion': 'Coaching',
                  'Agentur Skalierung': 'Coaching',
                  'LinkedIn Starter Masterclass': 'Coaching',
                  'Social Media Management + Sales': 'Social Media',
                  'Social Media Management': 'Social Media',
                  'Recruiting': 'Recruiting',
                  'Recruiting Ads': 'Recruiting',
                  'DFY LinkedIn': 'D4Y Dienstleistung',
                  'Done4You LinkedIn Content': 'D4Y Dienstleistung',
                  'D4Y Leadposts (Reverse Charge)': 'D4Y Dienstleistung',
                  'Werbeanzeigen / Ads Management': 'Ads / Performance',
                  'Quiz-Funnel AVGS': 'Ads / Performance',
                  'Ad SetUp (Videoschnitt + Ads)': 'Ads / Performance',
                  'LinkedIn Profiloptimierung': 'Profiloptimierung',
                  'Software-Abo': 'Software',
                  'Altkunde': 'Altkunde',
                  'Monatlich': 'Altkunde',
                }
                const zahlend = data.deliveryMetrics.customers.filter(c => c.status === 'aktiv' && c.paymentStatus !== 'streitfall')
                const categories: Record<string, { category: string; cashIn: number; count: number; products: Record<string, { cash: number; count: number }> }> = {}
                for (const c of zahlend) {
                  const cat = categoryMap[c.paket] || 'Sonstiges'
                  if (!categories[cat]) categories[cat] = { category: cat, cashIn: 0, count: 0, products: {} }
                  const cash = c.cashInMonat || c.rateMonat
                  categories[cat].cashIn += cash
                  categories[cat].count++
                  if (!categories[cat].products[c.paket]) categories[cat].products[c.paket] = { cash: 0, count: 0 }
                  categories[cat].products[c.paket].cash += cash
                  categories[cat].products[c.paket].count++
                }
                const sorted = Object.values(categories).sort((a, b) => b.cashIn - a.cashIn)
                const maxCash = Math.max(...sorted.map(c => c.cashIn))
                const totalCash = sorted.reduce((s, c) => s + c.cashIn, 0)
                return (
                  <div className="za-panel fade-up" style={{ animationDelay: '600ms', marginBottom: '16px' }}>
                    <div className="panel-head">
                      <div>
                        <span className="panel-eyebrow">Umsatz nach Kategorie</span>
                        <div className="panel-title">&euro;{fmtNum(totalCash)}/Mo Cash-in (zahlende Kunden)</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {sorted.map((cat, i) => (
                        <div key={i}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                            <div style={{ width: '160px', flexShrink: 0, fontSize: '13px', fontWeight: 700, color: '#fff' }}>{cat.category}</div>
                            <div style={{ flex: 1, height: '26px', background: 'rgba(249,249,249,0.04)', borderRadius: '6px', overflow: 'hidden' }}>
                              <div style={{ width: `${maxCash > 0 ? (cat.cashIn / maxCash) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg, var(--za-gold), var(--za-gold-2))', borderRadius: '6px', transition: 'width 0.8s ease' }} />
                            </div>
                            <div style={{ width: '120px', textAlign: 'right', fontFamily: 'var(--za-serif)', fontSize: '14px', fontWeight: 700, color: 'var(--za-gold-2)' }}>&euro;{fmtNum(cat.cashIn)}/Mo</div>
                          </div>
                          {Object.entries(cat.products).length > 1 && (
                            <div style={{ paddingLeft: '172px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {Object.entries(cat.products).sort((a, b) => b[1].cash - a[1].cash).map(([prod, d], j) => (
                                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--za-fg-3)' }}>
                                  <span>{prod} ({d.count}x)</span>
                                  <span style={{ fontFamily: 'var(--za-serif)', marginRight: '0' }}>&euro;{fmtNum(d.cash)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
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
                        <th>Abrechnungstag</th>
                        <th>Laufzeit</th>
                        <th>Endet am</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const streitfallFirmen = new Set(data.deliveryMetrics.customers.filter(c => c.paymentStatus === 'streitfall').map(c => c.firma.toLowerCase()))
                        return [...data.airtableMetrics.activeList]
                          .filter(c => {
                            const name = c.dealName.replace(/^CL-\d+\s*[-–]?\s*/, '').replace(/\s*[-–]\s*.*$/, '') || c.dealName
                            return !streitfallFirmen.has(name.toLowerCase())
                          })
                          .sort((a, b) => b.monatlicheRate - a.monatlicheRate)
                      })().map((c, i) => {
                        const name = c.dealName.replace(/^CL-\d+\s*[-–]?\s*/, '').replace(/\s*[-–]\s*.*$/, '') || c.dealName
                        const configCustomer = data.deliveryMetrics.customers.find(dc => dc.clId === c.kundenId)
                        const billingDay = c.vertragsbeginn ? parseInt(c.vertragsbeginn.split('-')[2]) : (configCustomer?.billingDay || 0)
                        const today = new Date()
                        const todayDay = today.getDate()
                        const daysUntil = billingDay > 0 ? (billingDay >= todayDay ? billingDay - todayDay : billingDay + (new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()) - todayDay) : -1
                        const isUrgent = daysUntil >= 0 && daysUntil <= 3
                        const isSoon = daysUntil >= 0 && daysUntil <= 7
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
                            <td>
                              {billingDay > 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{
                                    fontSize: '12px', fontWeight: 700,
                                    padding: '2px 8px', borderRadius: '4px',
                                    background: isUrgent ? 'rgba(239,68,68,0.12)' : isSoon ? 'rgba(245,158,11,0.12)' : 'rgba(249,249,249,0.06)',
                                    color: isUrgent ? 'var(--za-danger)' : isSoon ? '#f59e0b' : 'var(--za-fg-2)',
                                  }}>
                                    {billingDay}.
                                  </span>
                                  {daysUntil === 0 && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--za-danger)' }}>heute</span>}
                                  {daysUntil === 1 && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--za-danger)' }}>morgen</span>}
                                  {daysUntil > 1 && daysUntil <= 7 && <span style={{ fontSize: '10px', color: '#f59e0b' }}>in {daysUntil}d</span>}
                                </div>
                              ) : (
                                <span style={{ fontSize: '12px', color: 'var(--za-fg-4)' }}>Altkunde</span>
                              )}
                            </td>
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
                        const name = c.dealName.replace(/^CL-\d+\s*[-–]?\s*/, '').replace(/\s*[-–]\s*.*$/, '') || c.dealName
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
                  const name = c.dealName.replace(/^CL-\d+\s*[-–]?\s*/, '').replace(/\s*[-–]\s*.*$/, '') || c.dealName
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
              </>)}

              {kundenSubTab === 'streitfaelle' && (() => {
                const streitfaelle = data.deliveryMetrics.customers.filter(c => c.paymentStatus === 'streitfall')
                const totalGesamtOffen = streitfaelle.reduce((s, c) => s + c.streitfallGesamt, 0)
                return (<>
                  {/* Streitfälle KPIs */}
                  <div className="kpi-grid">
                    <div className="za-panel fade-up" style={{ animationDelay: '60ms', borderTop: '3px solid var(--za-danger)' }}>
                      <div className="kpi-top"><span className="kpi-label">Offene Streitf&auml;lle</span></div>
                      <div className="kpi-value" style={{ color: 'var(--za-danger)' }}>{streitfaelle.length}</div>
                      <div className="kpi-foot"><span className="kpi-caption">Kunden mit Zahlungsausfall</span></div>
                    </div>
                    <div className="za-panel fade-up" style={{ animationDelay: '140ms', borderTop: '3px solid var(--za-danger)' }}>
                      <div className="kpi-top"><span className="kpi-label">Gesamtforderung offen</span></div>
                      <div className="kpi-value" style={{ color: 'var(--za-danger)' }}><span className="kpi-unit-prefix">&euro;</span>{fmtNum(totalGesamtOffen)}</div>
                      <div className="kpi-foot"><span className="kpi-caption">Alle offenen Forderungen beim Anwalt</span></div>
                    </div>
                  </div>

                  {/* Streitfälle Tabelle */}
                  <div className="za-panel fade-up" style={{ animationDelay: '220ms', marginBottom: '16px', borderLeft: '3px solid var(--za-danger)' }}>
                    <div className="panel-head">
                      <div>
                        <span className="panel-eyebrow" style={{ color: 'var(--za-danger)' }}>Streitf&auml;lle</span>
                        <div className="panel-title">{streitfaelle.length} offene F&auml;lle</div>
                      </div>
                    </div>
                    {streitfaelle.length === 0 ? (
                      <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--za-fg-3)', fontSize: '13px' }}>Keine offenen Streitf&auml;lle</div>
                    ) : (
                      <div className="za-table-wrap">
                        <table className="za-table">
                          <thead>
                            <tr>
                              <th>Kunde</th>
                              <th>Paket</th>
                              <th>Rate/Mo</th>
                              <th>Gesamt offen</th>
                              <th>Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {streitfaelle.map((c, i) => (
                              <tr key={i}>
                                <td>
                                  <div className="t-co">
                                    <span className="t-co-mark" style={{ background: 'var(--za-danger)' }}>{c.firma.charAt(0)}</span>
                                    <span className="t-co-name">{c.firma}</span>
                                  </div>
                                </td>
                                <td><span style={{ fontSize: '12px', color: 'var(--za-fg-2)' }}>{c.paket}</span></td>
                                <td style={{ fontFamily: 'var(--za-serif)', fontWeight: 600, color: 'var(--za-danger)' }}>{fmtEuro(c.rateMonat)}</td>
                                <td style={{ fontFamily: 'var(--za-serif)', fontWeight: 700, color: 'var(--za-danger)' }}>{c.streitfallGesamt > 0 ? fmtEuro(c.streitfallGesamt) : '\u2013'}</td>
                                <td><span style={{ fontSize: '12px', color: 'var(--za-fg-2)' }}>{c.streitfallDetails}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>)
              })()}
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
                  <div className="kpi-value">424</div>
                  <div className="kpi-foot"><span className="kpi-caption">413 Indeed + 11 Instagram</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '140ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">Cost per VG</span></div>
                  <div className="kpi-value"><span className="kpi-unit-prefix">&euro;</span>38,58</div>
                  <div className="kpi-foot"><span className="kpi-caption">59 VG terminiert</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '220ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">No Show Quote</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-danger)' }}>30,5<span className="unit">%</span></div>
                  <div className="kpi-foot"><span className="kpi-caption">27 von 59 erschienen</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '300ms', borderTop: '2px solid var(--za-gold)' }}>
                  <div className="kpi-top"><span className="kpi-label">Eingestellt</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-success)' }}>2</div>
                  <div className="kpi-foot"><span className="kpi-caption">Cost per Hire: &euro;1.138</span></div>
                </div>
              </div>

              {/* KPI Row 2 */}
              <div className="kpi-grid">
                <div className="za-panel fade-up" style={{ animationDelay: '360ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Gesamtausgaben</span></div>
                  <div className="kpi-value"><span className="kpi-unit-prefix">&euro;</span>2.276</div>
                  <div className="kpi-foot"><span className="kpi-caption">2.000 Indeed + 276 Instagram</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '420ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Cost/Bewerbung</span></div>
                  <div className="kpi-value"><span className="kpi-unit-prefix">&euro;</span>5,37</div>
                  <div className="kpi-foot"><span className="kpi-caption">424 Bewerbungen</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '480ms' }}>
                  <div className="kpi-top"><span className="kpi-label">VG &rarr; Probearbeit</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-success)' }}>55,6<span className="unit">%</span></div>
                  <div className="kpi-foot"><span className="kpi-caption">15 von 27 Erschienenen vereinbart</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: '540ms' }}>
                  <div className="kpi-top"><span className="kpi-label">Probewoche Quote</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-success)' }}>66,7<span className="unit">%</span></div>
                  <div className="kpi-foot"><span className="kpi-caption">2 von 3 durchgezogen</span></div>
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
                  { name: 'Bewerbungen', value: 424, pct: '100%', color: 'linear-gradient(90deg,#775A19,#C5A059)' },
                  { name: 'VG terminiert', value: 59, pct: '13,9%', color: 'linear-gradient(90deg,#775A19,#C5A059)' },
                  { name: 'VG erschienen', value: 27, pct: '45,8%', color: 'linear-gradient(90deg,#775A19,#C5A059)' },
                  { name: 'Probearbeit vereinbart', value: 15, pct: '55,6%', color: 'linear-gradient(90deg,#775A19,#C5A059)' },
                  { name: 'Probewoche angetreten', value: 3, pct: '20%', color: 'linear-gradient(90deg,#775A19,#C5A059)' },
                  { name: 'Durchgezogen', value: 2, pct: '66,7%', color: 'linear-gradient(90deg,#775A19,#C5A059)' },
                  { name: 'Eingestellt', value: 2, pct: '100%', color: 'linear-gradient(90deg,#775A19,#C5A059)' },
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
                      <tr><td>Ausgaben</td><td style={{ color: 'var(--za-success)' }}>&euro;2.000</td><td>&euro;276</td></tr>
                      <tr><td>Bewerbungen</td><td style={{ color: 'var(--za-success)' }}>413</td><td>11</td></tr>
                      <tr><td>Cost/Bewerbung</td><td style={{ color: 'var(--za-success)' }}>&euro;4,84</td><td>&euro;25,09</td></tr>
                      <tr><td>VG terminiert</td><td style={{ color: 'var(--za-success)' }}>56</td><td>2</td></tr>
                      <tr><td>VG erschienen</td><td style={{ color: 'var(--za-success)' }}>26</td><td>0</td></tr>
                      <tr><td>No Show %</td><td style={{ color: 'var(--za-success)' }}>30%</td><td style={{ color: 'var(--za-danger)' }}>100%</td></tr>
                      <tr><td>Cost/VG erschienen</td><td style={{ color: 'var(--za-success)' }}>&euro;76,92</td><td>&mdash;</td></tr>
                      <tr><td>Probearbeit vereinbart</td><td style={{ color: 'var(--za-success)' }}>15</td><td>0</td></tr>
                      <tr><td>Eingestellt</td><td style={{ color: 'var(--za-success)' }}>2</td><td>0</td></tr>
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
                    &#128202; Indeed: &euro;167/VG vs Instagram: &euro;276/VG &mdash; Indeed 1,7x effizienter
                  </div>
                  <div style={{ padding: '12px 16px', borderLeft: '3px solid #22c55e', background: 'rgba(34,197,94,0.06)', borderRadius: '6px', fontSize: '13px', color: 'var(--za-fg-2)' }}>
                    &#127919; N&auml;chster Hire ben&ouml;tigt ~&euro;4.550 bei aktueller Conversion
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════
               TAB: TEAM
             ═══════════════════════════════════════════════════ */}
          {activeNav === 'team' && (() => {
            const ot = data.openerTracking
            const openers = ot?.openers || []
            const openerRev = data.openerRevenue || []
            const oq: any[] = data.openerQuality || []
            return (
            <>
              <div id="sec-team-quality" style={{ display: activeSection === 'sec-team-quality' || !activeSection ? undefined : 'none' }}>
              {oq.length > 0 && (() => {
                const best = (field: string, higherBetter = true) => {
                  const vals = oq.map((o: any) => o[field])
                  const target = higherBetter ? Math.max(...vals) : Math.min(...vals.filter((v: number) => v > 0))
                  return oq.find((o: any) => o[field] === target)?.name || ''
                }
                const rateColor = (val: number, good: number, bad: number) =>
                  val <= good ? 'var(--za-success)' : val >= bad ? 'var(--za-danger)' : 'var(--za-gold)'
                const rateColorHigh = (val: number, good: number, bad: number) =>
                  val >= good ? 'var(--za-success)' : val <= bad ? 'var(--za-danger)' : 'var(--za-gold)'

                return (
                <>
                  {/* KPI Overview */}
                  <div className="kpi-grid" style={{ marginBottom: '20px' }}>
                    {oq.map((o: any, idx: number) => {
                      const firstName = o.name.split(' ')[0]
                      return (
                        <div key={idx} className="za-panel fade-up" style={{ animationDelay: `${60 + idx * 80}ms` }}>
                          <div className="kpi-top"><span className="kpi-label">{firstName} — Monat</span></div>
                          <div className="kpi-value" style={{ fontSize: '28px' }}>{o.settingsMonth}<span className="unit" style={{ fontSize: '14px', color: 'var(--za-fg-3)' }}> Settings</span></div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>Calls: <span style={{ color: 'var(--za-fg)' }}>{o.callsMonth.toLocaleString('de-DE')}</span></div>
                            <div style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>Calls/Setting: <span style={{ color: rateColor(o.callsPerSetting, 100, 200) }}>{o.callsPerSetting > 0 ? o.callsPerSetting.toFixed(0) : '–'}</span></div>
                            <div style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>Entscheider: <span style={{ color: 'var(--za-fg)' }}>{o.entscheiderMonth}</span></div>
                            <div style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>Protokolle: <span style={{ color: 'var(--za-fg)' }}>{o.coldCallProtocolsMonth.toLocaleString('de-DE')}</span></div>
                          </div>
                        </div>
                      )
                    })}
                    {/* Total Card */}
                    <div className="za-panel fade-up" style={{ animationDelay: `${60 + oq.length * 80}ms` }}>
                      <div className="kpi-top"><span className="kpi-label">Gesamt — Monat</span></div>
                      <div className="kpi-value" style={{ fontSize: '28px' }}>{oq.reduce((s: number, o: any) => s + o.settingsMonth, 0)}<span className="unit" style={{ fontSize: '14px', color: 'var(--za-fg-3)' }}> Settings</span></div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>Calls: <span style={{ color: 'var(--za-fg)' }}>{oq.reduce((s: number, o: any) => s + o.callsMonth, 0).toLocaleString('de-DE')}</span></div>
                        <div style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>Entscheider: <span style={{ color: 'var(--za-fg)' }}>{oq.reduce((s: number, o: any) => s + o.entscheiderMonth, 0)}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Opener Comparison Table */}
                  <div className="za-panel fade-up" style={{ animationDelay: '140ms' }}>
                    <div className="panel-head">
                      <div>
                        <span className="panel-eyebrow">Opener Report</span>
                        <div className="panel-title">Qualitätsvergleich</div>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>Letzte 90 Tage · via Pipeline Status-Transitions</div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--za-border)' }}>
                            <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--za-fg-3)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kennzahl</th>
                            {oq.map((o: any, idx: number) => (
                              <th key={idx} style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--za-fg-2)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{o.name.split(' ')[0]}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { label: 'Calls (Monat)', field: 'callsMonth', fmt: (v: number) => v.toLocaleString('de-DE') },
                            { label: 'Protokolle (Monat)', field: 'coldCallProtocolsMonth', fmt: (v: number) => v.toLocaleString('de-DE') },
                            { label: 'Entscheider (Monat)', field: 'entscheiderMonth', fmt: (v: number) => String(v) },
                            { label: 'Settings (Monat)', field: 'settingsMonth', fmt: (v: number) => String(v), highlight: true },
                            { label: 'Calls/Setting (Monat)', field: 'callsPerSetting', fmt: (v: number) => v > 0 ? v.toFixed(0) : '–', lower: true },
                            { label: 'Settings (All-Time)', field: 'settingsAllTime', fmt: (v: number) => String(v) },
                            { label: 'Calls/Setting (All-Time)', field: 'callsPerSettingAllTime', fmt: (v: number) => v > 0 ? v.toFixed(0) : '–', lower: true },
                            { label: '', field: '', fmt: () => '', divider: true },
                            { label: 'Setting → Closing', field: 'settingToCLosing', fmt: (v: number) => String(v), sub: 'settingToClosingRate' },
                            { label: 'Setting → No-Show', field: 'settingNoShow', fmt: (v: number) => String(v), sub: 'settingNoShowRate', danger: true },
                            { label: 'Setting → Follow-Up', field: 'settingFollowUp', fmt: (v: number) => String(v) },
                            { label: 'Setting → Lost', field: 'settingLost', fmt: (v: number) => String(v) },
                            { label: '', field: '', fmt: () => '', divider: true },
                            { label: 'Closing → Won', field: 'closingWon', fmt: (v: number) => String(v), sub: 'closingWonRate', success: true },
                            { label: 'Closing → No-Show', field: 'closingNoShow', fmt: (v: number) => String(v), sub: 'closingNoShowRate', danger: true },
                            { label: 'Closing → Lost', field: 'closingLost', fmt: (v: number) => String(v) },
                            { label: 'Closing → Angebot', field: 'closingAngebot', fmt: (v: number) => String(v) },
                            { label: 'Closing → CC2', field: 'closingCC2', fmt: (v: number) => String(v) },
                            { label: 'Closing → Follow-Up', field: 'closingFollowUp', fmt: (v: number) => String(v) },
                            { label: '', field: '', fmt: () => '', divider: true },
                            { label: 'Setting No-Show Recovery', field: 'noShowRecoveredSetting', fmt: (v: number) => String(v), sub: 'noShowRecoveryRateSetting' },
                            { label: 'Closing No-Show Recovery', field: 'noShowRecoveredClosing', fmt: (v: number) => String(v), sub: 'noShowRecoveryRateClosing' },
                            { label: '', field: '', fmt: () => '', divider: true },
                            { label: 'Setting → Won (End-to-End)', field: 'settingToWonRate', fmt: (v: number) => v > 0 ? v.toFixed(1) + '%' : '–', highlight: true },
                            { label: 'Umsatz (All-Time)', field: 'totalRevenue', fmt: (v: number) => v > 0 ? Math.round(v).toLocaleString('de-DE') + '€' : '–' },
                            { label: 'Umsatz (MTD)', field: 'mtdRevenue', fmt: (v: number) => v > 0 ? Math.round(v).toLocaleString('de-DE') + '€' : '–' },
                            { label: 'Deals (All-Time)', field: 'dealCount', fmt: (v: number) => String(v) },
                          ].map((row: any, ri: number) => {
                            if (row.divider) {
                              return <tr key={ri}><td colSpan={oq.length + 1} style={{ padding: '4px', borderBottom: '1px solid var(--za-border)' }}></td></tr>
                            }
                            return (
                              <tr key={ri} style={{ borderBottom: '1px solid rgba(249,249,249,0.03)' }}>
                                <td style={{ padding: '8px 12px', color: row.highlight ? 'var(--za-gold)' : 'var(--za-fg-2)', fontWeight: row.highlight ? 600 : 400 }}>{row.label}</td>
                                {oq.map((o: any, ci: number) => {
                                  const val = o[row.field]
                                  const subVal = row.sub ? o[row.sub] : null
                                  const isBest = row.field && oq.length > 1 && (
                                    row.lower
                                      ? val > 0 && val <= Math.min(...oq.map((x: any) => x[row.field]).filter((v: number) => v > 0))
                                      : val > 0 && val >= Math.max(...oq.map((x: any) => x[row.field]))
                                  )
                                  return (
                                    <td key={ci} style={{ textAlign: 'right', padding: '8px 12px', fontWeight: isBest ? 700 : 400, color: row.success ? 'var(--za-success)' : row.danger && val > 0 ? 'var(--za-danger)' : isBest ? 'var(--za-gold)' : 'var(--za-fg)' }}>
                                      {row.fmt(val)}
                                      {subVal != null && subVal > 0 && <span style={{ fontSize: '10px', color: row.danger ? 'rgba(232,116,103,0.6)' : row.success ? 'rgba(127,194,155,0.6)' : 'var(--za-fg-3)', marginLeft: '4px' }}>({subVal}%)</span>}
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Visual No-Show Breakdown */}
                  <div className="row-2-equal" style={{ marginTop: '20px' }}>
                    {oq.map((o: any, idx: number) => {
                      const firstName = o.name.split(' ')[0]
                      const settingItems = [
                        { label: 'Closing', count: o.settingToCLosing, color: 'var(--za-success)' },
                        { label: 'No-Show', count: o.settingNoShow, color: 'var(--za-danger)' },
                        { label: 'Follow-Up', count: o.settingFollowUp, color: 'var(--za-info)' },
                        { label: 'Lost', count: o.settingLost, color: 'var(--za-fg-3)' },
                      ]
                      const closingItems = [
                        { label: 'Won', count: o.closingWon, color: 'var(--za-success)' },
                        { label: 'No-Show', count: o.closingNoShow, color: 'var(--za-danger)' },
                        { label: 'Lost', count: o.closingLost, color: 'var(--za-fg-3)' },
                        { label: 'Angebot', count: o.closingAngebot, color: 'var(--za-gold)' },
                        { label: 'CC2', count: o.closingCC2, color: 'var(--za-info)' },
                        { label: 'Follow-Up', count: o.closingFollowUp, color: 'var(--za-violation)' },
                      ]

                      const renderBar = (items: { label: string; count: number; color: string }[], total: number) => {
                        if (total === 0) return <div style={{ fontSize: '11px', color: 'var(--za-fg-4)', padding: '8px 0' }}>Keine Daten</div>
                        return (
                          <>
                            <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                              {items.filter(i => i.count > 0).map((item, i) => (
                                <div key={i} style={{ width: `${(item.count / total) * 100}%`, background: item.color, minWidth: '3px' }} />
                              ))}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {items.filter(i => i.count > 0).map((item, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: item.color }} />
                                  <span style={{ color: 'var(--za-fg-3)' }}>{item.label}</span>
                                  <span style={{ color: 'var(--za-fg)', fontWeight: 600 }}>{item.count}</span>
                                  <span style={{ color: 'var(--za-fg-4)', fontSize: '10px' }}>({Math.round((item.count / total) * 100)}%)</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )
                      }

                      return (
                        <div key={idx} className="za-panel fade-up" style={{ animationDelay: `${200 + idx * 80}ms` }}>
                          <div className="panel-head">
                            <div>
                              <span className="panel-eyebrow">{firstName}</span>
                              <div className="panel-title">Pipeline-Qualität</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--za-gold)' }}>{o.settingToWonRate > 0 ? o.settingToWonRate.toFixed(1) + '%' : '–'}</div>
                              <div style={{ fontSize: '10px', color: 'var(--za-fg-3)' }}>Setting → Won</div>
                            </div>
                          </div>

                          <div style={{ marginTop: '16px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--za-fg-2)', marginBottom: '8px' }}>
                              Settings ({o.settingTotal})
                              {o.settingNoShowRate > 0 && <span style={{ color: 'var(--za-danger)', marginLeft: '8px' }}>No-Show: {o.settingNoShowRate}%</span>}
                            </div>
                            {renderBar(settingItems, o.settingTotal)}
                          </div>

                          <div style={{ marginTop: '20px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--za-fg-2)', marginBottom: '8px' }}>
                              Closings ({o.closingTotal})
                              {o.closingWonRate > 0 && <span style={{ color: 'var(--za-success)', marginLeft: '8px' }}>Won: {o.closingWonRate}%</span>}
                            </div>
                            {renderBar(closingItems, o.closingTotal)}
                          </div>

                          <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', background: 'rgba(249,249,249,0.02)', border: '1px solid var(--za-border)' }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--za-fg-2)', marginBottom: '8px' }}>No-Show Recovery</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <div>
                                <div style={{ fontSize: '10px', color: 'var(--za-fg-3)' }}>Setting</div>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: o.noShowRecoveryRateSetting > 0 ? 'var(--za-success)' : 'var(--za-fg-4)' }}>
                                  {o.noShowRecoveredSetting}/{o.noShowTotalSetting}
                                  {o.noShowRecoveryRateSetting > 0 && <span style={{ fontSize: '11px', marginLeft: '4px' }}>({o.noShowRecoveryRateSetting}%)</span>}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: '10px', color: 'var(--za-fg-3)' }}>Closing</div>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: o.noShowRecoveryRateClosing > 0 ? 'var(--za-success)' : 'var(--za-fg-4)' }}>
                                  {o.noShowRecoveredClosing}/{o.noShowTotalClosing}
                                  {o.noShowRecoveryRateClosing > 0 && <span style={{ fontSize: '11px', marginLeft: '4px' }}>({o.noShowRecoveryRateClosing}%)</span>}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', background: 'rgba(197,160,89,0.05)', border: '1px solid rgba(197,160,89,0.15)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                              <div>
                                <div style={{ fontSize: '10px', color: 'var(--za-fg-3)' }}>Umsatz (All-Time)</div>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--za-gold)' }}>{o.totalRevenue > 0 ? Math.round(o.totalRevenue).toLocaleString('de-DE') + '€' : '–'}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '10px', color: 'var(--za-fg-3)' }}>Umsatz (MTD)</div>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--za-success)' }}>{o.mtdRevenue > 0 ? Math.round(o.mtdRevenue).toLocaleString('de-DE') + '€' : '–'}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
                )
              })()}
              </div>

              <div id="sec-team-umsatz" style={{ display: activeSection === 'sec-team-umsatz' || !activeSection ? undefined : 'none' }}>
              {/* Opener Umsatz-Attribution */}
              {openerRev.length > 0 && (
                <>
                  <div className="za-panel fade-up" style={{ animationDelay: '60ms' }}>
                    <div className="panel-head">
                      <div>
                        <span className="panel-eyebrow">Revenue Attribution</span>
                        <div className="panel-title">Umsatz pro Opener</div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--za-fg-3)' }}>
                        Zuordnung via erstem Cold Call Protokoll
                      </div>
                    </div>

                    {/* KPI Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${openerRev.length + 1}, 1fr)`, gap: '16px', padding: '16px 0', borderBottom: '1px solid var(--za-border)' }}>
                      {openerRev.map((o: any, idx: number) => (
                        <div key={idx} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '11px', color: 'var(--za-fg-3)', marginBottom: '4px' }}>{o.name.split(' ')[0]}</div>
                          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--za-gold)' }}>{Math.round(o.totalRevenue).toLocaleString('de-DE')}€</div>
                          <div style={{ fontSize: '11px', color: 'var(--za-fg-3)', marginTop: '2px' }}>{o.dealCount} Deals</div>
                          <div style={{ fontSize: '11px', color: 'var(--za-success)', marginTop: '2px' }}>MTD: {Math.round(o.mtdRevenue).toLocaleString('de-DE')}€ ({o.mtdDealCount})</div>
                        </div>
                      ))}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: 'var(--za-fg-3)', marginBottom: '4px' }}>Gesamt</div>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff' }}>{Math.round(data.openerRevenueTotal || 0).toLocaleString('de-DE')}€</div>
                        <div style={{ fontSize: '11px', color: 'var(--za-fg-3)', marginTop: '2px' }}>{openerRev.reduce((s: number, o: any) => s + o.dealCount, 0)} Deals</div>
                        <div style={{ fontSize: '11px', color: 'var(--za-success)', marginTop: '2px' }}>MTD: {Math.round(data.openerRevenueMTD || 0).toLocaleString('de-DE')}€</div>
                      </div>
                    </div>

                    {/* Deal List per Opener */}
                    {openerRev.map((o: any, idx: number) => (
                      <div key={idx} style={{ marginTop: '16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--za-fg-2)', marginBottom: '8px' }}>{o.name} — letzte Deals</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {o.deals.slice(0, 5).map((d: any, i: number) => {
                            const dateParts = d.date.split('-')
                            const dateFmt = dateParts.length === 3 ? `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}` : d.date
                            return (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--za-border)' }}>
                                <span style={{ fontSize: '12px', color: 'var(--za-fg-2)' }}>{d.leadName}</span>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--za-fg-3)' }}>{dateFmt}</span>
                                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--za-gold)' }}>{Math.round(d.value).toLocaleString('de-DE')}€</span>
                                </div>
                              </div>
                            )
                          })}
                          {o.deals.length > 5 && (
                            <div style={{ fontSize: '11px', color: 'var(--za-fg-4)', textAlign: 'center', padding: '4px' }}>
                              +{o.deals.length - 5} weitere Deals
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              </div>
              <div id="sec-team-aufstieg" style={{ display: activeSection === 'sec-team-aufstieg' || !activeSection ? undefined : 'none' }}>
              {/* Opener Aufstiegs-Tracker KPIs */}
              <div className="kpi-grid">
                {openers.map((opener, idx) => {
                  const firstName = opener.name.split(' ')[0]
                  const statusColor = opener.completed ? 'var(--za-success)' : opener.onTrack ? 'var(--za-success)' : 'var(--za-danger)'
                  return (
                    <div key={idx} className="za-panel fade-up" style={{ animationDelay: `${60 + idx * 80}ms` }}>
                      <div className="kpi-top"><span className="kpi-label">{firstName}</span></div>
                      <div className="kpi-value" style={{ color: statusColor }}>{opener.totalTermine}<span style={{ fontSize: '16px', color: 'var(--za-fg-3)' }}>/{opener.targetTermine}</span></div>
                      <div className="kpi-foot"><span className="kpi-caption">{opener.completed ? 'Ziel erreicht!' : `${opener.termineRemaining} verbleibend`}</span></div>
                    </div>
                  )
                })}
                <div className="za-panel fade-up" style={{ animationDelay: `${60 + openers.length * 80}ms` }}>
                  <div className="kpi-top"><span className="kpi-label">Gesamt Termine</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-gold)' }}>{openers.reduce((s, o) => s + o.totalTermine, 0)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">Alle Opener</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: `${140 + openers.length * 80}ms` }}>
                  <div className="kpi-top"><span className="kpi-label">Heute</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-info)' }}>{openers.reduce((s, o) => {
                    const todayEntry = o.dailyLog.find(e => e.date === data.todayISO)
                    return s + (todayEntry?.count || 0)
                  }, 0)}</div>
                  <div className="kpi-foot"><span className="kpi-caption">Termine heute</span></div>
                </div>
                <div className="za-panel fade-up" style={{ animationDelay: `${220 + openers.length * 80}ms` }}>
                  <div className="kpi-top"><span className="kpi-label">Bonus gesamt</span></div>
                  <div className="kpi-value" style={{ color: 'var(--za-success)' }}>{openers.reduce((s, o) => s + o.totalBonus, 0)}€</div>
                  <div className="kpi-foot"><span className="kpi-caption">Alle Opener</span></div>
                </div>
              </div>

              {/* Per-Opener Aufstiegs-Cards */}
              {openers.map((opener, idx) => {
                const firstName = opener.name.split(' ')[0]
                const deadlineParts = opener.deadlineDate.split('-')
                const deadlineFmt = `${deadlineParts[2]}.${deadlineParts[1]}.${deadlineParts[0]}`
                const statusColor = opener.completed ? 'var(--za-success)' : opener.onTrack ? 'var(--za-success)' : 'var(--za-danger)'
                const statusLabel = opener.completed ? 'Ziel erreicht!' : opener.onTrack ? 'On Track' : 'Behind Schedule'
                const todayEntry = opener.dailyLog.find(e => e.date === data.todayISO)
                const todayCount = todayEntry?.count ?? 0

                return (
                  <div key={idx} className="za-panel fade-up" style={{ animationDelay: `${220 + idx * 100}ms`, marginBottom: '16px' }}>
                    <div className="panel-head">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--za-gold), var(--za-gold-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: '#000' }}>
                          {opener.name.charAt(0)}
                        </div>
                        <div>
                          <span className="panel-eyebrow">Opener Aufstieg</span>
                          <div className="panel-title">{opener.name}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: statusColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{statusLabel}</div>
                        <div style={{ fontSize: '11px', color: 'var(--za-fg-3)', marginTop: '2px' }}>Deadline: {deadlineFmt}</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ margin: '16px 0 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--za-fg-3)' }}>Fortschritt</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: statusColor }}>{opener.progressPercent}%</span>
                      </div>
                      <div style={{ width: '100%', height: '10px', borderRadius: '5px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{
                          width: `${opener.progressPercent}%`,
                          height: '100%',
                          borderRadius: '5px',
                          background: opener.completed
                            ? 'linear-gradient(90deg, var(--za-success), #4ade80)'
                            : opener.onTrack
                              ? 'linear-gradient(90deg, var(--za-gold), var(--za-gold-2))'
                              : 'linear-gradient(90deg, var(--za-danger), #fca5a5)',
                          transition: 'width 0.6s ease',
                        }} />
                      </div>
                    </div>

                    {/* Stats Grid */}
                    {(() => {
                      const todayLog = opener.dailyLog.find(e => e.date === data.todayISO)
                      const todayBonus = todayLog?.bonus
                      return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', padding: '12px 0', borderTop: '1px solid var(--za-border)', borderBottom: '1px solid var(--za-border)' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--za-info)' }}>{todayCount}</div>
                        <div style={{ fontSize: '10px', color: 'var(--za-fg-3)', marginTop: '2px' }}>Heute</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{opener.totalTermine}</div>
                        <div style={{ fontSize: '10px', color: 'var(--za-fg-3)', marginTop: '2px' }}>Gesamt</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--za-gold)' }}>{opener.termineRemaining}</div>
                        <div style={{ fontSize: '10px', color: 'var(--za-fg-3)', marginTop: '2px' }}>Noch offen</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: opener.completed ? 'var(--za-success)' : 'var(--za-fg)' }}>{opener.completed ? '0' : opener.requiredPerDay}</div>
                        <div style={{ fontSize: '10px', color: 'var(--za-fg-3)', marginTop: '2px' }}>/Arbeitstag</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--za-success)' }}>{todayBonus?.total ?? 0}€</div>
                        <div style={{ fontSize: '10px', color: 'var(--za-fg-3)', marginTop: '2px' }}>
                          Bonus heute
                          {todayBonus && todayBonus.total > 0 && (
                            <span style={{ display: 'block', color: 'var(--za-fg-4)', fontSize: '9px', marginTop: '1px' }}>
                              {[todayBonus.base > 0 && `${todayBonus.base}€ Staffel`, todayBonus.fruehbonus > 0 && '10€ Früh'].filter(Boolean).join(' + ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                      )
                    })()}

                    {/* Timeline Info */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 4px', fontSize: '11px', color: 'var(--za-fg-3)' }}>
                      <span>Tag {opener.daysElapsed} von {opener.maxDays}</span>
                      <span>{opener.daysRemaining} Tage verbleibend</span>
                    </div>

                    {/* Daily Log */}
                    {opener.dailyLog.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--za-fg-3)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tages-Log</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {opener.dailyLog.map((entry, i) => {
                            const dateParts = entry.date.split('-')
                            const dayFmt = `${dateParts[2]}.${dateParts[1]}`
                            const hasBonus = entry.bonus.total > 0
                            return (
                              <div key={i} style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                background: entry.count > 0 ? 'rgba(197,160,89,0.12)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${entry.count > 0 ? 'rgba(197,160,89,0.25)' : 'var(--za-border)'}`,
                                fontSize: '11px',
                              }}>
                                <span style={{ color: 'var(--za-fg-3)' }}>{dayFmt}</span>
                                <span style={{ marginLeft: '6px', fontWeight: 700, color: entry.count > 0 ? 'var(--za-gold)' : 'var(--za-fg-3)' }}>{entry.count}</span>
                                {hasBonus && <span style={{ marginLeft: '4px', fontWeight: 600, color: 'var(--za-success)', fontSize: '10px' }}>+{entry.bonus.total}€</span>}
                                {entry.fruehbonus && <span style={{ marginLeft: '2px', fontSize: '9px', color: 'var(--za-info)' }} title="Erster Termin vor 10 Uhr">F</span>}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {openers.length === 0 && (
                <div className="za-panel fade-up" style={{ animationDelay: '200ms' }}>
                  <EmptyState
                    icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>}
                    title="Opener Aufstiegs-Tracker"
                    subtitle="Keine Opener konfiguriert. Daten werden in Supabase gepflegt."
                  />
                </div>
              )}
              </div>

              {/* ── EOD Self-Assessment ────────────────────────────── */}
              <div id="sec-team-eod" style={{ display: activeSection === 'sec-team-eod' || !activeSection ? undefined : 'none' }}>
              {(() => {
                const eod = data.eodReports
                const vts = eod?.vertriebler || []
                if (vts.length === 0) return (
                  <div className="za-panel fade-up" style={{ animationDelay: '200ms' }}>
                    <EmptyState
                      icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>}
                      title="EOD Self-Assessment"
                      subtitle="Noch keine EOD Reports synchronisiert. Daten werden automatisch von Monday.com gezogen."
                    />
                  </div>
                )

                const DIMS = [
                  { key: 'avgAccountable' as const, label: 'Accountable' },
                  { key: 'avgPerformance' as const, label: 'Performance' },
                  { key: 'avgOnTrackWeekly' as const, label: 'Wochenziel' },
                  { key: 'avgOnTrackMonthly' as const, label: 'Monatsziel' },
                  { key: 'avgTipsApplied' as const, label: 'Tipps umgesetzt' },
                ]

                return (
                  <>
                    {/* KPI Cards per Vertriebler */}
                    <div className="kpi-grid">
                      {vts.map((v, idx) => {
                        const firstName = v.name.split(' ')[0]
                        const trendColor = v.trend7d > 0 ? 'var(--za-success)' : v.trend7d < 0 ? 'var(--za-danger)' : 'var(--za-fg-3)'
                        const trendArrow = v.trend7d > 0 ? '\u25B2' : v.trend7d < 0 ? '\u25BC' : '\u25CF'
                        return (
                          <div key={idx} className="za-panel fade-up" style={{ animationDelay: `${60 + idx * 80}ms` }}>
                            <div className="kpi-top"><span className="kpi-label">{firstName}</span></div>
                            <div className="kpi-value" style={{ color: 'var(--za-gold)' }}>
                              {v.overallAvg.toFixed(1)}
                              <span style={{ fontSize: '14px', color: 'var(--za-fg-3)' }}>/10</span>
                            </div>
                            <div className="kpi-foot">
                              <span className="kpi-caption" style={{ color: trendColor }}>
                                {trendArrow} {v.trend7d > 0 ? '+' : ''}{v.trend7d.toFixed(1)} (7d)
                              </span>
                              <span className="kpi-caption" style={{ marginLeft: '8px' }}>{v.totalReports} Reports</span>
                            </div>
                          </div>
                        )
                      })}
                      <div className="za-panel fade-up" style={{ animationDelay: `${60 + vts.length * 80}ms` }}>
                        <div className="kpi-top"><span className="kpi-label">Team-Schnitt</span></div>
                        <div className="kpi-value" style={{ color: '#fff' }}>
                          {vts.length > 0 ? (vts.reduce((s, v) => s + v.overallAvg, 0) / vts.length).toFixed(1) : '—'}
                          <span style={{ fontSize: '14px', color: 'var(--za-fg-3)' }}>/10</span>
                        </div>
                        <div className="kpi-foot"><span className="kpi-caption">Alle Vertriebler</span></div>
                      </div>
                    </div>

                    {/* Dimensions Breakdown Table */}
                    <div className="za-panel fade-up" style={{ animationDelay: '200ms' }}>
                      <div className="panel-head">
                        <div>
                          <span className="panel-eyebrow">Dimensionen</span>
                          <div className="panel-title">Self-Assessment Breakdown</div>
                        </div>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table className="za-table" style={{ width: '100%' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left' }}>Vertriebler</th>
                              {DIMS.map(d => <th key={d.key} style={{ textAlign: 'center' }}>{d.label}</th>)}
                              <th style={{ textAlign: 'center' }}>Gesamt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vts.map((v, idx) => (
                              <tr key={idx}>
                                <td style={{ fontWeight: 600 }}>{v.name.split(' ')[0]}</td>
                                {DIMS.map(d => {
                                  const val = v[d.key]
                                  const color = val >= 8 ? 'var(--za-success)' : val >= 5 ? 'var(--za-gold)' : 'var(--za-danger)'
                                  return <td key={d.key} style={{ textAlign: 'center', color, fontWeight: 600 }}>{val.toFixed(1)}</td>
                                })}
                                <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--za-gold)' }}>{v.overallAvg.toFixed(1)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Recent Reviews per Vertriebler */}
                    {vts.map((v, idx) => {
                      const recentReports = [...v.reports].reverse().slice(0, 5)
                      if (recentReports.length === 0) return null
                      const firstName = v.name.split(' ')[0]
                      return (
                        <div key={idx} className="za-panel fade-up" style={{ animationDelay: `${300 + idx * 100}ms` }}>
                          <div className="panel-head">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--za-gold), var(--za-gold-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#000' }}>
                                {v.name.charAt(0)}
                              </div>
                              <div>
                                <span className="panel-eyebrow">Letzte Reviews</span>
                                <div className="panel-title">{firstName}</div>
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {recentReports.map((r, i) => {
                              const dateParts = r.date.split('-')
                              const dateFmt = dateParts.length === 3 ? `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}` : r.date
                              const dims = [r.accountable, r.performanceSatisfaction, r.onTrackWeekly, r.onTrackMonthly, r.tipsApplied].filter((n): n is number => n !== null)
                              const dayAvg = dims.length > 0 ? (dims.reduce((a, b) => a + b, 0) / dims.length) : 0
                              const statusColor = r.status === 'Erledigt' ? 'var(--za-success)' : r.status === 'Gestoppt' ? 'var(--za-danger)' : 'var(--za-gold)'
                              return (
                                <div key={i} style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--za-border)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: r.gesamtReview ? '6px' : 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <span style={{ fontSize: '12px', color: 'var(--za-fg-3)' }}>{dateFmt}</span>
                                      <span style={{ fontSize: '13px', fontWeight: 700, color: dayAvg >= 8 ? 'var(--za-success)' : dayAvg >= 5 ? 'var(--za-gold)' : 'var(--za-danger)' }}>{dayAvg.toFixed(1)}/10</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      {r.status && (
                                        <span style={{ fontSize: '10px', fontWeight: 600, color: statusColor, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '2px 8px', borderRadius: '4px', background: `color-mix(in srgb, ${statusColor} 12%, transparent)` }}>
                                          {r.status}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {r.gesamtReview && (
                                    <div style={{ fontSize: '12px', color: 'var(--za-fg-2)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{r.gesamtReview}</div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )
              })()}
              </div>
            </>
            )
          })()}

          {/* ═══════════════════════════════════════════════════════ */}
          {/* CALL-ANALYSE TAB                                      */}
          {/* ═══════════════════════════════════════════════════════ */}
          {activeNav === 'call-analyse' && <CallAnalysePanel data={data} />}

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
