import { readFileSync } from 'fs'
import { join } from 'path'

export interface FacebookCampaign {
  name: string
  status: string
  results: number
  resultType: string
  reach: number
  frequency: number
  costPerResult: number
  budget: number
  budgetType: string
  spend: number
  impressions: number
  cpm: number
  linkClicks: number
  cpc: number
  ctr: number
  allClicks: number
  allCtr: number
  landingPageViews: number
  costPerLPV: number
  videoViews3s: number
  thruPlays: number
}

export interface FacebookMetrics {
  available: boolean
  period: { start: string; end: string }
  previousPeriod: { start: string; end: string } | null
  campaigns: FacebookCampaign[]
  previousCampaigns: FacebookCampaign[]
  totals: {
    spend: number
    impressions: number
    reach: number
    linkClicks: number
    leads: number
    cpl: number
    ctr: number
    cpm: number
    landingPageViews: number
  }
  previousTotals: {
    spend: number
    impressions: number
    reach: number
    linkClicks: number
    leads: number
    cpl: number
    ctr: number
    cpm: number
    landingPageViews: number
  } | null
}

function parseCSV(content: string): FacebookCampaign[] {
  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  return lines.slice(1).map(line => {
    // Parse CSV with quoted fields
    const fields: string[] = []
    let current = ''
    let inQuotes = false
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue }
      if (char === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue }
      current += char
    }
    fields.push(current.trim())

    const num = (i: number) => {
      const v = fields[i]
      if (!v || v === '') return 0
      return parseFloat(v.replace(',', '.')) || 0
    }

    return {
      name: fields[2] || '',
      status: fields[3] || 'inactive',
      results: num(5),
      resultType: fields[6] || '',
      reach: num(7),
      frequency: num(8),
      costPerResult: num(9),
      budget: num(10),
      budgetType: fields[11] || '',
      spend: num(12),
      impressions: num(14),
      cpm: num(15),
      linkClicks: num(16),
      cpc: num(18),
      ctr: num(19),
      allClicks: num(20),
      allCtr: num(21),
      landingPageViews: num(23),
      costPerLPV: num(24),
      videoViews3s: num(25),
      thruPlays: num(27),
    }
  }).filter(c => c.name)
}

function calcTotals(campaigns: FacebookCampaign[]) {
  const active = campaigns.filter(c => c.spend > 0)
  const spend = active.reduce((s, c) => s + c.spend, 0)
  const impressions = active.reduce((s, c) => s + c.impressions, 0)
  const reach = active.reduce((s, c) => s + c.reach, 0)
  const linkClicks = active.reduce((s, c) => s + c.linkClicks, 0)
  const leads = active.filter(c => c.resultType.includes('lead')).reduce((s, c) => s + c.results, 0)
  const landingPageViews = active.reduce((s, c) => s + c.landingPageViews, 0)

  return {
    spend: Math.round(spend * 100) / 100,
    impressions,
    reach,
    linkClicks,
    leads,
    cpl: leads > 0 ? Math.round(spend / leads * 100) / 100 : 0,
    ctr: impressions > 0 ? Math.round(linkClicks / impressions * 10000) / 100 : 0,
    cpm: impressions > 0 ? Math.round(spend / impressions * 100000) / 100 : 0,
    landingPageViews,
  }
}

export function getFacebookMetrics(): FacebookMetrics {
  try {
    const currentCSV = readFileSync(join(process.cwd(), 'app/facebook-ads-current.csv'), 'utf-8')
    const campaigns = parseCSV(currentCSV)

    let previousCampaigns: FacebookCampaign[] = []
    try {
      const prevCSV = readFileSync(join(process.cwd(), 'app/facebook-ads-previous.csv'), 'utf-8')
      previousCampaigns = parseCSV(prevCSV)
    } catch { /* no previous data */ }

    // Extract period from first data row
    const firstLine = currentCSV.split('\n')[1] || ''
    const periodMatch = firstLine.match(/(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})/)
    const period = periodMatch
      ? { start: periodMatch[1], end: periodMatch[2] }
      : { start: '', end: '' }

    const prevFirstLine = previousCampaigns.length > 0
      ? readFileSync(join(process.cwd(), 'app/facebook-ads-previous.csv'), 'utf-8').split('\n')[1] || ''
      : ''
    const prevMatch = prevFirstLine.match(/(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})/)
    const previousPeriod = prevMatch ? { start: prevMatch[1], end: prevMatch[2] } : null

    return {
      available: campaigns.length > 0,
      period,
      previousPeriod,
      campaigns,
      previousCampaigns,
      totals: calcTotals(campaigns),
      previousTotals: previousCampaigns.length > 0 ? calcTotals(previousCampaigns) : null,
    }
  } catch {
    return {
      available: false,
      period: { start: '', end: '' },
      previousPeriod: null,
      campaigns: [],
      previousCampaigns: [],
      totals: { spend: 0, impressions: 0, reach: 0, linkClicks: 0, leads: 0, cpl: 0, ctr: 0, cpm: 0, landingPageViews: 0 },
      previousTotals: null,
    }
  }
}
