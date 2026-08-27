// Thin re-export of @olivierzal/api-core's temporal entry point
// (formerly heatzy-api's byte-identical twin): the single Temporal
// entry for the whole family, so exactly one polyfill copy is loaded
// and core-built Temporal values are `instanceof`-compatible with this
// SDK's. The subpath import (never the core's root barrel) keeps this
// module browser-bundleable — it sits in the webview floor closure.
export { Intl, Temporal } from '@olivierzal/api-core/temporal'
