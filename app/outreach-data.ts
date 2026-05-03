import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.PITCHFIRST_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.PITCHFIRST_SUPABASE_SERVICE_KEY || ''

export interface OutreachMetrics {
  available: boolean
  totalLeads: number
  campaigns: { id: string; name: string; status: string; leadsCount: number }[]
  funnel: {
    bereitFuerVernetzung: number
    vernetzungAusstehend: number
    vernetzungAngenommen: number
    erstnachrichtGesendet: number
    fu1Gesendet: number
    fu2Gesendet: number
    fu3Gesendet: number
    reagiertWarm: number
    positivGeantwortet: number
    terminGebucht: number
    abgeschlossen: number
  }
  rates: {
    acceptanceRate: number
    messageRate: number
    replyRate: number
    positiveRate: number
    bookingRate: number
    overallConversion: number
  }
  members: {
    name: string
    connectionsSent: number
    connectionsAccepted: number
    acceptanceRate: number
    messagesSent: number
    replies: number
    replyRate: number
    positiveReplies: number
    appointmentsBooked: number
    totalLeads: number
  }[]
  tracking: {
    pageViews: number
    videoPlays: number
    ctaClicks: number
  }
  recentActivity: {
    name: string
    company: string | null
    status: string
    updatedAt: string
  }[]
}

const WORKFLOW_STATUSES = [
  'neu', 'bereit_fuer_vernetzung', 'vernetzung_ausstehend', 'vernetzung_angenommen',
  'erstnachricht_gesendet', 'kein_klick_fu_offen', 'fu1_gesendet', 'fu2_gesendet',
  'fu3_gesendet', 'reagiert_warm', 'positiv_geantwortet', 'termin_gebucht', 'abgeschlossen',
]

const SENT_STATUSES = WORKFLOW_STATUSES.slice(2) // from vernetzung_ausstehend onwards
const ACCEPTED_STATUSES = WORKFLOW_STATUSES.slice(3) // from vernetzung_angenommen onwards
const MESSAGED_STATUSES = WORKFLOW_STATUSES.slice(4) // from erstnachricht_gesendet onwards
const REPLIED_STATUSES = ['reagiert_warm', 'positiv_geantwortet', 'termin_gebucht', 'abgeschlossen']
const POSITIVE_STATUSES = ['positiv_geantwortet', 'termin_gebucht', 'abgeschlossen']
const BOOKED_STATUSES = ['termin_gebucht', 'abgeschlossen']

function pct(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 1000) / 10 : 0
}

export async function fetchOutreachData(): Promise<OutreachMetrics> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      available: false,
      totalLeads: 0,
      campaigns: [],
      funnel: {
        bereitFuerVernetzung: 0, vernetzungAusstehend: 0, vernetzungAngenommen: 0,
        erstnachrichtGesendet: 0, fu1Gesendet: 0, fu2Gesendet: 0, fu3Gesendet: 0,
        reagiertWarm: 0, positivGeantwortet: 0, terminGebucht: 0, abgeschlossen: 0,
      },
      rates: { acceptanceRate: 0, messageRate: 0, replyRate: 0, positiveRate: 0, bookingRate: 0, overallConversion: 0 },
      members: [],
      tracking: { pageViews: 0, videoPlays: 0, ctaClicks: 0 },
      recentActivity: [],
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // Fetch all outbound contacts
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, company, workflow_status, owner_user_id, campaign_id, updated_at, lead_score')
      .eq('lead_type', 'outbound')
      .order('updated_at', { ascending: false })

    const allContacts = contacts || []

    // Fetch campaigns
    const { data: campaignsRaw } = await supabase
      .from('campaigns')
      .select('id, name, status')
      .order('created_at', { ascending: false })

    const campaigns = (campaignsRaw || []).map(c => ({
      id: c.id,
      name: c.name,
      status: c.status,
      leadsCount: allContacts.filter(l => l.campaign_id === c.id).length,
    }))

    // Funnel counts
    const countStatus = (status: string) => allContacts.filter(c => c.workflow_status === status).length
    const countInStatuses = (statuses: string[]) => allContacts.filter(c => statuses.includes(c.workflow_status || '')).length

    const funnel = {
      bereitFuerVernetzung: countStatus('bereit_fuer_vernetzung') + countStatus('neu'),
      vernetzungAusstehend: countStatus('vernetzung_ausstehend'),
      vernetzungAngenommen: countStatus('vernetzung_angenommen'),
      erstnachrichtGesendet: countStatus('erstnachricht_gesendet'),
      fu1Gesendet: countStatus('fu1_gesendet'),
      fu2Gesendet: countStatus('fu2_gesendet'),
      fu3Gesendet: countStatus('fu3_gesendet'),
      reagiertWarm: countStatus('reagiert_warm'),
      positivGeantwortet: countStatus('positiv_geantwortet'),
      terminGebucht: countStatus('termin_gebucht'),
      abgeschlossen: countStatus('abgeschlossen'),
    }

    // Rates
    const totalSent = countInStatuses(SENT_STATUSES)
    const totalAccepted = countInStatuses(ACCEPTED_STATUSES)
    const totalMessaged = countInStatuses(MESSAGED_STATUSES)
    const totalReplied = countInStatuses(REPLIED_STATUSES)
    const totalPositive = countInStatuses(POSITIVE_STATUSES)
    const totalBooked = countInStatuses(BOOKED_STATUSES)

    const rates = {
      acceptanceRate: pct(totalAccepted, totalSent),
      messageRate: pct(totalMessaged, totalAccepted),
      replyRate: pct(totalReplied, totalMessaged),
      positiveRate: pct(totalPositive, totalReplied),
      bookingRate: pct(totalBooked, totalPositive),
      overallConversion: pct(totalBooked, totalSent),
    }

    // Per-member stats
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')

    const profileMap = new Map((profiles || []).map(p => [p.id, p.name || 'Unbenannt']))

    const memberIds = [...new Set(allContacts.map(c => c.owner_user_id).filter(Boolean))]
    const members = memberIds.map(uid => {
      const memberContacts = allContacts.filter(c => c.owner_user_id === uid)
      const sent = memberContacts.filter(c => SENT_STATUSES.includes(c.workflow_status || '')).length
      const accepted = memberContacts.filter(c => ACCEPTED_STATUSES.includes(c.workflow_status || '')).length
      const messaged = memberContacts.filter(c => MESSAGED_STATUSES.includes(c.workflow_status || '')).length
      const replied = memberContacts.filter(c => REPLIED_STATUSES.includes(c.workflow_status || '')).length
      const positive = memberContacts.filter(c => POSITIVE_STATUSES.includes(c.workflow_status || '')).length
      const booked = memberContacts.filter(c => BOOKED_STATUSES.includes(c.workflow_status || '')).length

      return {
        name: profileMap.get(uid!) || 'Unbekannt',
        connectionsSent: sent,
        connectionsAccepted: accepted,
        acceptanceRate: pct(accepted, sent),
        messagesSent: messaged,
        replies: replied,
        replyRate: pct(replied, messaged),
        positiveReplies: positive,
        appointmentsBooked: booked,
        totalLeads: memberContacts.length,
      }
    }).sort((a, b) => b.appointmentsBooked - a.appointmentsBooked)

    // Tracking events
    const { count: pageViews } = await supabase
      .from('lead_tracking_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'page_view')

    const { count: videoPlays } = await supabase
      .from('lead_tracking_events')
      .select('id', { count: 'exact', head: true })
      .in('event_type', ['video_play', 'video_complete'])

    const { count: ctaClicks } = await supabase
      .from('lead_tracking_events')
      .select('id', { count: 'exact', head: true })
      .in('event_type', ['cta_click', 'button_click'])

    // Recent activity (last 20 status changes)
    const recentActivity = allContacts.slice(0, 20).map(c => ({
      name: `${c.first_name} ${c.last_name}`,
      company: c.company,
      status: c.workflow_status || 'neu',
      updatedAt: c.updated_at,
    }))

    return {
      available: true,
      totalLeads: allContacts.length,
      campaigns,
      funnel,
      rates,
      members,
      tracking: {
        pageViews: pageViews || 0,
        videoPlays: videoPlays || 0,
        ctaClicks: ctaClicks || 0,
      },
      recentActivity,
    }
  } catch (error) {
    console.error('Outreach data fetch error:', error)
    return {
      available: false,
      totalLeads: 0,
      campaigns: [],
      funnel: {
        bereitFuerVernetzung: 0, vernetzungAusstehend: 0, vernetzungAngenommen: 0,
        erstnachrichtGesendet: 0, fu1Gesendet: 0, fu2Gesendet: 0, fu3Gesendet: 0,
        reagiertWarm: 0, positivGeantwortet: 0, terminGebucht: 0, abgeschlossen: 0,
      },
      rates: { acceptanceRate: 0, messageRate: 0, replyRate: 0, positiveRate: 0, bookingRate: 0, overallConversion: 0 },
      members: [],
      tracking: { pageViews: 0, videoPlays: 0, ctaClicks: 0 },
      recentActivity: [],
    }
  }
}
