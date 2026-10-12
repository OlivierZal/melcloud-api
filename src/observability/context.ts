// Thin vocabulary module over @olivierzal/api-core: the redaction
// MECHANISM lives in the core (shared with heatzy-api); this file owns
// only the MELCloud sensitive-key vocabulary and the bound engine every
// redaction seat in this SDK shares.
import { type Redaction, createRedaction } from '@olivierzal/api-core'

// Every key that names a credential on either wire beyond the core's
// base vocabulary (authorization, cookie, set-cookie, password,
// username, email, token), plus the OAuth vocabulary the Home flow
// speaks. `owneremail` earns its place from the Classic list payload,
// which carries the account's address on EVERY device of EVERY
// successful sync — the one entry here that blanks a routine 200
// rather than a failure.
const EXTRA_SENSITIVE_KEYS = [
  'access_token',
  'client_secret',
  'code',
  'code_verifier',
  'contextkey',
  'id_token',
  'owneremail',
  'refresh_token',
  'x-mitscontextkey',
]

// The personal-data tier (api-core 1.10.0), declared apart from the
// credential keys because it answers a different rule: a credential
// must never reach a log because it opens an account; a user-entered
// string must never reach one because the user typed it, and a
// diagnostic report pasted into a public issue reproduces it. The
// engine blanks both tiers the same way (`******`) wherever it reaches
// — the request/response dumps, the log lines and the `HttpError`
// snapshot — and matches keys case-insensitively (one lower-cased
// set), so each key is spelled once, the way its wire spells it. The
// parsed payloads are untouched: redaction is a reporting concern.
// DECLARED (2026-10-10), the user-entered strings this SDK's own types
// evidence:
// - Home `/context`: `givenDisplayName` (the unit's display name,
//   `HomeDeviceCommonData`) and `firstname`/`lastname` (the account
//   holder, on the identity slice of every `/context` round-trip).
// - Classic `/User/ListDevices`: `DeviceName`, `BuildingName`,
//   `AreaName`, `FloorName`, `Zone1Name`, `Zone2Name` (the names the
//   user typed into MELCloud, `ClassicBaseListDevice`), `OwnerName`
//   (the account holder), and the building's postal address and
//   position (`ClassicBuildingData`): `AddressLine1`, `AddressLine2`,
//   `City`, `District`, `Postcode`, `Latitude`, `Longitude`.
// The match is case-insensitive (the core lower-cases its one set), so
// the same keys also blank the id token's `firstName`/`lastName`
// (`HomeUser`) and the quantised `Latitude`/`Longitude` nested under
// each Classic building (`ClassicQuantizedCoordinates`).
// - The network identifiers: Classic `MacAddress` and `LocalIPAddress`
//   (and Home's `macAddress`, through the same case-insensitive match).
//   GDPR Recital 30 lists IP addresses among the online identifiers a
//   person may be associated with (CJEU C-582/14 Breyer, under the
//   1995 directive, held a dynamic PUBLIC address personal data where
//   legal means to identify the holder exist); a MAC address is a
//   unique device identifier the Article 29 Working Party treated as
//   personal data (Opinion 13/2011, WP185). `LocalIPAddress` is the
//   adapter's LAN address, which identifies no one on its own — it goes
//   with them because it maps the owner's home network beside the
//   account's data and, like the MAC, serves no diagnosis: the app and
//   every SDK-authored line name a unit by `DeviceID`/`id`. Data
//   minimisation decides, not a ruling.
// EXCLUDED, by decision:
// - The bare `name` key. On Home it carries the building name
//   (`HomeBuilding.name`) — but ALSO every device setting's name
//   (`HomeDeviceSetting.name`: `Power`, `OperationModeZone1`…, the key
//   `setting()` in `home-base-device.ts` reads), and a key is blanked
//   wherever it rides, so declaring it would hide the setting names
//   from the very dump a diagnosis needs. Home building names and the
//   Classic building/floor/area `Name` entries therefore STAY in the
//   dump: a known trade.
// - `SerialNumber`: a unique device identifier too, kept as a trade,
//   like `name` above — it is not observable on the network, and it is
//   the figure a report and the owner name the unit by (the serial the
//   owner quotes to the manufacturer). Blanking it is one line here if
//   the trade changes.
// - `OwnerEmail` and `email`: already the credential tier's (above,
//   and the core's base vocabulary).
const PERSONAL_DATA_KEYS = [
  'AddressLine1',
  'AddressLine2',
  'AreaName',
  'BuildingName',
  'City',
  'DeviceName',
  'District',
  'firstname',
  'FloorName',
  'givenDisplayName',
  'lastname',
  'Latitude',
  'LocalIPAddress',
  'Longitude',
  'MacAddress',
  'OwnerName',
  'Postcode',
  'Zone1Name',
  'Zone2Name',
]

/**
 * The redaction engine bound to the MELCloud vocabulary — the ONE
 * engine shared by the call loggers, the `HttpClient` transport and
 * the `HttpError` snapshot, so neither a secret nor a user-entered
 * string can reach a log through any route. Its
 * `isSensitive`/`redactValue`/`redactUrl` members are the core's own;
 * nothing in this SDK wraps them.
 */
export const redaction: Redaction = createRedaction(EXTRA_SENSITIVE_KEYS, {
  personalDataKeys: PERSONAL_DATA_KEYS,
})
