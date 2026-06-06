import { createClient } from '@supabase/supabase-js'

export interface MarketingPlatform {
  source: string
  metrics: Record<string, any>
  recorded_at: string
}

export interface PerspectiveLead {
  funnel_name: string
  name: string | null
  email: string | null
  completed: boolean
  converted: boolean
  recorded_at: string
}

export interface PerspectiveStats {
  totalLeads: number
  completedLeads: number
  convertedLeads: number
  conversionRate: number
  funnels: { name: string; leads: number; completed: number; converted: number }[]
  recentLeads: PerspectiveLead[]
}

export interface PerspectiveCampaignStats {
  campaignId: string
  leads: number
  converted: number
  completed: number
  creatives: Record<string, number>
}

export interface MarketingMetrics {
  available: boolean
  platforms: Record<string, MarketingPlatform>
  kpis: {
    postsThisWeek: number
    impressions: number
    engagement: number
    leadsViaMarketing: number
  }
  history: MarketingPlatform[]
  perspective: PerspectiveStats
  perspectiveByCampaign: PerspectiveCampaignStats[]
}

const EMPTY_PERSPECTIVE: PerspectiveStats = {
  totalLeads: 0, completedLeads: 0, convertedLeads: 0, conversionRate: 0,
  funnels: [], recentLeads: [],
}

const EMPTY: MarketingMetrics = {
  available: false,
  platforms: {},
  kpis: { postsThisWeek: 0, impressions: 0, engagement: 0, leadsViaMarketing: 0 },
  history: [],
  perspective: EMPTY_PERSPECTIVE,
  perspectiveByCampaign: [],
}

export async function fetchMarketingData(): Promise<MarketingMetrics> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!SUPABASE_URL || !SUPABASE_KEY) return EMPTY

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  try {
    // Get all snapshots
    const { data: all, error } = await supabase
      .from('marketing_snapshots')
      .select('source, metrics, period, recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(500)

    if (error || !all) return EMPTY

    // Separate perspective lead events from snapshot data
    const perspectiveLeads = all.filter(r => r.source === 'perspective' && r.period === 'event')
    const snapshots = all.filter(r => r.period !== 'event')

    // Group snapshots by source, keep latest per source
    const platforms: Record<string, MarketingPlatform> = {}
    for (const row of snapshots) {
      if (!platforms[row.source]) {
        platforms[row.source] = {
          source: row.source,
          metrics: row.metrics,
          recorded_at: row.recorded_at,
        }
      }
    }

    // Aggregate KPIs from latest snapshots
    let postsThisWeek = 0
    let impressions = 0
    let engagement = 0
    let leadsViaMarketing = 0

    for (const p of Object.values(platforms)) {
      const m = p.metrics
      postsThisWeek += m.posts_this_week || 0
      impressions += m.impressions || 0
      engagement += m.engagement || m.interactions || 0
      leadsViaMarketing += m.leads || 0
    }

    // Add perspective leads to marketing leads count
    leadsViaMarketing += perspectiveLeads.length

    // Aggregate Perspective stats
    let perspective: PerspectiveStats = EMPTY_PERSPECTIVE
    let campaignMap: Record<string, { leads: number; converted: number; completed: number; creatives: Record<string, number> }> = {}
    if (perspectiveLeads.length > 0) {
      const completedLeads = perspectiveLeads.filter(l => l.metrics?.completed).length
      const convertedLeads = perspectiveLeads.filter(l => l.metrics?.converted).length

      // Group by funnel
      const funnelMap: Record<string, { leads: number; completed: number; converted: number }> = {}
      for (const lead of perspectiveLeads) {
        const fn = lead.metrics?.funnel_name || 'Unbekannt'
        if (!funnelMap[fn]) funnelMap[fn] = { leads: 0, completed: 0, converted: 0 }
        funnelMap[fn].leads++
        if (lead.metrics?.completed) funnelMap[fn].completed++
        if (lead.metrics?.converted) funnelMap[fn].converted++
      }

      const funnels = Object.entries(funnelMap)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.leads - a.leads)

      perspective = {
        totalLeads: perspectiveLeads.length,
        completedLeads,
        convertedLeads,
        conversionRate: perspectiveLeads.length > 0
          ? Math.round(convertedLeads / perspectiveLeads.length * 1000) / 10
          : 0,
        funnels,
        recentLeads: perspectiveLeads.slice(0, 20).map(l => ({
          funnel_name: l.metrics?.funnel_name || 'Unbekannt',
          name: l.metrics?.name || null,
          email: l.metrics?.email || null,
          completed: l.metrics?.completed || false,
          converted: l.metrics?.converted || false,
          recorded_at: l.recorded_at,
        })),
      }

      // Group by utm_campaign for Facebook matching
      const campaignMap: Record<string, { leads: number; converted: number; completed: number; creatives: Record<string, number> }> = {}
      for (const lead of perspectiveLeads) {
        const cid = lead.metrics?.utm_campaign || 'organic'
        const creative = lead.metrics?.utm_content || 'organic'
        if (!campaignMap[cid]) campaignMap[cid] = { leads: 0, converted: 0, completed: 0, creatives: {} }
        campaignMap[cid].leads++
        if (lead.metrics?.converted) campaignMap[cid].converted++
        if (lead.metrics?.completed) campaignMap[cid].completed++
        campaignMap[cid].creatives[creative] = (campaignMap[cid].creatives[creative] || 0) + 1
      }

      // Also set perspective as a platform summary
      platforms['perspective'] = {
        source: 'perspective',
        metrics: {
          leads: perspectiveLeads.length,
          completed: completedLeads,
          converted: convertedLeads,
          conversion_rate: perspective.conversionRate,
          funnels: funnels.length,
        },
        recorded_at: perspectiveLeads[0]?.recorded_at || new Date().toISOString(),
      }
    }

    const perspectiveByCampaign = Object.entries(campaignMap || {})
      .map(([campaignId, stats]) => ({ campaignId, ...stats }))
      .sort((a, b) => b.leads - a.leads)

    return {
      available: Object.keys(platforms).length > 0 || perspectiveLeads.length > 0,
      platforms,
      kpis: { postsThisWeek, impressions, engagement, leadsViaMarketing },
      history: snapshots,
      perspective,
      perspectiveByCampaign,
    }
  } catch (err) {
    console.error('Marketing data fetch error:', err)
    return EMPTY
  }
}
