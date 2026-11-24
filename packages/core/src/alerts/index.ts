// `@renewvan/core/alerts`: the alert rules both apps follow. Which alerts should be open now, read
// off the Live van and the hub link (`desiredAlerts`), how open alerts open and resolve
// (`reconcile`), and the Demo mode rule (`savedToHistory`, `alertOnScreen`). Each app keeps only
// how it shows them (toasts, notifications) and where it stores them.

export {
  ALERT_KEYS,
  alertOnScreen,
  desiredAlerts,
  reconcile,
  savedToHistory,
  type Alert,
  type AlertContent,
  type AlertLink,
  type DesiredAlerts,
} from './alerts'
