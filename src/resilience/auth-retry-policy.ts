// Thin re-export of @olivierzal/api-core (the mechanism formerly
// duplicated here as heatzy-api's twin). The auth-failure statuses are
// a constructor parameter now; this SDK keeps the default `[401]`.
export { AuthRetryPolicy } from '@olivierzal/api-core'
