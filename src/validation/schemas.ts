import { z } from 'zod'

import type {
  ClassicEnergyDataAta,
  ClassicEnergyDataAtw,
  ClassicLoginData,
  HomeAtaDeviceCapabilities,
  HomeAtaDeviceData,
  HomeAtwDeviceCapabilities,
  HomeAtwDeviceData,
  HomeContext,
  HomeEnergyData,
  HomeErrorLogEntry,
  HomeReportData,
  HomeTokenResponse,
  Hour,
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
export const HomeParResponseSchema: z.ZodType<{ request_uri: string }> =
  z.looseObject({
    request_uri: z.string().min(1),
  })

/** Home OIDC /connect/token response. */
export const HomeTokenResponseSchema: z.ZodType<HomeTokenResponse> =
  z.looseObject({
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

// Per-type capability schemas validate every documented field; the
// schemas stay `looseObject` so MELCloud can add new keys without
// breaking validation.
const HomeAtaCapabilitiesSchema: z.ZodType<HomeAtaDeviceCapabilities> =
  z.looseObject({
    hasAirDirection: z.boolean(),
    hasAutomaticFanSpeed: z.boolean(),
    hasAutoOperationMode: z.boolean(),
    hasCoolOperationMode: z.boolean(),
    hasDemandSideControl: z.boolean(),
    hasDryOperationMode: z.boolean(),
    hasEnergyConsumedMeter: z.boolean(),
    hasExtendedTemperatureRange: z.boolean(),
    hasHalfDegreeIncrements: z.boolean(),
    hasHeatOperationMode: z.boolean(),
    hasStandby: z.boolean(),
    hasSwing: z.boolean(),
    isLegacyDevice: z.boolean(),
    isMultiSplitSystem: z.boolean(),
    maxTempAutomatic: z.number(),
    maxTempCoolDry: z.number(),
    maxTempHeat: z.number(),
    minTempAutomatic: z.number(),
    minTempCoolDry: z.number(),
    minTempHeat: z.number(),
    numberOfFanSpeeds: z.number(),
    supportsWideVane: z.boolean(),
  })

const HomeAtwCapabilitiesSchema: z.ZodType<HomeAtwDeviceCapabilities> =
  z.looseObject({
    ftcModel: z.number(),
    hasBoiler: z.boolean(),
    hasDemandSideControl: z.boolean(),
    hasDualRoomTemperature: z.boolean(),
    hasEstimatedEnergyConsumption: z.boolean(),
    hasEstimatedEnergyProduction: z.boolean(),
    hasHalfDegrees: z.boolean(),
    hasHeatZone1: z.boolean(),
    hasHeatZone2: z.boolean(),
    hasHotWater: z.boolean(),
    hasMeasuredEnergyConsumption: z.boolean(),
    hasMeasuredEnergyProduction: z.boolean(),
    hasThermostatZone1: z.boolean(),
    hasThermostatZone2: z.boolean(),
    hasWirelessRemote: z.boolean(),
    hasZone2: z.boolean(),
    immersionHeaterCapacity: z.number(),
    maxHeatOutput: z.number(),
    maxImportPower: z.number(),
    maxSetTankTemperature: z.number(),
    maxSetTemperature: z.number(),
    minSetTankTemperature: z.number(),
    minSetTemperature: z.number(),
    refridgerentAddress: z.number(),
    temperatureIncrement: z.number(),
    temperatureIncrementOverride: z.string(),
    temperatureUnit: z.string(),
  })

// `frost-`, `overheat-` and `holidayMode` carry the same low-level
// shape (active/enabled/min/max booleans + numbers) — declared once
// and reused. `holidayMode` is left structural because the firmware
// shape varies and the SDK does not consume it.
const HomeProtectionSchema = z.looseObject({
  active: z.boolean(),
  enabled: z.boolean(),
  max: z.number(),
  min: z.number(),
})

const HomeDeviceScheduleEntrySchema = z.looseObject({
  days: z.array(z.string()),
  enabled: z.boolean(),
  id: z.string(),
  operationMode: z.string(),
  power: z.boolean(),
  setFanSpeed: z.string().optional(),
  setPoint: z.number(),
  time: z.string(),
  vaneHorizontalDirection: z.string().optional(),
  vaneVerticalDirection: z.string().optional(),
})

const HomeDeviceCommonFields = {
  displayIcon: z.string(),
  frostProtection: HomeProtectionSchema.nullable(),
  givenDisplayName: z.string(),
  holidayMode: z.looseObject({}).nullable(),
  id: z.string(),
  isConnected: z.boolean(),
  isInError: z.boolean(),
  overheatProtection: HomeProtectionSchema.nullable(),
  rssi: z.number(),
  schedule: z.array(HomeDeviceScheduleEntrySchema),
  scheduleEnabled: z.boolean(),
  settings: z.array(HomeDeviceSettingSchema),
  timeZone: z.string(),
}

const HomeAtaDeviceDataSchema: z.ZodType<HomeAtaDeviceData> = z.looseObject({
  ...HomeDeviceCommonFields,
  capabilities: HomeAtaCapabilitiesSchema,
  connectedInterfaceIdentifier: z.string(),
  connectedInterfaceType: z.union([
    z.literal('fourthGenWifi'),
    z.literal('melCloudWiFi'),
  ]),
  systemId: z.string().nullable(),
  unitSettings: z.looseObject({}).nullable(),
})

const HomeAtwDeviceDataSchema: z.ZodType<HomeAtwDeviceData> = z.looseObject({
  ...HomeDeviceCommonFields,
  capabilities: HomeAtwCapabilitiesSchema,
  ftcModel: z.string(),
  macAddress: z.string(),
})

const HomeBuildingSchema = z.looseObject({
  airToAirUnits: z.array(HomeAtaDeviceDataSchema),
  airToWaterUnits: z.array(HomeAtwDeviceDataSchema),
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
  numberOfBuildingsAllowed: z.number(),
  numberOfDevicesAllowed: z.number(),
  numberOfGuestDevicesAllowed: z.number(),
  numberOfGuestUsersAllowedPerUnit: z.number(),
  scenes: z.array(z.looseObject({})),
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

/** Home /monitor/{ata,atw}unit/{id}/errorlog response (array of entries). */
export const HomeErrorLogEntryListSchema: z.ZodType<HomeErrorLogEntry[]> =
  z.array(
    z.looseObject({
      date: z.string(),
      errorCode: z.string(),
      errorMessage: z.string(),
    }),
  )

const MAX_HOUR = 23

/** Integer hour of the day in 24-hour form (0 through 23). */
export const HourSchema: z.ZodType<Hour> = z.custom<Hour>(
  (value) =>
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_HOUR,
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

const ClassicMinimalAreaSchema = z.looseObject({
  Devices: z.array(ClassicMinimalDeviceSchema),
})

const ClassicFloorSchema = z.looseObject({
  Areas: z.array(ClassicMinimalAreaSchema),
  Devices: z.array(ClassicMinimalDeviceSchema),
})

const ClassicBuildingStructureSchema = z.looseObject({
  Areas: z.array(ClassicMinimalAreaSchema),
  Devices: z.array(ClassicMinimalDeviceSchema),
  Floors: z.array(ClassicFloorSchema),
})

/** Minimal shape the {@link ClassicBuildingListSchema} guarantees on success. */
export interface ClassicBuildingListEntry {
  readonly ID: number
  readonly Name: string
  readonly Structure: unknown
}

/**
 * Classic `/User/ListDevices` response envelope. Narrower than the full
 * `ClassicBuildingWithStructure` compile-time contract — only the fields the
 * registry actually reads are validated (`ID`, `Name`, `Structure.{Areas,
 * Devices, Floors}`). Callers still bind the compile-time type at the use site.
 */
export const ClassicBuildingListSchema: z.ZodType<ClassicBuildingListEntry[]> =
  z.array(
    z.looseObject({
      ID: z.number(),
      Name: z.string(),
      Structure: ClassicBuildingStructureSchema,
    }),
  )

// Classic /EnergyCost/Report returns one flat numeric payload per
// device type. Consumers feed the totals and hourly buckets straight
// into energy/power/COP arithmetic, so a missing or non-numeric field
// would otherwise propagate as a silent NaN instead of a traceable
// ValidationError. `z.number()` already rejects NaN and ±Infinity, so
// every validated field is guaranteed finite.

/** Classic `/EnergyCost/Report` response for an ATA (air-to-air) device. */
export const ClassicEnergyDataAtaSchema: z.ZodType<ClassicEnergyDataAta> =
  z.looseObject({
    Auto: z.array(z.number()),
    Cooling: z.array(z.number()),
    Dry: z.array(z.number()),
    Fan: z.array(z.number()),
    Heating: z.array(z.number()),
    Other: z.array(z.number()),
    TotalAutoConsumed: z.number(),
    TotalCoolingConsumed: z.number(),
    TotalDryConsumed: z.number(),
    TotalFanConsumed: z.number(),
    TotalHeatingConsumed: z.number(),
    TotalOtherConsumed: z.number(),
    UsageDisclaimerPercentages: z.string(),
  })

/** Classic `/EnergyCost/Report` response for an ATW (air-to-water) device. */
export const ClassicEnergyDataAtwSchema: z.ZodType<ClassicEnergyDataAtw> =
  z.looseObject({
    CoP: z.array(z.number()),
    TotalCoolingConsumed: z.number(),
    TotalCoolingProduced: z.number(),
    TotalHeatingConsumed: z.number(),
    TotalHeatingProduced: z.number(),
    TotalHotWaterConsumed: z.number(),
    TotalHotWaterProduced: z.number(),
  })

/**
 * Classic `/EnergyCost/Report` response for any energy-capable device
 * type. ATA and ATW are the only shapes MELCloud can return (ERV maps
 * to `energy: never` in `DeviceDataMapping`), and the two shapes are
 * disjoint, so a plain union resolves unambiguously.
 */
export const ClassicEnergyDataSchema: z.ZodType<
  ClassicEnergyDataAta | ClassicEnergyDataAtw
> = z.union([ClassicEnergyDataAtaSchema, ClassicEnergyDataAtwSchema])

/**
 * Parse `data` against `schema`; throw {@link ValidationError} on
 * mismatch. The underlying ZodError is attached via `cause` so
 * downstream observers can inspect the field path breakdown without
 * re-parsing the message string.
 * @param schema - Zod schema to validate against.
 * @param data - Untrusted data from an upstream API response.
 * @param context - Short label surfaced in the thrown error message.
 * @returns The parsed, typed data.
 * @throws A {@link ValidationError} whose `cause` is the underlying ZodError.
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
