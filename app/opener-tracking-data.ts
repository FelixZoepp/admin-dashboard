import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export interface DailyBonus {
  base: number        // Staffel-Bonus (€25 bei 5, €75 bei 10)
  fruehbonus: number  // €10 wenn erster Termin vor 10 Uhr
  total: number
}

export interface OpenerProgress {
  name: string
  startDate: string
  targetTermine: number
  maxDays: number
  totalTermine: number
  dailyLog: { date: string; count: number; fruehbonus: boolean; bonus: DailyBonus }[]
  daysElapsed: number
  daysRemaining: number
  deadlineDate: string
  termineRemaining: number
  requiredPerDay: number // needed per remaining working day to hit target
  onTrack: boolean
  progressPercent: number
  completed: boolean
  totalBonus: number
}

export interface OpenerTrackingData {
  openers: OpenerProgress[]
  lastUpdated: string
}

export async function fetchOpenerTracking(): Promise<OpenerTrackingData> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { openers: [], lastUpdated: new Date().toISOString() }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const now = new Date()
  const todayISO = now.toISOString().split('T')[0]

  // Fetch config
  const { data: configs } = await supabase
    .from('opener_aufstieg_config')
    .select('*')

  if (!configs || configs.length === 0) {
    return { openers: [], lastUpdated: now.toISOString() }
  }

  // Fetch all daily entries
  const { data: entries } = await supabase
    .from('opener_aufstieg')
    .select('*')
    .order('date', { ascending: true })

  const openers: OpenerProgress[] = configs.map((config) => {
    const log = (entries || [])
      .filter((e) => e.opener_name === config.opener_name)
      .map((e) => {
        const count = e.termine_count
        const fruehbonus = !!e.fruehbonus
        // Bonus-Staffeln: €75 bei 10+, €25 bei 5+ (nicht kumulierend)
        const staffelBonus = count >= 10 ? 75 : count >= 5 ? 25 : 0
        const fruehbonusAmount = fruehbonus ? 10 : 0
        return {
          date: e.date,
          count,
          fruehbonus,
          bonus: {
            base: staffelBonus,
            fruehbonus: fruehbonusAmount,
            total: staffelBonus + fruehbonusAmount,
          } as DailyBonus,
        }
      })

    const totalTermine = log.reduce((sum, e) => sum + e.count, 0)
    const totalBonus = log.reduce((sum, e) => sum + e.bonus.total, 0)

    const startDate = new Date(config.start_date + 'T00:00:00')
    const deadlineDate = new Date(startDate.getTime() + config.max_days * 86400000)
    const deadlineISO = deadlineDate.toISOString().split('T')[0]

    const daysElapsed = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / 86400000))
    const daysRemaining = Math.max(0, Math.ceil((deadlineDate.getTime() - now.getTime()) / 86400000))

    const termineRemaining = Math.max(0, config.target_termine - totalTermine)
    const completed = totalTermine >= config.target_termine

    // Working days remaining (Mon-Fri estimate: ~5/7 of remaining days)
    const workingDaysRemaining = Math.max(1, Math.round(daysRemaining * 5 / 7))
    const requiredPerDay = completed ? 0 : Math.ceil(termineRemaining / workingDaysRemaining)

    // On track: actual pace >= required pace
    const expectedByNow = daysElapsed > 0
      ? Math.round((config.target_termine / config.max_days) * daysElapsed)
      : 0
    const onTrack = totalTermine >= expectedByNow || completed

    const progressPercent = Math.min(100, Math.round((totalTermine / config.target_termine) * 100))

    return {
      name: config.opener_name,
      startDate: config.start_date,
      targetTermine: config.target_termine,
      maxDays: config.max_days,
      totalTermine,
      dailyLog: log,
      daysElapsed,
      daysRemaining,
      deadlineDate: deadlineISO,
      termineRemaining,
      requiredPerDay,
      onTrack,
      progressPercent,
      completed,
      totalBonus,
    }
  })

  return { openers, lastUpdated: now.toISOString() }
}
