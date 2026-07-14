import fs from 'fs'
import path from 'path'

export interface DeliveryCustomer {
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
}

export interface FixedCosts {
  teamInklKK: number
  toolsAmex: number
  buchhaltung: number
  total: number
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
  fixedCosts: FixedCosts
  totalFixedCosts: number
  netProfit: number
  netProfitPercent: number
  cashInMonatNetto: number
  cashInMonatBrutto: number
  streitfallMonatNetto: number
  cashInSollNetto: number
  cashInSollBrutto: number
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

  const allCustomers: DeliveryCustomer[] = config.customers.map((c: any) => ({
    clId: c.cl_id,
    firma: c.firma,
    paket: c.paket,
    rateMonat: c.rate_monat,
    cashInMonat: c.cash_in_monat || c.rate_monat,
    billingDay: c.billing_day || 0,
    status: c.status,
    paymentStatus: c.payment_status || 'zahlend',
    streitfallDetails: c.streitfall_details || '',
    streitfallGesamt: c.streitfall_gesamt || 0,
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

  // Filter out gekündigt customers
  const customers = allCustomers.filter(c => c.status === 'aktiv')

  const summary = config.summary

  // Fixed costs from config
  const fc = config.delivery_config.fixed_costs || {}
  const fixedCosts: FixedCosts = {
    teamInklKK: fc.team_inkl_kk || 15000,
    toolsAmex: fc.tools_amex || 10000,
    buchhaltung: fc.buchhaltung || 2500,
    total: fc.total || 27500,
  }
  const totalTeamCost = fixedCosts.teamInklKK
  const totalFixedCosts = fixedCosts.total

  // Dynamisch berechnen statt statischer summary
  const totalMRR = customers
    .filter((c: DeliveryCustomer) => c.paymentStatus !== 'streitfall' && c.rateMonat > 0)
    .reduce((s: number, c: DeliveryCustomer) => s + c.rateMonat, 0)

  // Nur zahlende Kunden — Streitfälle (beim Anwalt) zahlen aktuell nicht
  const cashInMonatNetto = customers
    .filter((c: DeliveryCustomer) => c.paymentStatus !== 'streitfall')
    .reduce((s: number, c: DeliveryCustomer) => s + c.cashInMonat, 0)
  const cashInMonatBrutto = Math.round(cashInMonatNetto * 1.19)

  // Soll inkl. Streitfälle (was reinkommen müsste, wenn alle zahlen würden)
  const streitfallMonatNetto = customers
    .filter((c: DeliveryCustomer) => c.paymentStatus === 'streitfall')
    .reduce((s: number, c: DeliveryCustomer) => s + c.cashInMonat, 0)
  const cashInSollNetto = cashInMonatNetto + streitfallMonatNetto
  const cashInSollBrutto = Math.round(cashInSollNetto * 1.19)

  const netProfit = cashInMonatNetto - totalFixedCosts
  const netProfitPercent = cashInMonatNetto > 0 ? Math.round((netProfit / cashInMonatNetto) * 1000) / 10 : 0

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
    fixedCosts,
    totalFixedCosts,
    netProfit,
    netProfitPercent,
    cashInMonatNetto,
    cashInMonatBrutto,
    streitfallMonatNetto,
    cashInSollNetto,
    cashInSollBrutto,
  }
}
