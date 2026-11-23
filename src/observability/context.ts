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
// rather than a failure. `Passcode` (a device read) and `RandomKey`
// (the sign-in answer) are here on their NAME: both read `null` on the
// accounts measured, and a key the wire calls a passcode or a key is
// not left to print the day it is filled (62.3.1).
const EXTRA_SENSITIVE_KEYS = [
  'access_token',
  'client_secret',
  'code',
  'code_verifier',
  'contextkey',
  'id_token',
  'owneremail',
  'passcode',
  'randomkey',
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
// DECLARED, the user-entered strings this SDK's own types evidence
// (2026-10-10):
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
// DECLARED, what real payloads still printed (2026-11-23: a diagnostic
// report carried an account holder's full name, and every exchange of
// one account was then read through this engine, key paths only):
// - The bare `name` key: the account holder (Classic
//   `LoginData.Name`, printed whole at every sign-in), a building
//   (Classic `Name` at the root of the listing, Home `buildings[].name`
//   and `guestBuildings[].name`), a floor and an area (Classic
//   `Floors[].Name`, `Areas[].Name`). One seat spells something else
//   with the same word, a device setting's name
//   (`HomeDeviceSetting.name`: `Power`, `OperationModeZone1`…, the key
//   `setting()` in `home-base-device.ts` reads), and that is the one
//   seat taken back below (`NOT_PERSONAL_UNDER`): a dump with its
//   setting names blanked diagnoses nothing. Any other `name` a wire
//   grows is blanked until someone argues for it.
// - `MapLatitude`, `MapLongitude`: the position of the account's map,
//   in the same sign-in answer.
// - `WeatherObservations`: the weather at the building, which a group
//   read (`/Group/Get`) and a device read (`/Device/Get`) carry. Its
//   `Sunrise` and `Sunset`, to the second, place the house about as
//   well as the coordinates blanked above, and nothing here reads it.
// - `connectedInterfaceIdentifier`: how MELCloud Home addresses a
//   unit's adapter. Four of the five read were twelve hexadecimal
//   digits, the form of a MAC address (a first-generation adapter is
//   MAC-addressed, `HomeAtaDeviceData`); that it IS the adapter's MAC
//   is not established (none equalled a Classic `MacAddress` on that
//   account, whose units are not the same ones). It goes by the rule
//   of the network identifiers above: a hardware identifier that
//   serves no diagnosis.
// DECLARED ON THE KEY'S NAME, each read `null` or empty on the accounts
// measured, so what they carry when set is not known: `CustomerName`,
// `BuildingAddress` and `BuildingCity` (the energy report), `Owner`
// (a building's owner record, `ClassicBuildingOwner`, a record of
// unknown shape; the same key is a number on a unit), and
// `ListPendingInvite` and `ListOwnershipChangeRequest` (the sign-in
// answer: other people's requests on the account), and, since 62.3.1,
// three more the same reading listed and the first pass left
// undecided: `Scene` and `SceneOwner` (a device read: a scene is
// something its owner named) and `WeatherForecast`, which carries what
// `WeatherObservations` does, in the same body. Blanking a key that
// carries nothing costs a reader one thing: the engine writes the
// mask over a `null` too, so a dump no longer tells a scene that is
// set from none. Whether a `null` should print as `null` is the
// engine's to decide, for every key at once.
// EXCLUDED, by decision:
// - `SerialNumber`: a unique device identifier too, kept as a trade —
//   it is not observable on the network, and it is the figure a report
//   and the owner name the unit by (the serial the owner quotes to the
//   manufacturer). Blanking it is one line here if the trade changes.
// - A Classic building's `Location`: a number that maps one to one to
//   the building's city on the account measured (five buildings, three
//   cities, four to six digits), so a place at city grain. The engine
//   matches a key wherever it rides, headers included, and `Location`
//   is the HTTP header a sign-in diagnosis reads: declaring it would
//   blank every redirect target for a key into somebody else's table.
// - The account and unit ids (`UserId`, `id`, `DeviceID`, `BuildingID`)
//   and the country (`Country`, `CountryName`): what a report names a
//   thing by, and too coarse to place anyone.
// - `OwnerEmail` and `email`: already the credential tier's (above,
//   and the core's base vocabulary).
const PERSONAL_DATA_KEYS = [
  'AddressLine1',
  'AddressLine2',
  'AreaName',
  'BuildingAddress',
  'BuildingCity',
  'BuildingName',
  'City',
  'connectedInterfaceIdentifier',
  'CustomerName',
  'DeviceName',
  'District',
  'firstname',
  'FloorName',
  'givenDisplayName',
  'lastname',
  'Latitude',
  'ListOwnershipChangeRequest',
  'ListPendingInvite',
  'LocalIPAddress',
  'Longitude',
  'MacAddress',
  'MapLatitude',
  'MapLongitude',
  'name',
  'Owner',
  'OwnerName',
  'Postcode',
  'Scene',
  'SceneOwner',
  'WeatherForecast',
  'WeatherObservations',
  'Zone1Name',
  'Zone2Name',
]

// The one seat where a personal-data key names something else
// (api-core 2.5.0): under `settings`, `name` is a device setting's.
const NOT_PERSONAL_UNDER = { settings: ['name'] }

/**
 * The redaction engine bound to the MELCloud vocabulary — the ONE
 * engine shared by the call loggers, the `HttpClient` transport and
 * the `HttpError` snapshot, so neither a secret nor a user-entered
 * string can reach a log through any route. Its
 * `isSensitive`/`redactValue`/`redactUrl` members are the core's own;
 * nothing in this SDK wraps them.
 */
export const redaction: Redaction = createRedaction(EXTRA_SENSITIVE_KEYS, {
  notPersonalUnder: NOT_PERSONAL_UNDER,
  personalDataKeys: PERSONAL_DATA_KEYS,
})
