import { z } from 'zod'

import type { TokenResponse } from '../api/token-auth.ts'
import type {
  ClassicLoginData,
  HomeContext,
  HomeEnergyData,
  HomeErrorLogEntry,
  HomeReportData,
} from '../types/index.ts'
import { ClassicDeviceType } from '../constants.ts'
import { ValidationError } from '../errors/index.ts'

// Runtime schemas for API boundaries where silent shape drift would hide
// behind later undefined-property errors. Scoped to payloads the SDK
// actually consumes fields from — the wire format carries many more
// keys that the compile-time types already document.

/** Classic /Login/ClientLogin3 response. */
export const ClassicLoginDataSchema: z.ZodType<ClassicLoginData> =
  z.looseObject({
    LoginData: z
      .looseObject({
        ContextKey: z.string(),
        Expiry: z.string(),
      })
      .nullable(),
  })

/** Home OIDC /connect/par response. */
export const HomeParResponseSchema = z.looseObject({
  request_uri: z.string().min(1),
})

/** Home OIDC /connect/token response. */
export const HomeTokenResponseSchema: z.ZodType<TokenResponse> = z.looseObject({
  access_token: z.string().min(1),
  expires_in: z.number(),
  id_token: z.string().optional(),
  refresh_token: z.string().optional(),
  scope: z.string(),
  token_type: z.literal('Bearer'),
})

// Home BFF /context response — the single top-level payload that drives
// user identity, building listing and device registry sync. Validating
// it up-front turns an "undefined is not iterable" crash deep inside
// the registry into an up-front error with a full field path.
const HomeDeviceSettingSchema = z.looseObject({
  name: z.string(),
  value: z.string(),
})

const HomeDeviceCapabilitiesSchema = z.looseObject({
  hasAirDirection: z.boolean(),
  hasAutomaticFanSpeed: z.boolean(),
  hasAutoOperationMode: z.boolean(),
  hasCoolOperationMode: z.boolean(),
  hasDryOperationMode: z.boolean(),
  hasHalfDegreeIncrements: z.boolean(),
  hasHeatOperationMode: z.boolean(),
  hasSwing: z.boolean(),
  maxTempAutomatic: z.number(),
  maxTempCoolDry: z.number(),
  maxTempHeat: z.number(),
  minTempAutomatic: z.number(),
  minTempCoolDry: z.number(),
  minTempHeat: z.number(),
  numberOfFanSpeeds: z.number(),
})

const HomeDeviceDataSchema = z.looseObject({
  capabilities: HomeDeviceCapabilitiesSchema,
  givenDisplayName: z.string(),
  id: z.string(),
  rssi: z.number(),
  settings: z.array(HomeDeviceSettingSchema),
})

const HomeBuildingSchema = z.looseObject({
  airToAirUnits: z.array(HomeDeviceDataSchema),
  airToWaterUnits: z.array(HomeDeviceDataSchema),
  id: z.string(),
  name: z.string(),
  timezone: z.string(),
})

/** Home BFF /context response. */
export const HomeContextSchema: z.ZodType<HomeContext> = z.looseObject({
  buildings: z.array(HomeBuildingSchema),
  country: z.string(),
  email: z.string(),
  firstname: z.string(),
  guestBuildings: z.array(HomeBuildingSchema),
  id: z.string(),
  language: z.string(),
  lastname: z.string(),
})

// Home telemetry / report endpoints. Responses are consumed as arrays
// the SDK iterates downstream, so a malformed shape would surface as
// "undefined is not iterable" rather than a tractable error. Schemas
// bind to the canonical interfaces in `types/home.ts` so divergence
// becomes a compile-time error.
const HomeEnergyPointSchema = z.looseObject({
  time: z.string(),
  value: z.string(),
})

const HomeEnergyMeasureSchema = z.looseObject({
  deviceId: z.string().optional(),
  type: z.string(),
  values: z.array(HomeEnergyPointSchema),
})

/**
 * Home `/telemetry/telemetry/energy/{id}` and `/telemetry/telemetry/actual/{id}`
 * response shape. The energy endpoint carries `deviceId` at the top level, the
 * actual endpoint only on each measure entry — both layouts share the same
 * `measureData` format, so `deviceId` is optional at either level rather than
 * maintaining two parallel schemas.
 */
export const HomeEnergyDataSchema: z.ZodType<HomeEnergyData> = z.looseObject({
  deviceId: z.string().optional(),
  measureData: z.array(HomeEnergyMeasureSchema),
})

const HomeReportPointSchema = z.looseObject({
  /* eslint-disable id-length -- match the wire format produced by the BFF */
  x: z.string(),
  y: z.number(),
  /* eslint-enable id-length */
})

const HomeReportDatasetSchema = z.looseObject({
  data: z.array(HomeReportPointSchema),
  id: z.string(),
  label: z.string(),
})

/** Home /report/v1/trendsummary response. */
export const HomeReportDataSchema: z.ZodType<HomeReportData> = z.looseObject({
  datasets: z.array(HomeReportDatasetSchema),
  reportPeriod: z.string(),
})

/** Home /monitor/ataunit/{id}/errorlog response (array of entries). */
export const HomeErrorLogEntryListSchema: z.ZodType<HomeErrorLogEntry[]> =
  z.array(
    z.looseObject({
      date: z.string(),
      errorCode: z.string(),
      errorMessage: z.string(),
    }),
  )

// Classic /User/ListDevices returns an array of building-with-structure
// envelopes. The registry iterates structure.Devices and expects every
// entry to carry a Type/DeviceID/DeviceName/Device triple. Validate the
// envelope shape plus that minimal device header — the per-device-type
// payload (Ata/Atw/Erv) stays on compile-time types because each schema
// would otherwise duplicate 300 LOC of field definitions.
const ClassicMinimalDeviceSchema = z.looseObject({
  AreaID: z.number().nullable(),
  BuildingID: z.number(),
  Device: z.looseObject({}),
  DeviceID: z.number(),
  DeviceName: z.string(),
  FloorID: z.number().nullable(),
  Type: z.union([
    z.literal(ClassicDeviceType.Ata),
    z.literal(ClassicDeviceType.Atw),
    z.literal(ClassicDeviceType.Erv),
  ]),
})

const ClassicFloorSchema = z.looseObject({
  Areas: z.array(
    z.looseObject({
      Devices: z.array(ClassicMinimalDeviceSchema),
    }),
  ),
  Devices: z.array(ClassicMinimalDeviceSchema),
})

const ClassicBuildingStructureSchema = z.looseObject({
  Areas: z.array(
    z.looseObject({
      Devices: z.array(ClassicMinimalDeviceSchema),
    }),
  ),
  Devices: z.array(ClassicMinimalDeviceSchema),
  Floors: z.array(ClassicFloorSchema),
})

/**
 * Classic `/User/ListDevices` response envelope. Narrower than the full
 * `ClassicBuildingWithStructure` compile-time contract — only the fields the
 * registry actually reads are validated (`ID`, `Name`, `Structure.{Areas,
 * Devices, Floors}`). Callers still bind the compile-time type at the use site.
 */
export const ClassicBuildingListSchema = z.array(
  z.looseObject({
    ID: z.number(),
    Name: z.string(),
    Structure: ClassicBuildingStructureSchema,
  }),
)

/**
 * Parse `data` against `schema`; throw {@link ValidationError} on
 * mismatch. The underlying ZodError is attached via `cause` so
 * downstream observers can inspect the field path breakdown without
 * re-parsing the message string.
 * @param schema - Zod schema to validate against.
 * @param data - Untrusted data from an upstream API response.
 * @param context - Short label surfaced in the thrown error message.
 * @returns The parsed, typed data.
 */
export const parseOrThrow = <T>(
  schema: z.ZodType<T>,
  data: unknown,
  context: string,
): T => {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new ValidationError(
      `Invalid API response shape (${context}): ${result.error.message}`,
      { cause: result.error, context },
    )
  }
  return result.data
}
