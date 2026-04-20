import fs from 'fs'
import path from 'path'

export interface DeliveryCustomer {
  clId: string
  firma: string
  paket: string
  rateMonat: number
  status: string
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
}

export interface DeliveryMetrics {
  team: { name: string; role: string; hourlyRate: number; monthlyHours: number; monthlyCost: number }[]
  customers: DeliveryCustomer[]
  totalMRR: number
  totalDeliveryCost: number
  totalMargin: number
  avgMarginPercent: number
  totalHoursFelx: number
  totalHoursNils: number
  totalHoursMarcel: number
  totalHoursLisa: number
  totalTeamCost: number
  netProfit: number
  netProfitPercent: number
}

export function getDeliveryMetrics(): DeliveryMetrics {
  const configPath = path.join(process.cwd(), 'app', 'delivery-config.json')
  const raw = fs.readFileSync(configPath, 'utf-8')
  const config = JSON.parse(raw)

  const team = config.delivery_config.team.map((t: any) => ({
    name: t.name,
    role: t.role,
    hourlyRate: t.hourly_rate_internal,
    monthlyHours: t.monthly_hours,
    monthlyCost: t.monthly_cost,
  }))

  const customers: DeliveryCustomer[] = config.customers.map((c: any) => ({
    clId: c.cl_id,
    firma: c.firma,
    paket: c.paket,
    rateMonat: c.rate_monat,
    status: c.status,
    delivery: {
      felixHours: c.delivery.felix_hours,
      nilsHours: c.delivery.nils_hours,
      marcelHours: c.delivery.marcel_hours,
      lisaHours: c.delivery.lisa_hours,
      tasks: c.delivery.tasks,
      deliveryCost: c.delivery.delivery_cost,
      marginEuro: c.delivery.margin_euro,
      marginPercent: c.delivery.margin_percent,
    },
  }))

  const summary = config.summary

  // Team overhead: use JSON values except Nils = €4.800 actual
  const nilsActualCost = 4800
  const felixCost = 5000
  const lisaCost = 2500
  const marcelCost = 1250
  const totalTeamCost = felixCost + lisaCost + marcelCost + nilsActualCost // 13550

  const totalMRR = summary.total_active_mrr
  const netProfit = totalMRR - totalTeamCost
  const netProfitPercent = Math.round((netProfit / totalMRR) * 1000) / 10

  return {
    team,
    customers,
    totalMRR,
    totalDeliveryCost: summary.total_delivery_cost,
    totalMargin: summary.total_margin,
    avgMarginPercent: summary.avg_margin_percent,
    totalHoursFelx: summary.total_delivery_hours_felix,
    totalHoursNils: summary.total_delivery_hours_nils,
    totalHoursMarcel: summary.total_delivery_hours_marcel,
    totalHoursLisa: summary.total_delivery_hours_lisa,
    totalTeamCost,
    netProfit,
    netProfitPercent,
  }
}
