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
//   An IP address is personal data under the GDPR (Recital 30's "online
//   identifiers"; CJEU C-582/14 Breyer, dynamic addresses included) and
//   the EDPB reads a MAC address the same way (a unique device
//   identifier). Neither serves a diagnosis: the app and every
//   SDK-authored line name a unit by `DeviceID`/`id`.
// EXCLUDED, by decision:
// - The bare `name` key. On Home it carries the building name
//   (`HomeBuilding.name`) — but ALSO every device setting's name
//   (`HomeDeviceSetting.name`: `Power`, `OperationModeZone1`…, the key
//   `setting()` in `home-base-device.ts` reads), and a key is blanked
//   wherever it rides, so declaring it would hide the setting names
//   from the very dump a diagnosis needs. Home building names and the
//   Classic building/floor/area `Name` entries therefore STAY in the
//   dump: a known trade.
// - `SerialNumber`: the hardware serial of the adapter and of each unit
//   (`Units[].SerialNumber`). Not a network identifier, linked to a
//   person only through the manufacturer's registration records, and
//   the one figure an owner quotes to the manufacturer — it stays, with
//   `DeviceID`, as how a report names a unit.
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
