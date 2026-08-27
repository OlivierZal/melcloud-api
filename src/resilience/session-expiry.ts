// Thin re-export of @olivierzal/api-core (the mechanism formerly
// duplicated here as heatzy-api's twin). The optional IANA `zone`
// parameter — Classic threads `ClassicAPIConfig.timezone` through it
// for the server's offset-less expiry strings — rode into the core
// with the extraction.
export { isSessionExpired } from '@olivierzal/api-core'
