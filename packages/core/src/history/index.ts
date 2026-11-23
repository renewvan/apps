// `@renewvan/core/history`: the van's history from InfluxDB, read through the hub's `/influx`
// proxy. The Flux queries, the parser for the CSV InfluxDB answers with, and the solar yield views
// built from it. Fetching stays with each app (`lib/influx.ts`): only it knows where the proxy is
// and how the login reaches it.

export { parseFluxCsv, type FluxPoint } from './influxCsv'
export { dailyYieldQuery } from './influxQuery'
export {
  HISTORY_DAYS,
  HISTORY_PAGE_DAYS,
  firstSolar,
  firstSolarId,
  formatYield,
  formatYieldAmount,
  historyDayLabel,
  yieldAxis,
  yieldHistoryFromPoints,
  yieldHistoryView,
  type YieldDay,
  type YieldHistoryView,
} from './solarView'
