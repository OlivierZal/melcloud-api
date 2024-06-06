# MELCloud API for Node.js

## Enumerations

### DeviceType

#### Enumeration Members

| Enumeration Member | Value |
| :----------------- | :---- |
| `Ata`              | `0`   |
| `Atw`              | `1`   |
| `Erv`              | `3`   |

---

### FanSpeed

#### Enumeration Members

| Enumeration Member | Value |
| :----------------- | :---- |
| `auto`             | `0`   |
| `fast`             | `4`   |
| `moderate`         | `3`   |
| `silent`           | `255` |
| `slow`             | `2`   |
| `very_fast`        | `5`   |
| `very_slow`        | `1`   |

---

### Horizontal

#### Enumeration Members

| Enumeration Member | Value |
| :----------------- | :---- |
| `auto`             | `0`   |
| `center`           | `3`   |
| `center_left`      | `2`   |
| `center_right`     | `4`   |
| `leftwards`        | `1`   |
| `rightwards`       | `5`   |
| `swing`            | `12`  |
| `wide`             | `8`   |

---

### Language

#### Enumeration Members

| Enumeration Member | Value |
| :----------------- | :---- |
| `bg`               | `1`   |
| `cs`               | `2`   |
| `da`               | `3`   |
| `de`               | `4`   |
| `el`               | `22`  |
| `en`               | `0`   |
| `es`               | `6`   |
| `et`               | `5`   |
| `fi`               | `17`  |
| `fr`               | `7`   |
| `hr`               | `23`  |
| `hu`               | `11`  |
| `hy`               | `8`   |
| `it`               | `19`  |
| `lt`               | `10`  |
| `lv`               | `9`   |
| `nl`               | `12`  |
| `no`               | `13`  |
| `pl`               | `14`  |
| `pt`               | `15`  |
| `ro`               | `24`  |
| `ru`               | `16`  |
| `sl`               | `25`  |
| `sq`               | `26`  |
| `sv`               | `18`  |
| `tr`               | `21`  |
| `uk`               | `20`  |

---

### OperationMode

#### Enumeration Members

| Enumeration Member | Value |
| :----------------- | :---- |
| `auto`             | `8`   |
| `cool`             | `3`   |
| `dry`              | `2`   |
| `fan`              | `7`   |
| `heat`             | `1`   |

---

### OperationModeState

#### Enumeration Members

| Enumeration Member | Value |
| :----------------- | :---- |
| `cooling`          | `3`   |
| `defrost`          | `5`   |
| `dhw`              | `1`   |
| `heating`          | `2`   |
| `idle`             | `0`   |
| `legionella`       | `6`   |

---

### OperationModeZone

#### Enumeration Members

| Enumeration Member | Value |
| :----------------- | :---- |
| `curve`            | `2`   |
| `flow`             | `1`   |
| `flow_cool`        | `4`   |
| `room`             | `0`   |
| `room_cool`        | `3`   |

---

### VentilationMode

#### Enumeration Members

| Enumeration Member | Value |
| :----------------- | :---- |
| `auto`             | `2`   |
| `bypass`           | `1`   |
| `recovery`         | `0`   |

---

### Vertical

#### Enumeration Members

| Enumeration Member | Value |
| :----------------- | :---- |
| `auto`             | `0`   |
| `downwards`        | `5`   |
| `mid_high`         | `2`   |
| `mid_low`          | `4`   |
| `middle`           | `3`   |
| `swing`            | `7`   |
| `upwards`          | `1`   |

## Classes

### AreaModel

#### Implements

- [`IAreaModel`](README.md#iareamodel)

#### Constructors

##### new AreaModel()

```ts
new AreaModel(api: default, __namedParameters: LocationData & {
  FloorId: null | number;
 }): AreaModel
```

###### Parameters

| Parameter           | Type                                                                            |
| :------------------ | :------------------------------------------------------------------------------ |
| `api`               | [`default`](README.md#default)                                                  |
| `__namedParameters` | [`LocationData`](README.md#locationdata) & \{ `FloorId`: `null` \| `number`; \} |

###### Returns

[`AreaModel`](README.md#areamodel)

###### Source

[src/models/area.ts:35](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/area.ts#L35)

#### Properties

| Property     | Modifier   | Type               |
| :----------- | :--------- | :----------------- |
| `buildingId` | `readonly` | `number`           |
| `floorId`    | `readonly` | `null` \| `number` |
| `id`         | `readonly` | `number`           |
| `name`       | `readonly` | `string`           |

#### Accessors

##### building

```ts
get building(): null | BuildingModel
```

###### Returns

`null` \| [`BuildingModel`](README.md#buildingmodel)

###### Source

[src/models/area.ts:53](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/area.ts#L53)

##### deviceIds

```ts
get deviceIds(): number[]
```

###### Returns

`number`[]

###### Source

[src/models/area.ts:57](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/area.ts#L57)

##### devices

```ts
get devices(): DeviceModelAny[]
```

###### Returns

[`DeviceModelAny`](README.md#devicemodelany)[]

###### Source

[src/models/area.ts:61](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/area.ts#L61)

##### floor

```ts
get floor(): null | FloorModel
```

###### Returns

`null` \| [`FloorModel`](README.md#floormodel)

###### Source

[src/models/area.ts:67](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/area.ts#L67)

#### Methods

##### getErrors()

```ts
getErrors(postData: Omit<ErrorPostData, "DeviceIDs">): Promise<FailureData | ErrorData[]>
```

###### Parameters

| Parameter  | Type                                                                |
| :--------- | :------------------------------------------------------------------ |
| `postData` | `Omit`\<[`ErrorPostData`](README.md#errorpostdata), `"DeviceIDs"`\> |

###### Returns

`Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>

###### Implementation of

[`IAreaModel`](README.md#iareamodel).`getErrors`

###### Source

[src/models/area.ts:96](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/area.ts#L96)

##### getFrostProtection()

```ts
getFrostProtection(): Promise<FrostProtectionData>
```

###### Returns

`Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>

###### Implementation of

[`IAreaModel`](README.md#iareamodel).`getFrostProtection`

###### Source

[src/models/area.ts:106](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/area.ts#L106)

##### getHolidayMode()

```ts
getHolidayMode(): Promise<HolidayModeData>
```

###### Returns

`Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>

###### Implementation of

[`IAreaModel`](README.md#iareamodel).`getHolidayMode`

###### Source

[src/models/area.ts:119](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/area.ts#L119)

##### getTiles()

```ts
getTiles(): Promise<TilesData<null>>
```

###### Returns

`Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\>

###### Implementation of

[`IAreaModel`](README.md#iareamodel).`getTiles`

###### Source

[src/models/area.ts:132](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/area.ts#L132)

##### setAtaGroup()

```ts
setAtaGroup(postData: Omit<SetAtaGroupPostData, "Specification">): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter  | Type                                                                                |
| :--------- | :---------------------------------------------------------------------------------- |
| `postData` | `Omit`\<[`SetAtaGroupPostData`](README.md#setatagrouppostdata), `"Specification"`\> |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IAreaModel`](README.md#iareamodel).`setAtaGroup`

###### Source

[src/models/area.ts:140](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/area.ts#L140)

##### setFrostProtection()

```ts
setFrostProtection(postData: Omit<FrostProtectionPostData, "BuildingIds">): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter  | Type                                                                                      |
| :--------- | :---------------------------------------------------------------------------------------- |
| `postData` | `Omit`\<[`FrostProtectionPostData`](README.md#frostprotectionpostdata), `"BuildingIds"`\> |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IAreaModel`](README.md#iareamodel).`setFrostProtection`

###### Source

[src/models/area.ts:150](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/area.ts#L150)

##### setHolidayMode()

```ts
setHolidayMode(postData: Omit<HolidayModePostData, "HMTimeZones">): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter  | Type                                                                              |
| :--------- | :-------------------------------------------------------------------------------- |
| `postData` | `Omit`\<[`HolidayModePostData`](README.md#holidaymodepostdata), `"HMTimeZones"`\> |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IAreaModel`](README.md#iareamodel).`setHolidayMode`

###### Source

[src/models/area.ts:165](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/area.ts#L165)

##### setPower()

```ts
setPower(postData: Omit<SetPowerPostData, "DeviceIds">): Promise<boolean>
```

###### Parameters

| Parameter  | Type                                                                      |
| :--------- | :------------------------------------------------------------------------ |
| `postData` | `Omit`\<[`SetPowerPostData`](README.md#setpowerpostdata), `"DeviceIds"`\> |

###### Returns

`Promise`\<`boolean`\>

###### Implementation of

[`IAreaModel`](README.md#iareamodel).`setPower`

###### Source

[src/models/area.ts:182](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/area.ts#L182)

##### getAll()

```ts
static getAll(): AreaModel[]
```

###### Returns

[`AreaModel`](README.md#areamodel)[]

###### Source

[src/models/area.ts:74](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/area.ts#L74)

##### getById()

```ts
static getById(id: number): undefined | AreaModel
```

###### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `id`      | `number` |

###### Returns

`undefined` \| [`AreaModel`](README.md#areamodel)

###### Source

[src/models/area.ts:78](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/area.ts#L78)

##### getByName()

```ts
static getByName(areaName: string): undefined | AreaModel
```

###### Parameters

| Parameter  | Type     |
| :--------- | :------- |
| `areaName` | `string` |

###### Returns

`undefined` \| [`AreaModel`](README.md#areamodel)

###### Source

[src/models/area.ts:82](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/area.ts#L82)

##### upsert()

```ts
static upsert(api: default, data: LocationData & {
  FloorId: null | number;
 }): AreaModel
```

###### Parameters

| Parameter | Type                                                                            |
| :-------- | :------------------------------------------------------------------------------ |
| `api`     | [`default`](README.md#default)                                                  |
| `data`    | [`LocationData`](README.md#locationdata) & \{ `FloorId`: `null` \| `number`; \} |

###### Returns

[`AreaModel`](README.md#areamodel)

###### Source

[src/models/area.ts:86](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/area.ts#L86)

---

### BuildingModel

#### Implements

- [`IBuildingModel`](README.md#ibuildingmodel)

#### Constructors

##### new BuildingModel()

```ts
new BuildingModel(api: default, __namedParameters: BuildingData): BuildingModel
```

###### Parameters

| Parameter           | Type                                     |
| :------------------ | :--------------------------------------- |
| `api`               | [`default`](README.md#default)           |
| `__namedParameters` | [`BuildingData`](README.md#buildingdata) |

###### Returns

[`BuildingModel`](README.md#buildingmodel)

###### Source

[src/models/building.ts:28](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/building.ts#L28)

#### Properties

| Property | Modifier   | Type                                             |
| :------- | :--------- | :----------------------------------------------- |
| `data`   | `readonly` | [`BuildingSettings`](README.md#buildingsettings) |
| `id`     | `readonly` | `number`                                         |
| `name`   | `readonly` | `string`                                         |

#### Accessors

##### deviceIds

```ts
get deviceIds(): number[]
```

###### Returns

`number`[]

###### Source

[src/models/building.ts:35](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/building.ts#L35)

##### devices

```ts
get devices(): DeviceModelAny[]
```

###### Returns

[`DeviceModelAny`](README.md#devicemodelany)[]

###### Source

[src/models/building.ts:39](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/building.ts#L39)

#### Methods

##### fetch()

```ts
fetch(): Promise<BuildingSettings>
```

###### Returns

`Promise`\<[`BuildingSettings`](README.md#buildingsettings)\>

###### Implementation of

[`IBuildingModel`](README.md#ibuildingmodel).`fetch`

###### Source

[src/models/building.ts:64](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/building.ts#L64)

##### getErrors()

```ts
getErrors(postData: Omit<ErrorPostData, "DeviceIDs">): Promise<FailureData | ErrorData[]>
```

###### Parameters

| Parameter  | Type                                                                |
| :--------- | :------------------------------------------------------------------ |
| `postData` | `Omit`\<[`ErrorPostData`](README.md#errorpostdata), `"DeviceIDs"`\> |

###### Returns

`Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>

###### Implementation of

[`IBuildingModel`](README.md#ibuildingmodel).`getErrors`

###### Source

[src/models/building.ts:69](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/building.ts#L69)

##### getFrostProtection()

```ts
getFrostProtection(): Promise<FrostProtectionData>
```

###### Returns

`Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>

###### Implementation of

[`IBuildingModel`](README.md#ibuildingmodel).`getFrostProtection`

###### Source

[src/models/building.ts:79](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/building.ts#L79)

##### getHolidayMode()

```ts
getHolidayMode(): Promise<HolidayModeData>
```

###### Returns

`Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>

###### Implementation of

[`IBuildingModel`](README.md#ibuildingmodel).`getHolidayMode`

###### Source

[src/models/building.ts:92](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/building.ts#L92)

##### getTiles()

```ts
getTiles(): Promise<TilesData<null>>
```

###### Returns

`Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\>

###### Implementation of

[`IBuildingModel`](README.md#ibuildingmodel).`getTiles`

###### Source

[src/models/building.ts:105](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/building.ts#L105)

##### setAtaGroup()

```ts
setAtaGroup(postData: Omit<SetAtaGroupPostData, "Specification">): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter  | Type                                                                                |
| :--------- | :---------------------------------------------------------------------------------- |
| `postData` | `Omit`\<[`SetAtaGroupPostData`](README.md#setatagrouppostdata), `"Specification"`\> |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IBuildingModel`](README.md#ibuildingmodel).`setAtaGroup`

###### Source

[src/models/building.ts:113](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/building.ts#L113)

##### setFrostProtection()

```ts
setFrostProtection(postData: Omit<FrostProtectionPostData, "BuildingIds">): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter  | Type                                                                                      |
| :--------- | :---------------------------------------------------------------------------------------- |
| `postData` | `Omit`\<[`FrostProtectionPostData`](README.md#frostprotectionpostdata), `"BuildingIds"`\> |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IBuildingModel`](README.md#ibuildingmodel).`setFrostProtection`

###### Source

[src/models/building.ts:123](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/building.ts#L123)

##### setHolidayMode()

```ts
setHolidayMode(postData: Omit<HolidayModePostData, "HMTimeZones">): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter  | Type                                                                              |
| :--------- | :-------------------------------------------------------------------------------- |
| `postData` | `Omit`\<[`HolidayModePostData`](README.md#holidaymodepostdata), `"HMTimeZones"`\> |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IBuildingModel`](README.md#ibuildingmodel).`setHolidayMode`

###### Source

[src/models/building.ts:138](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/building.ts#L138)

##### setPower()

```ts
setPower(postData: Omit<SetPowerPostData, "DeviceIds">): Promise<boolean>
```

###### Parameters

| Parameter  | Type                                                                      |
| :--------- | :------------------------------------------------------------------------ |
| `postData` | `Omit`\<[`SetPowerPostData`](README.md#setpowerpostdata), `"DeviceIds"`\> |

###### Returns

`Promise`\<`boolean`\>

###### Implementation of

[`IBuildingModel`](README.md#ibuildingmodel).`setPower`

###### Source

[src/models/building.ts:155](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/building.ts#L155)

##### getAll()

```ts
static getAll(): BuildingModel[]
```

###### Returns

[`BuildingModel`](README.md#buildingmodel)[]

###### Source

[src/models/building.ts:45](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/building.ts#L45)

##### getById()

```ts
static getById(id: number): undefined | BuildingModel
```

###### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `id`      | `number` |

###### Returns

`undefined` \| [`BuildingModel`](README.md#buildingmodel)

###### Source

[src/models/building.ts:49](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/building.ts#L49)

##### getByName()

```ts
static getByName(buildingName: string): undefined | BuildingModel
```

###### Parameters

| Parameter      | Type     |
| :------------- | :------- |
| `buildingName` | `string` |

###### Returns

`undefined` \| [`BuildingModel`](README.md#buildingmodel)

###### Source

[src/models/building.ts:53](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/building.ts#L53)

##### upsert()

```ts
static upsert(api: default, data: BuildingData): BuildingModel
```

###### Parameters

| Parameter | Type                                     |
| :-------- | :--------------------------------------- |
| `api`     | [`default`](README.md#default)           |
| `data`    | [`BuildingData`](README.md#buildingdata) |

###### Returns

[`BuildingModel`](README.md#buildingmodel)

###### Source

[src/models/building.ts:57](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/building.ts#L57)

---

### DeviceModel\<T\>

#### Type parameters

| Type parameter                                                    |
| :---------------------------------------------------------------- |
| `T` _extends_ keyof _typeof_ [`DeviceType`](README.md#devicetype) |

#### Implements

- [`IDeviceModel`](README.md#idevicemodelt)\<`T`\>

#### Constructors

##### new DeviceModel()

```ts
new DeviceModel<T>(api: default, __namedParameters: ListDevice[T]): DeviceModel<T>
```

###### Parameters

| Parameter           | Type                                        |
| :------------------ | :------------------------------------------ |
| `api`               | [`default`](README.md#default)              |
| `__namedParameters` | [`ListDevice`](README.md#listdevice)\[`T`\] |

###### Returns

[`DeviceModel`](README.md#devicemodelt)\<`T`\>

###### Source

[src/models/device.ts:54](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L54)

#### Properties

| Property     | Modifier   | Type                                                      | Default value |
| :----------- | :--------- | :-------------------------------------------------------- | :------------ |
| `areaId`     | `readonly` | `null` \| `number`                                        | `null`        |
| `buildingId` | `readonly` | `number`                                                  | `undefined`   |
| `data`       | `readonly` | [`ListDevice`](README.md#listdevice)\[`T`\]\[`"Device"`\] | `undefined`   |
| `floorId`    | `readonly` | `null` \| `number`                                        | `null`        |
| `id`         | `readonly` | `number`                                                  | `undefined`   |
| `name`       | `readonly` | `string`                                                  | `undefined`   |
| `type`       | `readonly` | `T`                                                       | `undefined`   |

#### Accessors

##### area

```ts
get area(): null | AreaModel
```

###### Returns

`null` \| [`AreaModel`](README.md#areamodel)

###### Source

[src/models/device.ts:76](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L76)

##### building

```ts
get building(): null | BuildingModel
```

###### Returns

`null` \| [`BuildingModel`](README.md#buildingmodel)

###### Source

[src/models/device.ts:83](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L83)

##### floor

```ts
get floor(): null | FloorModel
```

###### Returns

`null` \| [`FloorModel`](README.md#floormodel)

###### Source

[src/models/device.ts:87](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L87)

#### Methods

##### fetch()

```ts
fetch(): Promise<ListDevice[T]["Device"]>
```

###### Returns

`Promise`\<[`ListDevice`](README.md#listdevice)\[`T`\]\[`"Device"`\]\>

###### Implementation of

[`IDeviceModel`](README.md#idevicemodelt).`fetch`

###### Source

[src/models/device.ts:119](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L119)

##### get()

```ts
get(): Promise<GetDeviceData[T]>
```

###### Returns

`Promise`\<[`GetDeviceData`](README.md#getdevicedata)\[`T`\]\>

###### Implementation of

[`IDeviceModel`](README.md#idevicemodelt).`get`

###### Source

[src/models/device.ts:124](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L124)

##### getEnergyReport()

```ts
getEnergyReport(postData: Omit<EnergyPostData, "DeviceID">): Promise<EnergyData[T]>
```

###### Parameters

| Parameter  | Type                                                                 |
| :--------- | :------------------------------------------------------------------- |
| `postData` | `Omit`\<[`EnergyPostData`](README.md#energypostdata), `"DeviceID"`\> |

###### Returns

`Promise`\<[`EnergyData`](README.md#energydata)\[`T`\]\>

###### Implementation of

[`IDeviceModel`](README.md#idevicemodelt).`getEnergyReport`

###### Source

[src/models/device.ts:132](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L132)

##### getErrors()

```ts
getErrors(postData: Omit<ErrorPostData, "DeviceIDs">): Promise<FailureData | ErrorData[]>
```

###### Parameters

| Parameter  | Type                                                                |
| :--------- | :------------------------------------------------------------------ |
| `postData` | `Omit`\<[`ErrorPostData`](README.md#errorpostdata), `"DeviceIDs"`\> |

###### Returns

`Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>

###### Implementation of

[`IDeviceModel`](README.md#idevicemodelt).`getErrors`

###### Source

[src/models/device.ts:142](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L142)

##### getFrostProtection()

```ts
getFrostProtection(): Promise<FrostProtectionData>
```

###### Returns

`Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>

###### Implementation of

[`IDeviceModel`](README.md#idevicemodelt).`getFrostProtection`

###### Source

[src/models/device.ts:152](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L152)

##### getHolidayMode()

```ts
getHolidayMode(): Promise<HolidayModeData>
```

###### Returns

`Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>

###### Implementation of

[`IDeviceModel`](README.md#idevicemodelt).`getHolidayMode`

###### Source

[src/models/device.ts:160](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L160)

##### getTile()

###### getTile(select)

```ts
getTile(select?: false): Promise<TilesData<null>>
```

###### Parameters

| Parameter | Type    |
| :-------- | :------ |
| `select`? | `false` |

###### Returns

`Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\>

###### Implementation of

`IDeviceModel.getTile`

###### Source

[src/models/device.ts:168](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L168)

###### getTile(select)

```ts
getTile(select: true): Promise<TilesData<T>>
```

###### Parameters

| Parameter | Type   |
| :-------- | :----- |
| `select`  | `true` |

###### Returns

`Promise`\<[`TilesData`](README.md#tilesdatat)\<`T`\>\>

###### Implementation of

`IDeviceModel.getTile`

###### Source

[src/models/device.ts:169](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L169)

##### set()

```ts
set(postData: Omit<SetDevicePostData[T], "DeviceID">): Promise<SetDeviceData[T]>
```

###### Parameters

| Parameter  | Type                                                                              |
| :--------- | :-------------------------------------------------------------------------------- |
| `postData` | `Omit`\<[`SetDevicePostData`](README.md#setdevicepostdata)\[`T`\], `"DeviceID"`\> |

###### Returns

`Promise`\<[`SetDeviceData`](README.md#setdevicedata)\[`T`\]\>

###### Implementation of

[`IDeviceModel`](README.md#idevicemodelt).`set`

###### Source

[src/models/device.ts:190](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L190)

##### setFrostProtection()

```ts
setFrostProtection(postData: Omit<FrostProtectionPostData, "DeviceIds">): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter  | Type                                                                                    |
| :--------- | :-------------------------------------------------------------------------------------- |
| `postData` | `Omit`\<[`FrostProtectionPostData`](README.md#frostprotectionpostdata), `"DeviceIds"`\> |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IDeviceModel`](README.md#idevicemodelt).`setFrostProtection`

###### Source

[src/models/device.ts:201](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L201)

##### setHolidayMode()

```ts
setHolidayMode(postData: Omit<HolidayModePostData, "HMTimeZones">): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter  | Type                                                                              |
| :--------- | :-------------------------------------------------------------------------------- |
| `postData` | `Omit`\<[`HolidayModePostData`](README.md#holidaymodepostdata), `"HMTimeZones"`\> |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IDeviceModel`](README.md#idevicemodelt).`setHolidayMode`

###### Source

[src/models/device.ts:211](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L211)

##### setPower()

```ts
setPower(postData: Omit<SetPowerPostData, "DeviceIds">): Promise<boolean>
```

###### Parameters

| Parameter  | Type                                                                      |
| :--------- | :------------------------------------------------------------------------ |
| `postData` | `Omit`\<[`SetPowerPostData`](README.md#setpowerpostdata), `"DeviceIds"`\> |

###### Returns

`Promise`\<`boolean`\>

###### Implementation of

[`IDeviceModel`](README.md#idevicemodelt).`setPower`

###### Source

[src/models/device.ts:221](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L221)

##### getAll()

```ts
static getAll(): DeviceModelAny[]
```

###### Returns

[`DeviceModelAny`](README.md#devicemodelany)[]

###### Source

[src/models/device.ts:94](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L94)

##### getById()

```ts
static getById(id: number): undefined | DeviceModelAny
```

###### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `id`      | `number` |

###### Returns

`undefined` \| [`DeviceModelAny`](README.md#devicemodelany)

###### Source

[src/models/device.ts:98](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L98)

##### getByName()

```ts
static getByName(deviceName: string): undefined | DeviceModelAny
```

###### Parameters

| Parameter    | Type     |
| :----------- | :------- |
| `deviceName` | `string` |

###### Returns

`undefined` \| [`DeviceModelAny`](README.md#devicemodelany)

###### Source

[src/models/device.ts:102](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L102)

##### getByType()

```ts
static getByType(deviceType: "Ata" | "Atw" | "Erv"): DeviceModelAny[]
```

###### Parameters

| Parameter    | Type                          |
| :----------- | :---------------------------- |
| `deviceType` | `"Ata"` \| `"Atw"` \| `"Erv"` |

###### Returns

[`DeviceModelAny`](README.md#devicemodelany)[]

###### Source

[src/models/device.ts:106](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L106)

##### upsert()

```ts
static upsert(api: default, data: ListDeviceAny): DeviceModelAny
```

###### Parameters

| Parameter | Type                                       |
| :-------- | :----------------------------------------- |
| `api`     | [`default`](README.md#default)             |
| `data`    | [`ListDeviceAny`](README.md#listdeviceany) |

###### Returns

[`DeviceModelAny`](README.md#devicemodelany)

###### Source

[src/models/device.ts:112](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L112)

---

### FloorModel

#### Implements

- [`IFloorModel`](README.md#ifloormodel)

#### Constructors

##### new FloorModel()

```ts
new FloorModel(api: default, __namedParameters: LocationData): FloorModel
```

###### Parameters

| Parameter           | Type                                     |
| :------------------ | :--------------------------------------- |
| `api`               | [`default`](README.md#default)           |
| `__namedParameters` | [`LocationData`](README.md#locationdata) |

###### Returns

[`FloorModel`](README.md#floormodel)

###### Source

[src/models/floor.ts:33](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/floor.ts#L33)

#### Properties

| Property     | Modifier   | Type     |
| :----------- | :--------- | :------- |
| `buildingId` | `readonly` | `number` |
| `id`         | `readonly` | `number` |
| `name`       | `readonly` | `string` |

#### Accessors

##### areaIds

```ts
get areaIds(): number[]
```

###### Returns

`number`[]

###### Source

[src/models/floor.ts:43](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/floor.ts#L43)

##### areas

```ts
get areas(): AreaModel[]
```

###### Returns

[`AreaModel`](README.md#areamodel)[]

###### Source

[src/models/floor.ts:47](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/floor.ts#L47)

##### building

```ts
get building(): null | BuildingModel
```

###### Returns

`null` \| [`BuildingModel`](README.md#buildingmodel)

###### Source

[src/models/floor.ts:53](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/floor.ts#L53)

##### deviceIds

```ts
get deviceIds(): number[]
```

###### Returns

`number`[]

###### Source

[src/models/floor.ts:57](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/floor.ts#L57)

##### devices

```ts
get devices(): DeviceModelAny[]
```

###### Returns

[`DeviceModelAny`](README.md#devicemodelany)[]

###### Source

[src/models/floor.ts:61](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/floor.ts#L61)

#### Methods

##### getErrors()

```ts
getErrors(postData: Omit<ErrorPostData, "DeviceIDs">): Promise<FailureData | ErrorData[]>
```

###### Parameters

| Parameter  | Type                                                                |
| :--------- | :------------------------------------------------------------------ |
| `postData` | `Omit`\<[`ErrorPostData`](README.md#errorpostdata), `"DeviceIDs"`\> |

###### Returns

`Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>

###### Implementation of

[`IFloorModel`](README.md#ifloormodel).`getErrors`

###### Source

[src/models/floor.ts:86](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/floor.ts#L86)

##### getFrostProtection()

```ts
getFrostProtection(): Promise<FrostProtectionData>
```

###### Returns

`Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>

###### Implementation of

[`IFloorModel`](README.md#ifloormodel).`getFrostProtection`

###### Source

[src/models/floor.ts:96](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/floor.ts#L96)

##### getHolidayMode()

```ts
getHolidayMode(): Promise<HolidayModeData>
```

###### Returns

`Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>

###### Implementation of

[`IFloorModel`](README.md#ifloormodel).`getHolidayMode`

###### Source

[src/models/floor.ts:109](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/floor.ts#L109)

##### getTiles()

```ts
getTiles(): Promise<TilesData<null>>
```

###### Returns

`Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\>

###### Implementation of

[`IFloorModel`](README.md#ifloormodel).`getTiles`

###### Source

[src/models/floor.ts:122](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/floor.ts#L122)

##### setAtaGroup()

```ts
setAtaGroup(postData: Omit<SetAtaGroupPostData, "Specification">): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter  | Type                                                                                |
| :--------- | :---------------------------------------------------------------------------------- |
| `postData` | `Omit`\<[`SetAtaGroupPostData`](README.md#setatagrouppostdata), `"Specification"`\> |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IFloorModel`](README.md#ifloormodel).`setAtaGroup`

###### Source

[src/models/floor.ts:130](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/floor.ts#L130)

##### setFrostProtection()

```ts
setFrostProtection(postData: Omit<FrostProtectionPostData, "BuildingIds">): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter  | Type                                                                                      |
| :--------- | :---------------------------------------------------------------------------------------- |
| `postData` | `Omit`\<[`FrostProtectionPostData`](README.md#frostprotectionpostdata), `"BuildingIds"`\> |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IFloorModel`](README.md#ifloormodel).`setFrostProtection`

###### Source

[src/models/floor.ts:140](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/floor.ts#L140)

##### setHolidayMode()

```ts
setHolidayMode(postData: Omit<HolidayModePostData, "HMTimeZones">): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter  | Type                                                                              |
| :--------- | :-------------------------------------------------------------------------------- |
| `postData` | `Omit`\<[`HolidayModePostData`](README.md#holidaymodepostdata), `"HMTimeZones"`\> |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IFloorModel`](README.md#ifloormodel).`setHolidayMode`

###### Source

[src/models/floor.ts:155](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/floor.ts#L155)

##### setPower()

```ts
setPower(postData: Omit<SetPowerPostData, "DeviceIds">): Promise<boolean>
```

###### Parameters

| Parameter  | Type                                                                      |
| :--------- | :------------------------------------------------------------------------ |
| `postData` | `Omit`\<[`SetPowerPostData`](README.md#setpowerpostdata), `"DeviceIds"`\> |

###### Returns

`Promise`\<`boolean`\>

###### Implementation of

[`IFloorModel`](README.md#ifloormodel).`setPower`

###### Source

[src/models/floor.ts:172](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/floor.ts#L172)

##### getAll()

```ts
static getAll(): FloorModel[]
```

###### Returns

[`FloorModel`](README.md#floormodel)[]

###### Source

[src/models/floor.ts:67](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/floor.ts#L67)

##### getById()

```ts
static getById(id: number): undefined | FloorModel
```

###### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `id`      | `number` |

###### Returns

`undefined` \| [`FloorModel`](README.md#floormodel)

###### Source

[src/models/floor.ts:71](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/floor.ts#L71)

##### getByName()

```ts
static getByName(floorName: string): undefined | FloorModel
```

###### Parameters

| Parameter   | Type     |
| :---------- | :------- |
| `floorName` | `string` |

###### Returns

`undefined` \| [`FloorModel`](README.md#floormodel)

###### Source

[src/models/floor.ts:75](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/floor.ts#L75)

##### upsert()

```ts
static upsert(api: default, data: LocationData): FloorModel
```

###### Parameters

| Parameter | Type                                     |
| :-------- | :--------------------------------------- |
| `api`     | [`default`](README.md#default)           |
| `data`    | [`LocationData`](README.md#locationdata) |

###### Returns

[`FloorModel`](README.md#floormodel)

###### Source

[src/models/floor.ts:79](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/floor.ts#L79)

---

### default

#### Implements

- [`IMELCloudAPI`](README.md#imelcloudapi)

#### Constructors

##### new default()

```ts
new default(config: {
  language: string;
  logger: Logger;
  settingManager: SettingManager;
  shouldVerifySSL: boolean;
  timezone: string;
 }): default
```

###### Parameters

| Parameter                 | Type                                         |
| :------------------------ | :------------------------------------------- |
| `config`                  | `object`                                     |
| `config.language`?        | `string`                                     |
| `config.logger`?          | [`Logger`](README.md#logger)                 |
| `config.settingManager`?  | [`SettingManager`](README.md#settingmanager) |
| `config.shouldVerifySSL`? | `boolean`                                    |
| `config.timezone`?        | `string`                                     |

###### Returns

[`default`](README.md#default)

###### Source

[src/services/api.ts:87](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/services/api.ts#L87)

#### Properties

| Property    | Modifier   | Type                                                            | Default value |
| :---------- | :--------- | :-------------------------------------------------------------- | :------------ |
| `language`  | `public`   | [`Language`](README.md#language)                                | `undefined`   |
| `areas`     | `readonly` | `Map`\<`number`, [`AreaModel`](README.md#areamodel)\>           | `...`         |
| `buildings` | `readonly` | `Map`\<`number`, [`BuildingModel`](README.md#buildingmodel)\>   | `...`         |
| `devices`   | `readonly` | `Map`\<`number`, [`DeviceModelAny`](README.md#devicemodelany)\> | `...`         |
| `floors`    | `readonly` | `Map`\<`number`, [`FloorModel`](README.md#floormodel)\>         | `...`         |

#### Methods

##### applyLogin()

```ts
applyLogin(data?: LoginCredentials, onSuccess?: () => Promise<void>): Promise<boolean>
```

###### Parameters

| Parameter    | Type                                             |
| :----------- | :----------------------------------------------- |
| `data`?      | [`LoginCredentials`](README.md#logincredentials) |
| `onSuccess`? | () => `Promise`\<`void`\>                        |

###### Returns

`Promise`\<`boolean`\>

###### Implementation of

[`IMELCloudAPI`](README.md#imelcloudapi).`applyLogin`

###### Source

[src/services/api.ts:155](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/services/api.ts#L155)

##### fetchDevices()

```ts
fetchDevices(): Promise<{
  data: Building[];
}>
```

###### Returns

`Promise`\<\{
`data`: [`Building`](README.md#building-3)[];
\}\>

| Member | Type                                 |
| :----- | :----------------------------------- |
| `data` | [`Building`](README.md#building-3)[] |

###### Implementation of

[`IMELCloudAPI`](README.md#imelcloudapi).`fetchDevices`

###### Source

[src/services/api.ts:186](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/services/api.ts#L186)

##### getDevice()

```ts
getDevice<T>(__namedParameters: {
  params: GetDeviceDataParams;
 }): Promise<{
  data: GetDeviceData[T];
}>
```

###### Type parameters

| Type parameter                              |
| :------------------------------------------ |
| `T` _extends_ `"Ata"` \| `"Atw"` \| `"Erv"` |

###### Parameters

| Parameter                  | Type                                                   |
| :------------------------- | :----------------------------------------------------- |
| `__namedParameters`        | `object`                                               |
| `__namedParameters.params` | [`GetDeviceDataParams`](README.md#getdevicedataparams) |

###### Returns

`Promise`\<\{
`data`: [`GetDeviceData`](README.md#getdevicedata)\[`T`\];
\}\>

| Member | Type                                              |
| :----- | :------------------------------------------------ |
| `data` | [`GetDeviceData`](README.md#getdevicedata)\[`T`\] |

###### Implementation of

[`IMELCloudAPI`](README.md#imelcloudapi).`getDevice`

###### Source

[src/services/api.ts:210](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/services/api.ts#L210)

##### getEnergyReport()

```ts
getEnergyReport<T>(__namedParameters: {
  postData: EnergyPostData;
 }): Promise<{
  data: EnergyData[T];
}>
```

###### Type parameters

| Type parameter                              |
| :------------------------------------------ |
| `T` _extends_ `"Ata"` \| `"Atw"` \| `"Erv"` |

###### Parameters

| Parameter                    | Type                                         |
| :--------------------------- | :------------------------------------------- |
| `__namedParameters`          | `object`                                     |
| `__namedParameters.postData` | [`EnergyPostData`](README.md#energypostdata) |

###### Returns

`Promise`\<\{
`data`: [`EnergyData`](README.md#energydata)\[`T`\];
\}\>

| Member | Type                                        |
| :----- | :------------------------------------------ |
| `data` | [`EnergyData`](README.md#energydata)\[`T`\] |

###### Implementation of

[`IMELCloudAPI`](README.md#imelcloudapi).`getEnergyReport`

###### Source

[src/services/api.ts:220](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/services/api.ts#L220)

##### getErrors()

```ts
getErrors(__namedParameters: {
  postData: ErrorPostData;
 }): Promise<{
  data: FailureData | ErrorData[];
}>
```

###### Parameters

| Parameter                    | Type                                       |
| :--------------------------- | :----------------------------------------- |
| `__namedParameters`          | `object`                                   |
| `__namedParameters.postData` | [`ErrorPostData`](README.md#errorpostdata) |

###### Returns

`Promise`\<\{
`data`: [`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[];
\}\>

| Member | Type                                                                           |
| :----- | :----------------------------------------------------------------------------- |
| `data` | [`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[] |

###### Implementation of

[`IMELCloudAPI`](README.md#imelcloudapi).`getErrors`

###### Source

[src/services/api.ts:231](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/services/api.ts#L231)

##### getFrostProtection()

```ts
getFrostProtection(__namedParameters: {
  params: SettingsParams;
 }): Promise<{
  data: FrostProtectionData;
}>
```

###### Parameters

| Parameter                  | Type                                         |
| :------------------------- | :------------------------------------------- |
| `__namedParameters`        | `object`                                     |
| `__namedParameters.params` | [`SettingsParams`](README.md#settingsparams) |

###### Returns

`Promise`\<\{
`data`: [`FrostProtectionData`](README.md#frostprotectiondata);
\}\>

| Member | Type                                                   |
| :----- | :----------------------------------------------------- |
| `data` | [`FrostProtectionData`](README.md#frostprotectiondata) |

###### Implementation of

[`IMELCloudAPI`](README.md#imelcloudapi).`getFrostProtection`

###### Source

[src/services/api.ts:242](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/services/api.ts#L242)

##### getHolidayMode()

```ts
getHolidayMode(__namedParameters: {
  params: SettingsParams;
 }): Promise<{
  data: HolidayModeData;
}>
```

###### Parameters

| Parameter                  | Type                                         |
| :------------------------- | :------------------------------------------- |
| `__namedParameters`        | `object`                                     |
| `__namedParameters.params` | [`SettingsParams`](README.md#settingsparams) |

###### Returns

`Promise`\<\{
`data`: [`HolidayModeData`](README.md#holidaymodedata);
\}\>

| Member | Type                                           |
| :----- | :--------------------------------------------- |
| `data` | [`HolidayModeData`](README.md#holidaymodedata) |

###### Implementation of

[`IMELCloudAPI`](README.md#imelcloudapi).`getHolidayMode`

###### Source

[src/services/api.ts:252](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/services/api.ts#L252)

##### getTiles()

###### getTiles(\_\_namedParameters)

```ts
getTiles(__namedParameters: {
  postData: TilesPostData<null>;
 }): Promise<{
  data: TilesData<null>;
}>
```

###### Parameters

| Parameter                    | Type                                                  |
| :--------------------------- | :---------------------------------------------------- |
| `__namedParameters`          | `object`                                              |
| `__namedParameters.postData` | [`TilesPostData`](README.md#tilespostdatat)\<`null`\> |

###### Returns

`Promise`\<\{
`data`: [`TilesData`](README.md#tilesdatat)\<`null`\>;
\}\>

| Member | Type                                          |
| :----- | :-------------------------------------------- |
| `data` | [`TilesData`](README.md#tilesdatat)\<`null`\> |

###### Implementation of

`IMELCloudAPI.getTiles`

###### Source

[src/services/api.ts:262](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/services/api.ts#L262)

###### getTiles(\_\_namedParameters)

```ts
getTiles<T>(__namedParameters: {
  postData: TilesPostData<T>;
 }): Promise<{
  data: TilesData<T>;
}>
```

###### Type parameters

| Type parameter                              |
| :------------------------------------------ |
| `T` _extends_ `"Ata"` \| `"Atw"` \| `"Erv"` |

###### Parameters

| Parameter                    | Type                                               |
| :--------------------------- | :------------------------------------------------- |
| `__namedParameters`          | `object`                                           |
| `__namedParameters.postData` | [`TilesPostData`](README.md#tilespostdatat)\<`T`\> |

###### Returns

`Promise`\<\{
`data`: [`TilesData`](README.md#tilesdatat)\<`T`\>;
\}\>

| Member | Type                                       |
| :----- | :----------------------------------------- |
| `data` | [`TilesData`](README.md#tilesdatat)\<`T`\> |

###### Implementation of

`IMELCloudAPI.getTiles`

###### Source

[src/services/api.ts:267](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/services/api.ts#L267)

##### login()

```ts
login(__namedParameters: {
  postData: LoginPostData;
 }): Promise<{
  data: LoginData;
}>
```

###### Parameters

| Parameter                    | Type                                       |
| :--------------------------- | :----------------------------------------- |
| `__namedParameters`          | `object`                                   |
| `__namedParameters.postData` | [`LoginPostData`](README.md#loginpostdata) |

###### Returns

`Promise`\<\{
`data`: [`LoginData`](README.md#logindata);
\}\>

| Member | Type                               |
| :----- | :--------------------------------- |
| `data` | [`LoginData`](README.md#logindata) |

###### Implementation of

[`IMELCloudAPI`](README.md#imelcloudapi).`login`

###### Source

[src/services/api.ts:283](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/services/api.ts#L283)

##### setAtaGroup()

```ts
setAtaGroup(__namedParameters: {
  postData: SetAtaGroupPostData;
 }): Promise<{
  data: SuccessData | FailureData;
}>
```

###### Parameters

| Parameter                    | Type                                                   |
| :--------------------------- | :----------------------------------------------------- |
| `__namedParameters`          | `object`                                               |
| `__namedParameters.postData` | [`SetAtaGroupPostData`](README.md#setatagrouppostdata) |

###### Returns

`Promise`\<\{
`data`: [`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata);
\}\>

| Member | Type                                                                             |
| :----- | :------------------------------------------------------------------------------- |
| `data` | [`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata) |

###### Implementation of

[`IMELCloudAPI`](README.md#imelcloudapi).`setAtaGroup`

###### Source

[src/services/api.ts:302](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/services/api.ts#L302)

##### setDevice()

```ts
setDevice<T>(__namedParameters: {
  heatPumpType: T;
  postData: SetDevicePostData[T];
 }): Promise<{
  data: SetDeviceData[T];
}>
```

###### Type parameters

| Type parameter                              |
| :------------------------------------------ |
| `T` _extends_ `"Ata"` \| `"Atw"` \| `"Erv"` |

###### Parameters

| Parameter                        | Type                                                      |
| :------------------------------- | :-------------------------------------------------------- |
| `__namedParameters`              | `object`                                                  |
| `__namedParameters.heatPumpType` | `T`                                                       |
| `__namedParameters.postData`     | [`SetDevicePostData`](README.md#setdevicepostdata)\[`T`\] |

###### Returns

`Promise`\<\{
`data`: [`SetDeviceData`](README.md#setdevicedata)\[`T`\];
\}\>

| Member | Type                                              |
| :----- | :------------------------------------------------ |
| `data` | [`SetDeviceData`](README.md#setdevicedata)\[`T`\] |

###### Implementation of

[`IMELCloudAPI`](README.md#imelcloudapi).`setDevice`

###### Source

[src/services/api.ts:317](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/services/api.ts#L317)

##### setFrostProtection()

```ts
setFrostProtection(__namedParameters: {
  postData: FrostProtectionPostData;
 }): Promise<{
  data: SuccessData | FailureData;
}>
```

###### Parameters

| Parameter                    | Type                                                           |
| :--------------------------- | :------------------------------------------------------------- |
| `__namedParameters`          | `object`                                                       |
| `__namedParameters.postData` | [`FrostProtectionPostData`](README.md#frostprotectionpostdata) |

###### Returns

`Promise`\<\{
`data`: [`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata);
\}\>

| Member | Type                                                                             |
| :----- | :------------------------------------------------------------------------------- |
| `data` | [`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata) |

###### Implementation of

[`IMELCloudAPI`](README.md#imelcloudapi).`setFrostProtection`

###### Source

[src/services/api.ts:330](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/services/api.ts#L330)

##### setHolidayMode()

```ts
setHolidayMode(__namedParameters: {
  postData: HolidayModePostData;
 }): Promise<{
  data: SuccessData | FailureData;
}>
```

###### Parameters

| Parameter                    | Type                                                   |
| :--------------------------- | :----------------------------------------------------- |
| `__namedParameters`          | `object`                                               |
| `__namedParameters.postData` | [`HolidayModePostData`](README.md#holidaymodepostdata) |

###### Returns

`Promise`\<\{
`data`: [`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata);
\}\>

| Member | Type                                                                             |
| :----- | :------------------------------------------------------------------------------- |
| `data` | [`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata) |

###### Implementation of

[`IMELCloudAPI`](README.md#imelcloudapi).`setHolidayMode`

###### Source

[src/services/api.ts:341](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/services/api.ts#L341)

##### setLanguage()

```ts
setLanguage(__namedParameters: {
  postData: {
     language: Language;
    };
 }): Promise<{
  data: boolean;
}>
```

###### Parameters

| Parameter                             | Type                             |
| :------------------------------------ | :------------------------------- |
| `__namedParameters`                   | `object`                         |
| `__namedParameters.postData`          | `object`                         |
| `__namedParameters.postData.language` | [`Language`](README.md#language) |

###### Returns

`Promise`\<\{
`data`: `boolean`;
\}\>

| Member | Type      |
| :----- | :-------- |
| `data` | `boolean` |

###### Implementation of

[`IMELCloudAPI`](README.md#imelcloudapi).`setLanguage`

###### Source

[src/services/api.ts:352](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/services/api.ts#L352)

##### setPower()

```ts
setPower(__namedParameters: {
  postData: SetPowerPostData;
 }): Promise<{
  data: boolean;
}>
```

###### Parameters

| Parameter                    | Type                                             |
| :--------------------------- | :----------------------------------------------- |
| `__namedParameters`          | `object`                                         |
| `__namedParameters.postData` | [`SetPowerPostData`](README.md#setpowerpostdata) |

###### Returns

`Promise`\<\{
`data`: `boolean`;
\}\>

| Member | Type      |
| :----- | :-------- |
| `data` | `boolean` |

###### Implementation of

[`IMELCloudAPI`](README.md#imelcloudapi).`setPower`

###### Source

[src/services/api.ts:366](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/services/api.ts#L366)

## Interfaces

### APISettings

#### Properties

| Property      | Modifier   | Type               |
| :------------ | :--------- | :----------------- |
| `contextKey?` | `readonly` | `null` \| `string` |
| `expiry?`     | `readonly` | `null` \| `string` |
| `password?`   | `readonly` | `null` \| `string` |
| `username?`   | `readonly` | `null` \| `string` |

---

### BaseDevicePostData

#### Extended by

- [`EnergyPostData`](README.md#energypostdata)
- [`SetDevicePostDataAta`](README.md#setdevicepostdataata)
- [`SetDevicePostDataAtw`](README.md#setdevicepostdataatw)
- [`SetDevicePostDataErv`](README.md#setdevicepostdataerv)

#### Properties

| Property   | Modifier   | Type     |
| :--------- | :--------- | :------- |
| `DeviceID` | `readonly` | `number` |

---

### BaseGetDeviceData

#### Extends

- [`BaseSetDeviceData`](README.md#basesetdevicedata)

#### Properties

| Property            | Modifier   | Type      | Overrides                                                              | Inherited from                                                         |
| :------------------ | :--------- | :-------- | :--------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| `EffectiveFlags`    | `readonly` | `0`       | [`BaseSetDeviceData`](README.md#basesetdevicedata).`EffectiveFlags`    | [`BaseSetDeviceData`](README.md#basesetdevicedata).`EffectiveFlags`    |
| `LastCommunication` | `readonly` | `string`  | [`BaseSetDeviceData`](README.md#basesetdevicedata).`LastCommunication` | [`BaseSetDeviceData`](README.md#basesetdevicedata).`LastCommunication` |
| `NextCommunication` | `readonly` | `string`  | [`BaseSetDeviceData`](README.md#basesetdevicedata).`NextCommunication` | [`BaseSetDeviceData`](README.md#basesetdevicedata).`NextCommunication` |
| `Offline`           | `readonly` | `boolean` | [`BaseSetDeviceData`](README.md#basesetdevicedata).`Offline`           | [`BaseSetDeviceData`](README.md#basesetdevicedata).`Offline`           |
| `Power`             | `readonly` | `boolean` | [`BaseSetDeviceData`](README.md#basesetdevicedata).`Power`             | [`BaseSetDeviceData`](README.md#basesetdevicedata).`Power`             |

---

### BaseListDevice

#### Extended by

- [`ListDeviceAta`](README.md#listdeviceata)
- [`ListDeviceAtw`](README.md#listdeviceatw)
- [`ListDeviceErv`](README.md#listdeviceerv)

#### Properties

| Property     | Modifier   | Type                                 |
| :----------- | :--------- | :----------------------------------- |
| `AreaID`     | `readonly` | `null` \| `number`                   |
| `BuildingID` | `readonly` | `number`                             |
| `DeviceID`   | `readonly` | `number`                             |
| `DeviceName` | `readonly` | `string`                             |
| `FloorID`    | `readonly` | `null` \| `number`                   |
| `Type`       | `readonly` | [`DeviceType`](README.md#devicetype) |

---

### BaseListDeviceData

#### Extends

- `Omit`\<[`BaseGetDeviceData`](README.md#basegetdevicedata), keyof [`DeviceDataNotInList`](README.md#devicedatanotinlist)\>

#### Extended by

- [`ListDeviceDataAta`](README.md#listdevicedataata)
- [`ListDeviceDataAtw`](README.md#listdevicedataatw)
- [`ListDeviceDataErv`](README.md#listdevicedataerv)

#### Properties

| Property             | Modifier   | Type      | Inherited from        |
| :------------------- | :--------- | :-------- | :-------------------- |
| `EffectiveFlags`     | `readonly` | `0`       | `Omit.EffectiveFlags` |
| `Offline`            | `readonly` | `boolean` | `Omit.Offline`        |
| `Power`              | `readonly` | `boolean` | `Omit.Power`          |
| `WifiSignalStrength` | `readonly` | `number`  | -                     |

---

### BaseSetDeviceData

#### Extends

- `Required`\<`Readonly`\<[`BaseUpdateDeviceData`](README.md#baseupdatedevicedata)\>\>.[`DeviceDataNotInList`](README.md#devicedatanotinlist)

#### Extended by

- [`BaseGetDeviceData`](README.md#basegetdevicedata)
- [`SetDeviceDataAta`](README.md#setdevicedataata)
- [`SetDeviceDataAtw`](README.md#setdevicedataatw)
- [`SetDeviceDataErv`](README.md#setdevicedataerv)

#### Properties

| Property            | Modifier   | Type      | Inherited from                                                             |
| :------------------ | :--------- | :-------- | :------------------------------------------------------------------------- |
| `EffectiveFlags`    | `readonly` | `number`  | `Required.EffectiveFlags`                                                  |
| `LastCommunication` | `readonly` | `string`  | [`DeviceDataNotInList`](README.md#devicedatanotinlist).`LastCommunication` |
| `NextCommunication` | `readonly` | `string`  | [`DeviceDataNotInList`](README.md#devicedatanotinlist).`NextCommunication` |
| `Offline`           | `readonly` | `boolean` | -                                                                          |
| `Power`             | `readonly` | `boolean` | `Required.Power`                                                           |

---

### BaseUpdateDeviceData

#### Extended by

- [`UpdateDeviceDataAta`](README.md#updatedevicedataata)
- [`UpdateDeviceDataAtw`](README.md#updatedevicedataatw)
- [`UpdateDeviceDataErv`](README.md#updatedevicedataerv)

#### Properties

| Property         | Modifier   | Type      |
| :--------------- | :--------- | :-------- |
| `EffectiveFlags` | `public`   | `number`  |
| `Power?`         | `readonly` | `boolean` |

---

### Building

#### Extends

- [`BuildingData`](README.md#buildingdata)

#### Properties

| Property            | Modifier   | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Inherited from                                              |
| :------------------ | :--------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| `FPDefined`         | `readonly` | `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | [`BuildingData`](README.md#buildingdata).`FPDefined`        |
| `FPEnabled`         | `readonly` | `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | [`BuildingData`](README.md#buildingdata).`FPEnabled`        |
| `FPMaxTemperature`  | `readonly` | `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | [`BuildingData`](README.md#buildingdata).`FPMaxTemperature` |
| `FPMinTemperature`  | `readonly` | `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | [`BuildingData`](README.md#buildingdata).`FPMinTemperature` |
| `HMDefined`         | `readonly` | `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | [`BuildingData`](README.md#buildingdata).`HMDefined`        |
| `HMEnabled`         | `readonly` | `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | [`BuildingData`](README.md#buildingdata).`HMEnabled`        |
| `HMEndDate`         | `readonly` | `null` \| `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | [`BuildingData`](README.md#buildingdata).`HMEndDate`        |
| `HMStartDate`       | `readonly` | `null` \| `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | [`BuildingData`](README.md#buildingdata).`HMStartDate`      |
| `ID`                | `readonly` | `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | [`BuildingData`](README.md#buildingdata).`ID`               |
| `Name`              | `readonly` | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | [`BuildingData`](README.md#buildingdata).`Name`             |
| `Structure`         | `readonly` | \{ `Areas`: readonly [`LocationData`](README.md#locationdata) & \{ `Devices`: readonly [`ListDeviceAny`](README.md#listdeviceany)[]; `FloorId`: `null`; \}[]; `Devices`: readonly [`ListDeviceAny`](README.md#listdeviceany)[]; `Floors`: readonly [`LocationData`](README.md#locationdata) & \{ `Areas`: readonly [`LocationData`](README.md#locationdata) & \{ `Devices`: readonly [`ListDeviceAny`](README.md#listdeviceany)[]; `FloorId`: `number`; \}[]; `Devices`: readonly [`ListDeviceAny`](README.md#listdeviceany)[]; \}[]; \} | -                                                           |
| `Structure.Areas`   | `readonly` | readonly [`LocationData`](README.md#locationdata) & \{ `Devices`: readonly [`ListDeviceAny`](README.md#listdeviceany)[]; `FloorId`: `null`; \}[]                                                                                                                                                                                                                                                                                                                                                                                         | -                                                           |
| `Structure.Devices` | `public`   | readonly [`ListDeviceAny`](README.md#listdeviceany)[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | -                                                           |
| `Structure.Floors`  | `public`   | readonly [`LocationData`](README.md#locationdata) & \{ `Areas`: readonly [`LocationData`](README.md#locationdata) & \{ `Devices`: readonly [`ListDeviceAny`](README.md#listdeviceany)[]; `FloorId`: `number`; \}[]; `Devices`: readonly [`ListDeviceAny`](README.md#listdeviceany)[]; \}[]                                                                                                                                                                                                                                               | -                                                           |
| `TimeZone`          | `public`   | `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | [`BuildingData`](README.md#buildingdata).`TimeZone`         |

---

### BuildingData

#### Extends

- [`BuildingSettings`](README.md#buildingsettings)

#### Extended by

- [`Building`](README.md#building-3)

#### Properties

| Property           | Modifier   | Type               | Inherited from                                                      |
| :----------------- | :--------- | :----------------- | :------------------------------------------------------------------ |
| `FPDefined`        | `readonly` | `boolean`          | [`BuildingSettings`](README.md#buildingsettings).`FPDefined`        |
| `FPEnabled`        | `readonly` | `boolean`          | [`BuildingSettings`](README.md#buildingsettings).`FPEnabled`        |
| `FPMaxTemperature` | `readonly` | `number`           | [`BuildingSettings`](README.md#buildingsettings).`FPMaxTemperature` |
| `FPMinTemperature` | `readonly` | `number`           | [`BuildingSettings`](README.md#buildingsettings).`FPMinTemperature` |
| `HMDefined`        | `readonly` | `boolean`          | [`BuildingSettings`](README.md#buildingsettings).`HMDefined`        |
| `HMEnabled`        | `readonly` | `boolean`          | [`BuildingSettings`](README.md#buildingsettings).`HMEnabled`        |
| `HMEndDate`        | `readonly` | `null` \| `string` | [`BuildingSettings`](README.md#buildingsettings).`HMEndDate`        |
| `HMStartDate`      | `readonly` | `null` \| `string` | [`BuildingSettings`](README.md#buildingsettings).`HMStartDate`      |
| `ID`               | `readonly` | `number`           | -                                                                   |
| `Name`             | `readonly` | `string`           | -                                                                   |
| `TimeZone`         | `readonly` | `number`           | [`BuildingSettings`](README.md#buildingsettings).`TimeZone`         |

---

### BuildingSettings

#### Extends

- [`FrostProtectionData`](README.md#frostprotectiondata).`Omit`\<[`HolidayModeData`](README.md#holidaymodedata), `"EndDate"` \| `"StartDate"`\>

#### Extended by

- [`BuildingData`](README.md#buildingdata)

#### Properties

| Property           | Modifier   | Type               | Inherited from                                                            |
| :----------------- | :--------- | :----------------- | :------------------------------------------------------------------------ |
| `FPDefined`        | `readonly` | `boolean`          | [`FrostProtectionData`](README.md#frostprotectiondata).`FPDefined`        |
| `FPEnabled`        | `readonly` | `boolean`          | [`FrostProtectionData`](README.md#frostprotectiondata).`FPEnabled`        |
| `FPMaxTemperature` | `readonly` | `number`           | [`FrostProtectionData`](README.md#frostprotectiondata).`FPMaxTemperature` |
| `FPMinTemperature` | `readonly` | `number`           | [`FrostProtectionData`](README.md#frostprotectiondata).`FPMinTemperature` |
| `HMDefined`        | `readonly` | `boolean`          | `Omit.HMDefined`                                                          |
| `HMEnabled`        | `readonly` | `boolean`          | `Omit.HMEnabled`                                                          |
| `HMEndDate`        | `readonly` | `null` \| `string` | `Omit.HMEndDate`                                                          |
| `HMStartDate`      | `readonly` | `null` \| `string` | `Omit.HMStartDate`                                                        |
| `TimeZone`         | `readonly` | `number`           | `Omit.TimeZone`                                                           |

---

### DeviceDataNotInList

#### Extended by

- [`BaseSetDeviceData`](README.md#basesetdevicedata)

#### Properties

| Property            | Modifier   | Type     |
| :------------------ | :--------- | :------- |
| `LastCommunication` | `readonly` | `string` |
| `NextCommunication` | `readonly` | `string` |

---

### EffectiveFlags

#### Properties

| Property | Modifier   | Type                                                                                                                                          |
| :------- | :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| `Ata`    | `readonly` | `Record`\<[`NonEffectiveFlagsKeyOf`](README.md#noneffectiveflagskeyoft)\<[`UpdateDeviceDataAta`](README.md#updatedevicedataata)\>, `number`\> |
| `Atw`    | `readonly` | `Record`\<[`NonEffectiveFlagsKeyOf`](README.md#noneffectiveflagskeyoft)\<[`UpdateDeviceDataAtw`](README.md#updatedevicedataatw)\>, `number`\> |
| `Erv`    | `readonly` | `Record`\<[`NonEffectiveFlagsKeyOf`](README.md#noneffectiveflagskeyoft)\<[`UpdateDeviceDataErv`](README.md#updatedevicedataerv)\>, `number`\> |

---

### EnergyData

#### Properties

| Property | Modifier   | Type                                       |
| :------- | :--------- | :----------------------------------------- |
| `Ata`    | `readonly` | [`EnergyDataAta`](README.md#energydataata) |
| `Atw`    | `readonly` | [`EnergyDataAtw`](README.md#energydataatw) |
| `Erv`    | `readonly` | `never`                                    |

---

### EnergyDataAta

#### Properties

| Property                     | Modifier   | Type                |
| :--------------------------- | :--------- | :------------------ |
| `Auto`                       | `readonly` | readonly `number`[] |
| `Cooling`                    | `readonly` | readonly `number`[] |
| `Dry`                        | `readonly` | readonly `number`[] |
| `Fan`                        | `readonly` | readonly `number`[] |
| `Heating`                    | `readonly` | readonly `number`[] |
| `Other`                      | `readonly` | readonly `number`[] |
| `TotalAutoConsumed`          | `readonly` | `number`            |
| `TotalCoolingConsumed`       | `readonly` | `number`            |
| `TotalDryConsumed`           | `readonly` | `number`            |
| `TotalFanConsumed`           | `readonly` | `number`            |
| `TotalHeatingConsumed`       | `readonly` | `number`            |
| `TotalOtherConsumed`         | `readonly` | `number`            |
| `UsageDisclaimerPercentages` | `readonly` | `string`            |

---

### EnergyDataAtw

#### Properties

| Property                | Modifier   | Type                |
| :---------------------- | :--------- | :------------------ |
| `CoP`                   | `readonly` | readonly `number`[] |
| `TotalCoolingConsumed`  | `readonly` | `number`            |
| `TotalCoolingProduced`  | `readonly` | `number`            |
| `TotalHeatingConsumed`  | `readonly` | `number`            |
| `TotalHeatingProduced`  | `readonly` | `number`            |
| `TotalHotWaterConsumed` | `readonly` | `number`            |
| `TotalHotWaterProduced` | `readonly` | `number`            |

---

### EnergyPostData

#### Extends

- [`BaseDevicePostData`](README.md#basedevicepostdata)

#### Properties

| Property   | Modifier   | Type     | Inherited from                                                  |
| :--------- | :--------- | :------- | :-------------------------------------------------------------- |
| `DeviceID` | `readonly` | `number` | [`BaseDevicePostData`](README.md#basedevicepostdata).`DeviceID` |
| `FromDate` | `readonly` | `string` | -                                                               |
| `ToDate`   | `readonly` | `string` | -                                                               |

---

### ErrorData

#### Properties

| Property       | Modifier   | Type               |
| :------------- | :--------- | :----------------- |
| `DeviceId`     | `readonly` | `number`           |
| `EndDate`      | `readonly` | `string`           |
| `ErrorMessage` | `readonly` | `null` \| `string` |
| `StartDate`    | `readonly` | `string`           |

---

### ErrorPostData

#### Properties

| Property    | Modifier   | Type                |
| :---------- | :--------- | :------------------ |
| `DeviceIDs` | `readonly` | readonly `number`[] |
| `FromDate`  | `readonly` | `string`            |
| `ToDate`    | `readonly` | `string`            |

---

### FailureData

#### Properties

| Property          | Modifier   | Type                                      |
| :---------------- | :--------- | :---------------------------------------- |
| `AttributeErrors` | `readonly` | `Record`\<`string`, readonly `string`[]\> |
| `Success`         | `readonly` | `false`                                   |

---

### FrostProtectionData

#### Extended by

- [`BuildingSettings`](README.md#buildingsettings)

#### Properties

| Property           | Modifier   | Type      |
| :----------------- | :--------- | :-------- |
| `FPDefined`        | `readonly` | `boolean` |
| `FPEnabled`        | `readonly` | `boolean` |
| `FPMaxTemperature` | `readonly` | `number`  |
| `FPMinTemperature` | `readonly` | `number`  |

---

### FrostProtectionPostData

#### Properties

| Property             | Modifier   | Type                |
| :------------------- | :--------- | :------------------ |
| `AreaIds?`           | `readonly` | readonly `number`[] |
| `BuildingIds?`       | `readonly` | readonly `number`[] |
| `DeviceIds?`         | `readonly` | readonly `number`[] |
| `Enabled`            | `readonly` | `boolean`           |
| `FloorIds?`          | `readonly` | readonly `number`[] |
| `MaximumTemperature` | `readonly` | `number`            |
| `MinimumTemperature` | `readonly` | `number`            |

---

### GetDeviceData

#### Properties

| Property | Modifier   | Type                                             |
| :------- | :--------- | :----------------------------------------------- |
| `Ata`    | `readonly` | [`GetDeviceDataAta`](README.md#getdevicedataata) |
| `Atw`    | `readonly` | [`GetDeviceDataAtw`](README.md#getdevicedataatw) |
| `Erv`    | `readonly` | [`GetDeviceDataErv`](README.md#getdevicedataerv) |

---

### GetDeviceDataParams

#### Properties

| Property     | Modifier   | Type     |
| :----------- | :--------- | :------- |
| `buildingId` | `readonly` | `number` |
| `id`         | `readonly` | `number` |

---

### HolidayModeData

#### Properties

| Property           | Modifier   | Type                                                                                                                  |
| :----------------- | :--------- | :-------------------------------------------------------------------------------------------------------------------- |
| `EndDate`          | `readonly` | \{ `Day`: `number`; `Hour`: `number`; `Minute`: `number`; `Month`: `number`; `Second`: `number`; `Year`: `number`; \} |
| `EndDate.Day`      | `readonly` | `number`                                                                                                              |
| `EndDate.Hour`     | `readonly` | `number`                                                                                                              |
| `EndDate.Minute`   | `readonly` | `number`                                                                                                              |
| `EndDate.Month`    | `readonly` | `number`                                                                                                              |
| `EndDate.Second`   | `readonly` | `number`                                                                                                              |
| `EndDate.Year`     | `readonly` | `number`                                                                                                              |
| `HMDefined`        | `public`   | `boolean`                                                                                                             |
| `HMEnabled`        | `public`   | `boolean`                                                                                                             |
| `HMEndDate`        | `public`   | `null` \| `string`                                                                                                    |
| `HMStartDate`      | `public`   | `null` \| `string`                                                                                                    |
| `StartDate`        | `public`   | \{ `Day`: `number`; `Hour`: `number`; `Minute`: `number`; `Month`: `number`; `Second`: `number`; `Year`: `number`; \} |
| `StartDate.Day`    | `public`   | `number`                                                                                                              |
| `StartDate.Hour`   | `public`   | `number`                                                                                                              |
| `StartDate.Minute` | `public`   | `number`                                                                                                              |
| `StartDate.Month`  | `public`   | `number`                                                                                                              |
| `StartDate.Second` | `public`   | `number`                                                                                                              |
| `StartDate.Year`   | `public`   | `number`                                                                                                              |
| `TimeZone`         | `public`   | `number`                                                                                                              |

---

### HolidayModePostData

#### Properties

| Property      | Modifier   | Type                                                                                                                                                                  |
| :------------ | :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Enabled`     | `readonly` | `boolean`                                                                                                                                                             |
| `EndDate`     | `readonly` | `null` \| \{ `Day`: `number`; `Hour`: `number`; `Minute`: `number`; `Month`: `number`; `Second`: `number`; `Year`: `number`; \}                                       |
| `HMTimeZones` | `readonly` | readonly \{ `Areas`: readonly `number`[]; `Buildings`: readonly `number`[]; `Devices`: readonly `number`[]; `Floors`: readonly `number`[]; `TimeZone`: `number`; \}[] |
| `StartDate`   | `readonly` | `null` \| \{ `Day`: `number`; `Hour`: `number`; `Minute`: `number`; `Month`: `number`; `Second`: `number`; `Year`: `number`; \}                                       |

---

### IAreaModel

#### Extends

- `IBaseModel`.`IBaseSuperDeviceModel`.`IBaseSubBuildingModel`

#### Properties

| Property             | Modifier   | Type                                                                                                                                                                                                     | Inherited from                      |
| :------------------- | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------- |
| `building`           | `public`   | `null` \| [`BuildingModel`](README.md#buildingmodel)                                                                                                                                                     | `IBaseSubBuildingModel.building`    |
| `buildingId`         | `readonly` | `number`                                                                                                                                                                                                 | `IBaseSubBuildingModel.buildingId`  |
| `deviceIds`          | `public`   | `number`[]                                                                                                                                                                                               | `IBaseSuperDeviceModel.deviceIds`   |
| `devices`            | `public`   | [`DeviceModelAny`](README.md#devicemodelany)[]                                                                                                                                                           | `IBaseSuperDeviceModel.devices`     |
| `floor`              | `public`   | `null` \| [`FloorModel`](README.md#floormodel)                                                                                                                                                           | -                                   |
| `floorId`            | `readonly` | `null` \| `number`                                                                                                                                                                                       | -                                   |
| `getErrors`          | `public`   | (`postData`: `Omit`\<[`ErrorPostData`](README.md#errorpostdata), `"DeviceIDs"`\>) => `Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>                         | `IBaseModel.getErrors`              |
| `getFrostProtection` | `public`   | () => `Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>                                                                                                                                | `IBaseModel.getFrostProtection`     |
| `getHolidayMode`     | `public`   | () => `Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>                                                                                                                                        | `IBaseModel.getHolidayMode`         |
| `getTiles`           | `public`   | () => `Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\>                                                                                                                                         | `IBaseSuperDeviceModel.getTiles`    |
| `id`                 | `readonly` | `number`                                                                                                                                                                                                 | `IBaseModel.id`                     |
| `name`               | `readonly` | `string`                                                                                                                                                                                                 | `IBaseModel.name`                   |
| `setAtaGroup`        | `public`   | (`postData`: `Omit`\<[`SetAtaGroupPostData`](README.md#setatagrouppostdata), `"Specification"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>       | `IBaseSuperDeviceModel.setAtaGroup` |
| `setFrostProtection` | `public`   | (`postData`: `Omit`\<[`FrostProtectionPostData`](README.md#frostprotectionpostdata), `"BuildingIds"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> | `IBaseModel.setFrostProtection`     |
| `setHolidayMode`     | `public`   | (`postData`: `Omit`\<[`HolidayModePostData`](README.md#holidaymodepostdata), `"HMTimeZones"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>         | `IBaseModel.setHolidayMode`         |
| `setPower`           | `public`   | (`postData`: `Omit`\<[`SetPowerPostData`](README.md#setpowerpostdata), `"DeviceIds"`\>) => `Promise`\<`boolean`\>                                                                                        | `IBaseModel.setPower`               |

---

### IBuildingModel

#### Extends

- `IBaseModel`.`IBaseSuperDeviceModel`

#### Properties

| Property             | Modifier   | Type                                                                                                                                                                                                     | Inherited from                      |
| :------------------- | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------- |
| `data`               | `readonly` | [`BuildingSettings`](README.md#buildingsettings)                                                                                                                                                         | -                                   |
| `deviceIds`          | `public`   | `number`[]                                                                                                                                                                                               | `IBaseSuperDeviceModel.deviceIds`   |
| `devices`            | `public`   | [`DeviceModelAny`](README.md#devicemodelany)[]                                                                                                                                                           | `IBaseSuperDeviceModel.devices`     |
| `fetch`              | `public`   | () => `Promise`\<[`BuildingSettings`](README.md#buildingsettings)\>                                                                                                                                      | -                                   |
| `getErrors`          | `public`   | (`postData`: `Omit`\<[`ErrorPostData`](README.md#errorpostdata), `"DeviceIDs"`\>) => `Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>                         | `IBaseModel.getErrors`              |
| `getFrostProtection` | `public`   | () => `Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>                                                                                                                                | `IBaseModel.getFrostProtection`     |
| `getHolidayMode`     | `public`   | () => `Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>                                                                                                                                        | `IBaseModel.getHolidayMode`         |
| `getTiles`           | `public`   | () => `Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\>                                                                                                                                         | `IBaseSuperDeviceModel.getTiles`    |
| `id`                 | `readonly` | `number`                                                                                                                                                                                                 | `IBaseModel.id`                     |
| `name`               | `readonly` | `string`                                                                                                                                                                                                 | `IBaseModel.name`                   |
| `setAtaGroup`        | `public`   | (`postData`: `Omit`\<[`SetAtaGroupPostData`](README.md#setatagrouppostdata), `"Specification"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>       | `IBaseSuperDeviceModel.setAtaGroup` |
| `setFrostProtection` | `public`   | (`postData`: `Omit`\<[`FrostProtectionPostData`](README.md#frostprotectionpostdata), `"BuildingIds"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> | `IBaseModel.setFrostProtection`     |
| `setHolidayMode`     | `public`   | (`postData`: `Omit`\<[`HolidayModePostData`](README.md#holidaymodepostdata), `"HMTimeZones"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>         | `IBaseModel.setHolidayMode`         |
| `setPower`           | `public`   | (`postData`: `Omit`\<[`SetPowerPostData`](README.md#setpowerpostdata), `"DeviceIds"`\>) => `Promise`\<`boolean`\>                                                                                        | `IBaseModel.setPower`               |

---

### IDeviceModel\<T\>

#### Extends

- `IBaseModel`.`IBaseSubBuildingModel`

#### Type parameters

| Type parameter                                                    |
| :---------------------------------------------------------------- |
| `T` _extends_ keyof _typeof_ [`DeviceType`](README.md#devicetype) |

#### Properties

| Property             | Modifier   | Type                                                                                                                                                                                                     | Inherited from                     |
| :------------------- | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------- |
| `area`               | `public`   | `null` \| [`AreaModel`](README.md#areamodel)                                                                                                                                                             | -                                  |
| `areaId`             | `readonly` | `null` \| `number`                                                                                                                                                                                       | -                                  |
| `building`           | `public`   | `null` \| [`BuildingModel`](README.md#buildingmodel)                                                                                                                                                     | `IBaseSubBuildingModel.building`   |
| `buildingId`         | `readonly` | `number`                                                                                                                                                                                                 | `IBaseSubBuildingModel.buildingId` |
| `data`               | `readonly` | [`ListDevice`](README.md#listdevice)\[`T`\]\[`"Device"`\]                                                                                                                                                | -                                  |
| `fetch`              | `public`   | () => `Promise`\<[`ListDevice`](README.md#listdevice)\[`T`\]\[`"Device"`\]\>                                                                                                                             | -                                  |
| `floor`              | `public`   | `null` \| [`FloorModel`](README.md#floormodel)                                                                                                                                                           | -                                  |
| `floorId`            | `readonly` | `null` \| `number`                                                                                                                                                                                       | -                                  |
| `get`                | `public`   | () => `Promise`\<[`GetDeviceData`](README.md#getdevicedata)\[`T`\]\>                                                                                                                                     | -                                  |
| `getEnergyReport`    | `public`   | (`postData`: `Omit`\<[`EnergyPostData`](README.md#energypostdata), `"DeviceID"`\>) => `Promise`\<[`EnergyData`](README.md#energydata)\[`T`\]\>                                                           | -                                  |
| `getErrors`          | `public`   | (`postData`: `Omit`\<[`ErrorPostData`](README.md#errorpostdata), `"DeviceIDs"`\>) => `Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>                         | `IBaseModel.getErrors`             |
| `getFrostProtection` | `public`   | () => `Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>                                                                                                                                | `IBaseModel.getFrostProtection`    |
| `getHolidayMode`     | `public`   | () => `Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>                                                                                                                                        | `IBaseModel.getHolidayMode`        |
| `getTile`            | `public`   | (`select`?: `false`) => `Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\> & (`select`: `true`) => `Promise`\<[`TilesData`](README.md#tilesdatat)\<`T`\>\>                                       | -                                  |
| `id`                 | `readonly` | `number`                                                                                                                                                                                                 | `IBaseModel.id`                    |
| `name`               | `readonly` | `string`                                                                                                                                                                                                 | `IBaseModel.name`                  |
| `set`                | `public`   | (`postData`: `Omit`\<[`SetDevicePostData`](README.md#setdevicepostdata)\[`T`\], `"DeviceID"`\>) => `Promise`\<[`SetDeviceData`](README.md#setdevicedata)\[`T`\]\>                                        | -                                  |
| `setFrostProtection` | `public`   | (`postData`: `Omit`\<[`FrostProtectionPostData`](README.md#frostprotectionpostdata), `"BuildingIds"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> | `IBaseModel.setFrostProtection`    |
| `setHolidayMode`     | `public`   | (`postData`: `Omit`\<[`HolidayModePostData`](README.md#holidaymodepostdata), `"HMTimeZones"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>         | `IBaseModel.setHolidayMode`        |
| `setPower`           | `public`   | (`postData`: `Omit`\<[`SetPowerPostData`](README.md#setpowerpostdata), `"DeviceIds"`\>) => `Promise`\<`boolean`\>                                                                                        | `IBaseModel.setPower`              |
| `type`               | `readonly` | `T`                                                                                                                                                                                                      | -                                  |

---

### IFloorModel

#### Extends

- `IBaseModel`.`IBaseSuperDeviceModel`.`IBaseSubBuildingModel`

#### Properties

| Property             | Modifier   | Type                                                                                                                                                                                                     | Inherited from                      |
| :------------------- | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------- |
| `areaIds`            | `public`   | `number`[]                                                                                                                                                                                               | -                                   |
| `areas`              | `public`   | [`AreaModel`](README.md#areamodel)[]                                                                                                                                                                     | -                                   |
| `building`           | `public`   | `null` \| [`BuildingModel`](README.md#buildingmodel)                                                                                                                                                     | `IBaseSubBuildingModel.building`    |
| `buildingId`         | `readonly` | `number`                                                                                                                                                                                                 | `IBaseSubBuildingModel.buildingId`  |
| `deviceIds`          | `public`   | `number`[]                                                                                                                                                                                               | `IBaseSuperDeviceModel.deviceIds`   |
| `devices`            | `public`   | [`DeviceModelAny`](README.md#devicemodelany)[]                                                                                                                                                           | `IBaseSuperDeviceModel.devices`     |
| `getErrors`          | `public`   | (`postData`: `Omit`\<[`ErrorPostData`](README.md#errorpostdata), `"DeviceIDs"`\>) => `Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>                         | `IBaseModel.getErrors`              |
| `getFrostProtection` | `public`   | () => `Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>                                                                                                                                | `IBaseModel.getFrostProtection`     |
| `getHolidayMode`     | `public`   | () => `Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>                                                                                                                                        | `IBaseModel.getHolidayMode`         |
| `getTiles`           | `public`   | () => `Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\>                                                                                                                                         | `IBaseSuperDeviceModel.getTiles`    |
| `id`                 | `readonly` | `number`                                                                                                                                                                                                 | `IBaseModel.id`                     |
| `name`               | `readonly` | `string`                                                                                                                                                                                                 | `IBaseModel.name`                   |
| `setAtaGroup`        | `public`   | (`postData`: `Omit`\<[`SetAtaGroupPostData`](README.md#setatagrouppostdata), `"Specification"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>       | `IBaseSuperDeviceModel.setAtaGroup` |
| `setFrostProtection` | `public`   | (`postData`: `Omit`\<[`FrostProtectionPostData`](README.md#frostprotectionpostdata), `"BuildingIds"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> | `IBaseModel.setFrostProtection`     |
| `setHolidayMode`     | `public`   | (`postData`: `Omit`\<[`HolidayModePostData`](README.md#holidaymodepostdata), `"HMTimeZones"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>         | `IBaseModel.setHolidayMode`         |
| `setPower`           | `public`   | (`postData`: `Omit`\<[`SetPowerPostData`](README.md#setpowerpostdata), `"DeviceIds"`\>) => `Promise`\<`boolean`\>                                                                                        | `IBaseModel.setPower`               |

---

### IMELCloudAPI

#### Properties

| Property             | Type                                                                                                                                                                                                                                                                                                                                                         |
| :------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `applyLogin`         | (`data`?: [`LoginCredentials`](README.md#logincredentials), `onSuccess`?: () => `Promise`\<`void`\>) => `Promise`\<`boolean`\>                                                                                                                                                                                                                               |
| `fetchDevices`       | () => `Promise`\<\{ `data`: [`Building`](README.md#building-3)[]; \}\>                                                                                                                                                                                                                                                                                       |
| `getDevice`          | \<`T`\>(`__namedParameters`: \{ `params`: [`GetDeviceDataParams`](README.md#getdevicedataparams); \}) => `Promise`\<\{ `data`: [`GetDeviceData`](README.md#getdevicedata)\[`T`\]; \}\>                                                                                                                                                                       |
| `getEnergyReport`    | \<`T`\>(`__namedParameters`: \{ `postData`: [`EnergyPostData`](README.md#energypostdata); \}) => `Promise`\<\{ `data`: [`EnergyData`](README.md#energydata)\[`T`\]; \}\>                                                                                                                                                                                     |
| `getErrors`          | (`__namedParameters`: \{ `postData`: [`ErrorPostData`](README.md#errorpostdata); \}) => `Promise`\<\{ `data`: [`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]; \}\>                                                                                                                                                           |
| `getFrostProtection` | (`__namedParameters`: \{ `params`: [`SettingsParams`](README.md#settingsparams); \}) => `Promise`\<\{ `data`: [`FrostProtectionData`](README.md#frostprotectiondata); \}\>                                                                                                                                                                                   |
| `getHolidayMode`     | (`__namedParameters`: \{ `params`: [`SettingsParams`](README.md#settingsparams); \}) => `Promise`\<\{ `data`: [`HolidayModeData`](README.md#holidaymodedata); \}\>                                                                                                                                                                                           |
| `getTiles`           | (`__namedParameters`: \{ `postData`: [`TilesPostData`](README.md#tilespostdatat)\<`null`\>; \}) => `Promise`\<\{ `data`: [`TilesData`](README.md#tilesdatat)\<`null`\>; \}\> & \<`T`\>(`__namedParameters`: \{ `postData`: [`TilesPostData`](README.md#tilespostdatat)\<`T`\>; \}) => `Promise`\<\{ `data`: [`TilesData`](README.md#tilesdatat)\<`T`\>; \}\> |
| `language`           | [`Language`](README.md#language)                                                                                                                                                                                                                                                                                                                             |
| `login`              | (`__namedParameters`: \{ `postData`: [`LoginPostData`](README.md#loginpostdata); \}) => `Promise`\<\{ `data`: [`LoginData`](README.md#logindata); \}\>                                                                                                                                                                                                       |
| `setAtaGroup`        | (`__namedParameters`: \{ `postData`: [`SetAtaGroupPostData`](README.md#setatagrouppostdata); \}) => `Promise`\<\{ `data`: [`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata); \}\>                                                                                                                                             |
| `setDevice`          | \<`T`\>(`__namedParameters`: \{ `heatPumpType`: `T`; `postData`: [`SetDevicePostData`](README.md#setdevicepostdata)\[`T`\]; \}) => `Promise`\<\{ `data`: [`SetDeviceData`](README.md#setdevicedata)\[`T`\]; \}\>                                                                                                                                             |
| `setFrostProtection` | (`__namedParameters`: \{ `postData`: [`FrostProtectionPostData`](README.md#frostprotectionpostdata); \}) => `Promise`\<\{ `data`: [`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata); \}\>                                                                                                                                     |
| `setHolidayMode`     | (`__namedParameters`: \{ `postData`: [`HolidayModePostData`](README.md#holidaymodepostdata); \}) => `Promise`\<\{ `data`: [`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata); \}\>                                                                                                                                             |
| `setLanguage`        | (`__namedParameters`: \{ `postData`: \{ `language`: [`Language`](README.md#language); \}; \}) => `Promise`\<\{ `data`: `boolean`; \}\>                                                                                                                                                                                                                       |
| `setPower`           | (`__namedParameters`: \{ `postData`: [`SetPowerPostData`](README.md#setpowerpostdata); \}) => `Promise`\<\{ `data`: `boolean`; \}\>                                                                                                                                                                                                                          |

---

### ListDevice

#### Properties

| Property | Modifier   | Type                                       |
| :------- | :--------- | :----------------------------------------- |
| `Ata`    | `readonly` | [`ListDeviceAta`](README.md#listdeviceata) |
| `Atw`    | `readonly` | [`ListDeviceAtw`](README.md#listdeviceatw) |
| `Erv`    | `readonly` | [`ListDeviceErv`](README.md#listdeviceerv) |

---

### ListDeviceAta

#### Extends

- [`BaseListDevice`](README.md#baselistdevice)

#### Properties

| Property     | Modifier   | Type                                               | Inherited from                                            |
| :----------- | :--------- | :------------------------------------------------- | :-------------------------------------------------------- |
| `AreaID`     | `readonly` | `null` \| `number`                                 | [`BaseListDevice`](README.md#baselistdevice).`AreaID`     |
| `BuildingID` | `readonly` | `number`                                           | [`BaseListDevice`](README.md#baselistdevice).`BuildingID` |
| `Device`     | `readonly` | [`ListDeviceDataAta`](README.md#listdevicedataata) | -                                                         |
| `DeviceID`   | `readonly` | `number`                                           | [`BaseListDevice`](README.md#baselistdevice).`DeviceID`   |
| `DeviceName` | `readonly` | `string`                                           | [`BaseListDevice`](README.md#baselistdevice).`DeviceName` |
| `FloorID`    | `readonly` | `null` \| `number`                                 | [`BaseListDevice`](README.md#baselistdevice).`FloorID`    |
| `Type`       | `readonly` | [`DeviceType`](README.md#devicetype)               | [`BaseListDevice`](README.md#baselistdevice).`Type`       |

---

### ListDeviceAtw

#### Extends

- [`BaseListDevice`](README.md#baselistdevice)

#### Properties

| Property     | Modifier   | Type                                               | Inherited from                                            |
| :----------- | :--------- | :------------------------------------------------- | :-------------------------------------------------------- |
| `AreaID`     | `readonly` | `null` \| `number`                                 | [`BaseListDevice`](README.md#baselistdevice).`AreaID`     |
| `BuildingID` | `readonly` | `number`                                           | [`BaseListDevice`](README.md#baselistdevice).`BuildingID` |
| `Device`     | `readonly` | [`ListDeviceDataAtw`](README.md#listdevicedataatw) | -                                                         |
| `DeviceID`   | `readonly` | `number`                                           | [`BaseListDevice`](README.md#baselistdevice).`DeviceID`   |
| `DeviceName` | `readonly` | `string`                                           | [`BaseListDevice`](README.md#baselistdevice).`DeviceName` |
| `FloorID`    | `readonly` | `null` \| `number`                                 | [`BaseListDevice`](README.md#baselistdevice).`FloorID`    |
| `Type`       | `readonly` | [`DeviceType`](README.md#devicetype)               | [`BaseListDevice`](README.md#baselistdevice).`Type`       |

---

### ListDeviceDataAta

#### Extends

- [`BaseListDeviceData`](README.md#baselistdevicedata).`Omit`\<[`GetDeviceDataAta`](README.md#getdevicedataata), keyof [`DeviceDataNotInList`](README.md#devicedatanotinlist) \| `"SetFanSpeed"` \| `"VaneHorizontal"` \| `"VaneVertical"`\>

#### Properties

| Property                  | Modifier   | Type                                       | Inherited from                                                            |
| :------------------------ | :--------- | :----------------------------------------- | :------------------------------------------------------------------------ |
| `ActualFanSpeed`          | `readonly` | `number`                                   | -                                                                         |
| `DeviceType`              | `readonly` | `Ata`                                      | `Omit.DeviceType`                                                         |
| `EffectiveFlags`          | `readonly` | `0`                                        | [`BaseListDeviceData`](README.md#baselistdevicedata).`EffectiveFlags`     |
| `FanSpeed`                | `readonly` | [`FanSpeed`](README.md#fanspeed)           | -                                                                         |
| `HasAutomaticFanSpeed`    | `readonly` | `boolean`                                  | -                                                                         |
| `MaxTempAutomatic`        | `readonly` | `number`                                   | -                                                                         |
| `MaxTempCoolDry`          | `readonly` | `number`                                   | -                                                                         |
| `MaxTempHeat`             | `readonly` | `number`                                   | -                                                                         |
| `MinTempAutomatic`        | `readonly` | `number`                                   | -                                                                         |
| `MinTempCoolDry`          | `readonly` | `number`                                   | -                                                                         |
| `MinTempHeat`             | `readonly` | `number`                                   | -                                                                         |
| `NumberOfFanSpeeds`       | `readonly` | `number`                                   | `Omit.NumberOfFanSpeeds`                                                  |
| `Offline`                 | `readonly` | `boolean`                                  | [`BaseListDeviceData`](README.md#baselistdevicedata).`Offline`            |
| `OperationMode`           | `readonly` | [`OperationMode`](README.md#operationmode) | `Omit.OperationMode`                                                      |
| `OutdoorTemperature`      | `readonly` | `number`                                   | -                                                                         |
| `Power`                   | `readonly` | `boolean`                                  | [`BaseListDeviceData`](README.md#baselistdevicedata).`Power`              |
| `RoomTemperature`         | `readonly` | `number`                                   | `Omit.RoomTemperature`                                                    |
| `SetTemperature`          | `readonly` | `number`                                   | `Omit.SetTemperature`                                                     |
| `VaneHorizontalDirection` | `readonly` | [`Horizontal`](README.md#horizontal)       | -                                                                         |
| `VaneVerticalDirection`   | `readonly` | [`Vertical`](README.md#vertical)           | -                                                                         |
| `WifiSignalStrength`      | `readonly` | `number`                                   | [`BaseListDeviceData`](README.md#baselistdevicedata).`WifiSignalStrength` |

---

### ListDeviceDataAtw

#### Extends

- [`BaseListDeviceData`](README.md#baselistdevicedata).`Omit`\<[`GetDeviceDataAtw`](README.md#getdevicedataatw), keyof [`DeviceDataNotInList`](README.md#devicedatanotinlist)\>

#### Properties

| Property                       | Modifier   | Type                                                 | Inherited from                                                            |
| :----------------------------- | :--------- | :--------------------------------------------------- | :------------------------------------------------------------------------ |
| `BoosterHeater1Status`         | `readonly` | `boolean`                                            | -                                                                         |
| `BoosterHeater2PlusStatus`     | `readonly` | `boolean`                                            | -                                                                         |
| `BoosterHeater2Status`         | `readonly` | `boolean`                                            | -                                                                         |
| `CanCool`                      | `readonly` | `boolean`                                            | -                                                                         |
| `CondensingTemperature`        | `readonly` | `number`                                             | -                                                                         |
| `CurrentEnergyConsumed`        | `readonly` | `number`                                             | -                                                                         |
| `CurrentEnergyProduced`        | `readonly` | `number`                                             | -                                                                         |
| `DefrostMode`                  | `readonly` | `number`                                             | -                                                                         |
| `DeviceType`                   | `readonly` | `Atw`                                                | `Omit.DeviceType`                                                         |
| `EcoHotWater`                  | `readonly` | `boolean`                                            | -                                                                         |
| `EffectiveFlags`               | `readonly` | `0`                                                  | [`BaseListDeviceData`](README.md#baselistdevicedata).`EffectiveFlags`     |
| `FlowTemperature`              | `readonly` | `number`                                             | -                                                                         |
| `FlowTemperatureZone1`         | `readonly` | `number`                                             | -                                                                         |
| `FlowTemperatureZone2`         | `readonly` | `number`                                             | -                                                                         |
| `ForcedHotWaterMode`           | `readonly` | `boolean`                                            | `Omit.ForcedHotWaterMode`                                                 |
| `HasZone2`                     | `readonly` | `boolean`                                            | -                                                                         |
| `HeatPumpFrequency`            | `readonly` | `number`                                             | -                                                                         |
| `IdleZone1`                    | `readonly` | `boolean`                                            | `Omit.IdleZone1`                                                          |
| `IdleZone2`                    | `readonly` | `boolean`                                            | `Omit.IdleZone2`                                                          |
| `ImmersionHeaterStatus`        | `readonly` | `boolean`                                            | -                                                                         |
| `LastLegionellaActivationTime` | `readonly` | `string`                                             | -                                                                         |
| `MaxTankTemperature`           | `readonly` | `number`                                             | -                                                                         |
| `MixingTankWaterTemperature`   | `readonly` | `number`                                             | -                                                                         |
| `Offline`                      | `readonly` | `boolean`                                            | [`BaseListDeviceData`](README.md#baselistdevicedata).`Offline`            |
| `OperationMode`                | `readonly` | [`OperationModeState`](README.md#operationmodestate) | `Omit.OperationMode`                                                      |
| `OperationModeZone1`           | `readonly` | [`OperationModeZone`](README.md#operationmodezone)   | `Omit.OperationModeZone1`                                                 |
| `OperationModeZone2`           | `readonly` | [`OperationModeZone`](README.md#operationmodezone)   | `Omit.OperationModeZone2`                                                 |
| `OutdoorTemperature`           | `readonly` | `number`                                             | `Omit.OutdoorTemperature`                                                 |
| `Power`                        | `readonly` | `boolean`                                            | [`BaseListDeviceData`](README.md#baselistdevicedata).`Power`              |
| `ProhibitCoolingZone1`         | `readonly` | `boolean`                                            | `Omit.ProhibitCoolingZone1`                                               |
| `ProhibitCoolingZone2`         | `readonly` | `boolean`                                            | `Omit.ProhibitCoolingZone2`                                               |
| `ProhibitHeatingZone1`         | `readonly` | `boolean`                                            | `Omit.ProhibitHeatingZone1`                                               |
| `ProhibitHeatingZone2`         | `readonly` | `boolean`                                            | `Omit.ProhibitHeatingZone2`                                               |
| `ProhibitHotWater`             | `readonly` | `boolean`                                            | `Omit.ProhibitHotWater`                                                   |
| `ReturnTemperature`            | `readonly` | `number`                                             | -                                                                         |
| `ReturnTemperatureZone1`       | `readonly` | `number`                                             | -                                                                         |
| `ReturnTemperatureZone2`       | `readonly` | `number`                                             | -                                                                         |
| `RoomTemperatureZone1`         | `readonly` | `number`                                             | `Omit.RoomTemperatureZone1`                                               |
| `RoomTemperatureZone2`         | `readonly` | `number`                                             | `Omit.RoomTemperatureZone2`                                               |
| `SetCoolFlowTemperatureZone1`  | `readonly` | `number`                                             | `Omit.SetCoolFlowTemperatureZone1`                                        |
| `SetCoolFlowTemperatureZone2`  | `readonly` | `number`                                             | `Omit.SetCoolFlowTemperatureZone2`                                        |
| `SetHeatFlowTemperatureZone1`  | `readonly` | `number`                                             | `Omit.SetHeatFlowTemperatureZone1`                                        |
| `SetHeatFlowTemperatureZone2`  | `readonly` | `number`                                             | `Omit.SetHeatFlowTemperatureZone2`                                        |
| `SetTankWaterTemperature`      | `readonly` | `number`                                             | `Omit.SetTankWaterTemperature`                                            |
| `SetTemperatureZone1`          | `readonly` | `number`                                             | `Omit.SetTemperatureZone1`                                                |
| `SetTemperatureZone2`          | `readonly` | `number`                                             | `Omit.SetTemperatureZone2`                                                |
| `TankWaterTemperature`         | `readonly` | `number`                                             | `Omit.TankWaterTemperature`                                               |
| `TargetHCTemperatureZone1`     | `readonly` | `number`                                             | -                                                                         |
| `TargetHCTemperatureZone2`     | `readonly` | `number`                                             | -                                                                         |
| `WifiSignalStrength`           | `readonly` | `number`                                             | [`BaseListDeviceData`](README.md#baselistdevicedata).`WifiSignalStrength` |
| `Zone1InCoolMode`              | `readonly` | `boolean`                                            | -                                                                         |
| `Zone1InHeatMode`              | `readonly` | `boolean`                                            | -                                                                         |
| `Zone2InCoolMode`              | `readonly` | `boolean`                                            | -                                                                         |
| `Zone2InHeatMode`              | `readonly` | `boolean`                                            | -                                                                         |

---

### ListDeviceDataErv

#### Extends

- [`BaseListDeviceData`](README.md#baselistdevicedata).`Omit`\<[`GetDeviceDataErv`](README.md#getdevicedataerv), keyof [`DeviceDataNotInList`](README.md#devicedatanotinlist)\>

#### Properties

| Property               | Modifier   | Type                                                                      | Inherited from                                                            |
| :--------------------- | :--------- | :------------------------------------------------------------------------ | :------------------------------------------------------------------------ |
| `DeviceType`           | `readonly` | `Erv`                                                                     | `Omit.DeviceType`                                                         |
| `EffectiveFlags`       | `readonly` | `0`                                                                       | [`BaseListDeviceData`](README.md#baselistdevicedata).`EffectiveFlags`     |
| `HasAutomaticFanSpeed` | `readonly` | `boolean`                                                                 | -                                                                         |
| `HasCO2Sensor`         | `readonly` | `boolean`                                                                 | -                                                                         |
| `HasPM25Sensor`        | `readonly` | `boolean`                                                                 | -                                                                         |
| `NumberOfFanSpeeds`    | `readonly` | `number`                                                                  | `Omit.NumberOfFanSpeeds`                                                  |
| `Offline`              | `readonly` | `boolean`                                                                 | [`BaseListDeviceData`](README.md#baselistdevicedata).`Offline`            |
| `OutdoorTemperature`   | `readonly` | `number`                                                                  | `Omit.OutdoorTemperature`                                                 |
| `PM25Level`            | `readonly` | `number`                                                                  | -                                                                         |
| `Power`                | `readonly` | `boolean`                                                                 | [`BaseListDeviceData`](README.md#baselistdevicedata).`Power`              |
| `RoomCO2Level`         | `readonly` | `number`                                                                  | `Omit.RoomCO2Level`                                                       |
| `RoomTemperature`      | `readonly` | `number`                                                                  | `Omit.RoomTemperature`                                                    |
| `SetFanSpeed`          | `readonly` | \| `auto` \| `very_slow` \| `slow` \| `moderate` \| `fast` \| `very_fast` | `Omit.SetFanSpeed`                                                        |
| `VentilationMode`      | `readonly` | [`VentilationMode`](README.md#ventilationmode)                            | `Omit.VentilationMode`                                                    |
| `WifiSignalStrength`   | `readonly` | `number`                                                                  | [`BaseListDeviceData`](README.md#baselistdevicedata).`WifiSignalStrength` |

---

### ListDeviceErv

#### Extends

- [`BaseListDevice`](README.md#baselistdevice)

#### Properties

| Property     | Modifier   | Type                                               | Inherited from                                            |
| :----------- | :--------- | :------------------------------------------------- | :-------------------------------------------------------- |
| `AreaID`     | `readonly` | `null` \| `number`                                 | [`BaseListDevice`](README.md#baselistdevice).`AreaID`     |
| `BuildingID` | `readonly` | `number`                                           | [`BaseListDevice`](README.md#baselistdevice).`BuildingID` |
| `Device`     | `readonly` | [`ListDeviceDataErv`](README.md#listdevicedataerv) | -                                                         |
| `DeviceID`   | `readonly` | `number`                                           | [`BaseListDevice`](README.md#baselistdevice).`DeviceID`   |
| `DeviceName` | `readonly` | `string`                                           | [`BaseListDevice`](README.md#baselistdevice).`DeviceName` |
| `FloorID`    | `readonly` | `null` \| `number`                                 | [`BaseListDevice`](README.md#baselistdevice).`FloorID`    |
| `Type`       | `readonly` | [`DeviceType`](README.md#devicetype)               | [`BaseListDevice`](README.md#baselistdevice).`Type`       |

---

### LocationData

#### Properties

| Property     | Modifier   | Type     |
| :----------- | :--------- | :------- |
| `BuildingId` | `readonly` | `number` |
| `ID`         | `readonly` | `number` |
| `Name`       | `readonly` | `string` |

---

### Logger

#### Properties

| Property | Modifier   | Type                                                                                      |
| :------- | :--------- | :---------------------------------------------------------------------------------------- |
| `error`  | `readonly` | (...`data`: `any`[]) => `void`(`message`?: `any`, ...`optionalParams`: `any`[]) => `void` |
| `log`    | `readonly` | (...`data`: `any`[]) => `void`(`message`?: `any`, ...`optionalParams`: `any`[]) => `void` |

---

### LoginCredentials

#### Properties

| Property   | Modifier   | Type     |
| :--------- | :--------- | :------- |
| `password` | `readonly` | `string` |
| `username` | `readonly` | `string` |

---

### LoginData

#### Properties

| Property    | Modifier   | Type                                                        |
| :---------- | :--------- | :---------------------------------------------------------- |
| `LoginData` | `readonly` | `null` \| \{ `ContextKey`: `string`; `Expiry`: `string`; \} |

---

### LoginPostData

#### Properties

| Property     | Modifier   | Type      |
| :----------- | :--------- | :-------- |
| `AppVersion` | `readonly` | `string`  |
| `Email`      | `readonly` | `string`  |
| `Language?`  | `readonly` | `number`  |
| `Password`   | `readonly` | `string`  |
| `Persist?`   | `readonly` | `boolean` |

---

### SetAtaGroupPostData

#### Properties

| Property                         | Modifier   | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| :------------------------------- | :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Specification`                  | `readonly` | \{ `AreaID`: `null`; `BuildingID`: `null`; `FloorID`: `number`; \} \| \{ `AreaID`: `null`; `BuildingID`: `number`; `FloorID`: `null`; \} \| \{ `AreaID`: `number`; `BuildingID`: `null`; `FloorID`: `null`; \}                                                                                                                                                                                                                                                                          |
| `State`                          | `readonly` | \{ `FanSpeed`: \| `null` \| `auto` \| `very_slow` \| `slow` \| `moderate` \| `fast` \| `very_fast`; `OperationMode`: `null` \| [`OperationMode`](README.md#operationmode); `Power`: `null` \| `boolean`; `SetTemperature`: `null` \| `number`; `VaneHorizontalDirection`: `null` \| [`Horizontal`](README.md#horizontal); `VaneHorizontalSwing`: `null` \| `boolean`; `VaneVerticalDirection`: `null` \| [`Vertical`](README.md#vertical); `VaneVerticalSwing`: `null` \| `boolean`; \} |
| `State.FanSpeed?`                | `public`   | \| `null` \| `auto` \| `very_slow` \| `slow` \| `moderate` \| `fast` \| `very_fast`                                                                                                                                                                                                                                                                                                                                                                                                     |
| `State.OperationMode?`           | `public`   | `null` \| [`OperationMode`](README.md#operationmode)                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `State.Power?`                   | `public`   | `null` \| `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `State.SetTemperature?`          | `public`   | `null` \| `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `State.VaneHorizontalDirection?` | `public`   | `null` \| [`Horizontal`](README.md#horizontal)                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `State.VaneHorizontalSwing?`     | `public`   | `null` \| `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `State.VaneVerticalDirection?`   | `public`   | `null` \| [`Vertical`](README.md#vertical)                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `State.VaneVerticalSwing?`       | `public`   | `null` \| `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

---

### SetDeviceData

#### Properties

| Property | Modifier   | Type                                             |
| :------- | :--------- | :----------------------------------------------- |
| `Ata`    | `readonly` | [`SetDeviceDataAta`](README.md#setdevicedataata) |
| `Atw`    | `readonly` | [`SetDeviceDataAtw`](README.md#setdevicedataatw) |
| `Erv`    | `readonly` | [`SetDeviceDataErv`](README.md#setdevicedataerv) |

---

### SetDeviceDataAta

#### Extends

- [`BaseSetDeviceData`](README.md#basesetdevicedata).`Required`\<`Readonly`\<[`UpdateDeviceDataAta`](README.md#updatedevicedataata)\>\>

#### Properties

| Property            | Modifier   | Type                                                                      | Inherited from                                                         |
| :------------------ | :--------- | :------------------------------------------------------------------------ | :--------------------------------------------------------------------- |
| `DeviceType`        | `readonly` | `Ata`                                                                     | -                                                                      |
| `EffectiveFlags`    | `readonly` | `number`                                                                  | [`BaseSetDeviceData`](README.md#basesetdevicedata).`EffectiveFlags`    |
| `LastCommunication` | `readonly` | `string`                                                                  | [`BaseSetDeviceData`](README.md#basesetdevicedata).`LastCommunication` |
| `NextCommunication` | `readonly` | `string`                                                                  | [`BaseSetDeviceData`](README.md#basesetdevicedata).`NextCommunication` |
| `NumberOfFanSpeeds` | `readonly` | `number`                                                                  | -                                                                      |
| `Offline`           | `readonly` | `boolean`                                                                 | [`BaseSetDeviceData`](README.md#basesetdevicedata).`Offline`           |
| `OperationMode`     | `readonly` | [`OperationMode`](README.md#operationmode)                                | `Required.OperationMode`                                               |
| `Power`             | `readonly` | `boolean`                                                                 | [`BaseSetDeviceData`](README.md#basesetdevicedata).`Power`             |
| `RoomTemperature`   | `readonly` | `number`                                                                  | -                                                                      |
| `SetFanSpeed`       | `readonly` | \| `auto` \| `very_slow` \| `slow` \| `moderate` \| `fast` \| `very_fast` | `Required.SetFanSpeed`                                                 |
| `SetTemperature`    | `readonly` | `number`                                                                  | `Required.SetTemperature`                                              |
| `VaneHorizontal`    | `readonly` | [`Horizontal`](README.md#horizontal)                                      | `Required.VaneHorizontal`                                              |
| `VaneVertical`      | `readonly` | [`Vertical`](README.md#vertical)                                          | `Required.VaneVertical`                                                |

---

### SetDeviceDataAtw

#### Extends

- [`BaseSetDeviceData`](README.md#basesetdevicedata).`Required`\<`Readonly`\<[`UpdateDeviceDataAtw`](README.md#updatedevicedataatw)\>\>

#### Properties

| Property                      | Modifier   | Type                                                 | Inherited from                                                         |
| :---------------------------- | :--------- | :--------------------------------------------------- | :--------------------------------------------------------------------- |
| `DeviceType`                  | `readonly` | `Atw`                                                | -                                                                      |
| `EffectiveFlags`              | `readonly` | `number`                                             | [`BaseSetDeviceData`](README.md#basesetdevicedata).`EffectiveFlags`    |
| `ForcedHotWaterMode`          | `readonly` | `boolean`                                            | `Required.ForcedHotWaterMode`                                          |
| `IdleZone1`                   | `readonly` | `boolean`                                            | -                                                                      |
| `IdleZone2`                   | `readonly` | `boolean`                                            | -                                                                      |
| `LastCommunication`           | `readonly` | `string`                                             | [`BaseSetDeviceData`](README.md#basesetdevicedata).`LastCommunication` |
| `NextCommunication`           | `readonly` | `string`                                             | [`BaseSetDeviceData`](README.md#basesetdevicedata).`NextCommunication` |
| `Offline`                     | `readonly` | `boolean`                                            | [`BaseSetDeviceData`](README.md#basesetdevicedata).`Offline`           |
| `OperationMode`               | `readonly` | [`OperationModeState`](README.md#operationmodestate) | -                                                                      |
| `OperationModeZone1`          | `readonly` | [`OperationModeZone`](README.md#operationmodezone)   | `Required.OperationModeZone1`                                          |
| `OperationModeZone2`          | `readonly` | [`OperationModeZone`](README.md#operationmodezone)   | `Required.OperationModeZone2`                                          |
| `OutdoorTemperature`          | `readonly` | `number`                                             | -                                                                      |
| `Power`                       | `readonly` | `boolean`                                            | [`BaseSetDeviceData`](README.md#basesetdevicedata).`Power`             |
| `ProhibitCoolingZone1`        | `readonly` | `boolean`                                            | -                                                                      |
| `ProhibitCoolingZone2`        | `readonly` | `boolean`                                            | -                                                                      |
| `ProhibitHeatingZone1`        | `readonly` | `boolean`                                            | -                                                                      |
| `ProhibitHeatingZone2`        | `readonly` | `boolean`                                            | -                                                                      |
| `ProhibitHotWater`            | `readonly` | `boolean`                                            | -                                                                      |
| `RoomTemperatureZone1`        | `readonly` | `number`                                             | -                                                                      |
| `RoomTemperatureZone2`        | `readonly` | `number`                                             | -                                                                      |
| `SetCoolFlowTemperatureZone1` | `readonly` | `number`                                             | `Required.SetCoolFlowTemperatureZone1`                                 |
| `SetCoolFlowTemperatureZone2` | `readonly` | `number`                                             | `Required.SetCoolFlowTemperatureZone2`                                 |
| `SetHeatFlowTemperatureZone1` | `readonly` | `number`                                             | `Required.SetHeatFlowTemperatureZone1`                                 |
| `SetHeatFlowTemperatureZone2` | `readonly` | `number`                                             | `Required.SetHeatFlowTemperatureZone2`                                 |
| `SetTankWaterTemperature`     | `readonly` | `number`                                             | `Required.SetTankWaterTemperature`                                     |
| `SetTemperatureZone1`         | `readonly` | `number`                                             | `Required.SetTemperatureZone1`                                         |
| `SetTemperatureZone2`         | `readonly` | `number`                                             | `Required.SetTemperatureZone2`                                         |
| `TankWaterTemperature`        | `readonly` | `number`                                             | -                                                                      |

---

### SetDeviceDataErv

#### Extends

- [`BaseSetDeviceData`](README.md#basesetdevicedata).`Required`\<`Readonly`\<[`UpdateDeviceDataErv`](README.md#updatedevicedataerv)\>\>

#### Properties

| Property             | Modifier   | Type                                                                      | Inherited from                                                         |
| :------------------- | :--------- | :------------------------------------------------------------------------ | :--------------------------------------------------------------------- |
| `DeviceType`         | `readonly` | `Erv`                                                                     | -                                                                      |
| `EffectiveFlags`     | `readonly` | `number`                                                                  | [`BaseSetDeviceData`](README.md#basesetdevicedata).`EffectiveFlags`    |
| `LastCommunication`  | `readonly` | `string`                                                                  | [`BaseSetDeviceData`](README.md#basesetdevicedata).`LastCommunication` |
| `NextCommunication`  | `readonly` | `string`                                                                  | [`BaseSetDeviceData`](README.md#basesetdevicedata).`NextCommunication` |
| `NumberOfFanSpeeds`  | `readonly` | `number`                                                                  | -                                                                      |
| `Offline`            | `readonly` | `boolean`                                                                 | [`BaseSetDeviceData`](README.md#basesetdevicedata).`Offline`           |
| `OutdoorTemperature` | `readonly` | `number`                                                                  | -                                                                      |
| `Power`              | `readonly` | `boolean`                                                                 | [`BaseSetDeviceData`](README.md#basesetdevicedata).`Power`             |
| `RoomCO2Level`       | `readonly` | `number`                                                                  | -                                                                      |
| `RoomTemperature`    | `readonly` | `number`                                                                  | -                                                                      |
| `SetFanSpeed`        | `readonly` | \| `auto` \| `very_slow` \| `slow` \| `moderate` \| `fast` \| `very_fast` | `Required.SetFanSpeed`                                                 |
| `VentilationMode`    | `readonly` | [`VentilationMode`](README.md#ventilationmode)                            | `Required.VentilationMode`                                             |

---

### SetDevicePostData

#### Properties

| Property | Modifier   | Type                                                     |
| :------- | :--------- | :------------------------------------------------------- |
| `Ata`    | `readonly` | [`SetDevicePostDataAta`](README.md#setdevicepostdataata) |
| `Atw`    | `readonly` | [`SetDevicePostDataAtw`](README.md#setdevicepostdataatw) |
| `Erv`    | `readonly` | [`SetDevicePostDataErv`](README.md#setdevicepostdataerv) |

---

### SetDevicePostDataAta

#### Extends

- [`BaseDevicePostData`](README.md#basedevicepostdata).`Readonly`\<[`UpdateDeviceDataAta`](README.md#updatedevicedataata)\>

#### Properties

| Property          | Modifier   | Type                                                                      | Inherited from                                                  |
| :---------------- | :--------- | :------------------------------------------------------------------------ | :-------------------------------------------------------------- |
| `DeviceID`        | `readonly` | `number`                                                                  | [`BaseDevicePostData`](README.md#basedevicepostdata).`DeviceID` |
| `EffectiveFlags`  | `readonly` | `number`                                                                  | `Readonly.EffectiveFlags`                                       |
| `OperationMode?`  | `readonly` | [`OperationMode`](README.md#operationmode)                                | `Readonly.OperationMode`                                        |
| `Power?`          | `readonly` | `boolean`                                                                 | `Readonly.Power`                                                |
| `SetFanSpeed?`    | `readonly` | \| `auto` \| `very_slow` \| `slow` \| `moderate` \| `fast` \| `very_fast` | `Readonly.SetFanSpeed`                                          |
| `SetTemperature?` | `readonly` | `number`                                                                  | `Readonly.SetTemperature`                                       |
| `VaneHorizontal?` | `readonly` | [`Horizontal`](README.md#horizontal)                                      | `Readonly.VaneHorizontal`                                       |
| `VaneVertical?`   | `readonly` | [`Vertical`](README.md#vertical)                                          | `Readonly.VaneVertical`                                         |

---

### SetDevicePostDataAtw

#### Extends

- [`BaseDevicePostData`](README.md#basedevicepostdata).`Readonly`\<[`UpdateDeviceDataAtw`](README.md#updatedevicedataatw)\>

#### Properties

| Property                       | Modifier   | Type                                               | Inherited from                                                  |
| :----------------------------- | :--------- | :------------------------------------------------- | :-------------------------------------------------------------- |
| `DeviceID`                     | `readonly` | `number`                                           | [`BaseDevicePostData`](README.md#basedevicepostdata).`DeviceID` |
| `EffectiveFlags`               | `readonly` | `number`                                           | `Readonly.EffectiveFlags`                                       |
| `ForcedHotWaterMode?`          | `readonly` | `boolean`                                          | `Readonly.ForcedHotWaterMode`                                   |
| `OperationModeZone1?`          | `readonly` | [`OperationModeZone`](README.md#operationmodezone) | `Readonly.OperationModeZone1`                                   |
| `OperationModeZone2?`          | `readonly` | [`OperationModeZone`](README.md#operationmodezone) | `Readonly.OperationModeZone2`                                   |
| `Power?`                       | `readonly` | `boolean`                                          | `Readonly.Power`                                                |
| `SetCoolFlowTemperatureZone1?` | `readonly` | `number`                                           | `Readonly.SetCoolFlowTemperatureZone1`                          |
| `SetCoolFlowTemperatureZone2?` | `readonly` | `number`                                           | `Readonly.SetCoolFlowTemperatureZone2`                          |
| `SetHeatFlowTemperatureZone1?` | `readonly` | `number`                                           | `Readonly.SetHeatFlowTemperatureZone1`                          |
| `SetHeatFlowTemperatureZone2?` | `readonly` | `number`                                           | `Readonly.SetHeatFlowTemperatureZone2`                          |
| `SetTankWaterTemperature?`     | `readonly` | `number`                                           | `Readonly.SetTankWaterTemperature`                              |
| `SetTemperatureZone1?`         | `readonly` | `number`                                           | `Readonly.SetTemperatureZone1`                                  |
| `SetTemperatureZone2?`         | `readonly` | `number`                                           | `Readonly.SetTemperatureZone2`                                  |

---

### SetDevicePostDataErv

#### Extends

- [`BaseDevicePostData`](README.md#basedevicepostdata).`Readonly`\<[`UpdateDeviceDataErv`](README.md#updatedevicedataerv)\>

#### Properties

| Property           | Modifier   | Type                                                                      | Inherited from                                                  |
| :----------------- | :--------- | :------------------------------------------------------------------------ | :-------------------------------------------------------------- |
| `DeviceID`         | `readonly` | `number`                                                                  | [`BaseDevicePostData`](README.md#basedevicepostdata).`DeviceID` |
| `EffectiveFlags`   | `readonly` | `number`                                                                  | `Readonly.EffectiveFlags`                                       |
| `Power?`           | `readonly` | `boolean`                                                                 | `Readonly.Power`                                                |
| `SetFanSpeed?`     | `readonly` | \| `auto` \| `very_slow` \| `slow` \| `moderate` \| `fast` \| `very_fast` | `Readonly.SetFanSpeed`                                          |
| `VentilationMode?` | `readonly` | [`VentilationMode`](README.md#ventilationmode)                            | `Readonly.VentilationMode`                                      |

---

### SetPowerPostData

#### Properties

| Property    | Modifier   | Type                |
| :---------- | :--------- | :------------------ |
| `DeviceIds` | `readonly` | readonly `number`[] |
| `Power`     | `readonly` | `boolean`           |

---

### SettingManager

#### Properties

| Property | Type                                                                                          |
| :------- | :-------------------------------------------------------------------------------------------- |
| `get`    | \<`K`\>(`key`: `K`) => `undefined` \| `null` \| [`APISettings`](README.md#apisettings)\[`K`\] |
| `set`    | \<`K`\>(`key`: `K`, `value`: [`APISettings`](README.md#apisettings)\[`K`\]) => `void`         |

---

### SettingsParams

#### Properties

| Property    | Modifier   | Type                                                        |
| :---------- | :--------- | :---------------------------------------------------------- |
| `id`        | `readonly` | `number`                                                    |
| `tableName` | `readonly` | `"Area"` \| `"Building"` \| `"DeviceLocation"` \| `"Floor"` |

---

### SuccessData

#### Properties

| Property          | Modifier   | Type   |
| :---------------- | :--------- | :----- |
| `AttributeErrors` | `readonly` | `null` |
| `Success`         | `readonly` | `true` |

---

### TilesData\<T\>

#### Type parameters

| Type parameter                                                              |
| :-------------------------------------------------------------------------- |
| `T` _extends_ keyof _typeof_ [`DeviceType`](README.md#devicetype) \| `null` |

#### Properties

| Property         | Modifier   | Type                                                                                                                                                                        |
| :--------------- | :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SelectedDevice` | `readonly` | `T` _extends_ `"Ata"` \| `"Atw"` \| `"Erv"` ? [`GetDeviceData`](README.md#getdevicedata)\[`T`\<`T`\>\] : `null`                                                             |
| `Tiles`          | `readonly` | readonly \{ `Device`: `number`; `Offline`: `boolean`; `Power`: `boolean`; `RoomTemperature`: `number`; `RoomTemperature2`: `number`; `TankWaterTemperature`: `number`; \}[] |

---

### UpdateDeviceData

#### Properties

| Property | Modifier   | Type                                                   |
| :------- | :--------- | :----------------------------------------------------- |
| `Ata`    | `readonly` | [`UpdateDeviceDataAta`](README.md#updatedevicedataata) |
| `Atw`    | `readonly` | [`UpdateDeviceDataAtw`](README.md#updatedevicedataatw) |
| `Erv`    | `readonly` | [`UpdateDeviceDataErv`](README.md#updatedevicedataerv) |

---

### UpdateDeviceDataAta

#### Extends

- [`BaseUpdateDeviceData`](README.md#baseupdatedevicedata)

#### Properties

| Property          | Modifier   | Type                                                                      | Inherited from                                                            |
| :---------------- | :--------- | :------------------------------------------------------------------------ | :------------------------------------------------------------------------ |
| `EffectiveFlags`  | `public`   | `number`                                                                  | [`BaseUpdateDeviceData`](README.md#baseupdatedevicedata).`EffectiveFlags` |
| `OperationMode?`  | `readonly` | [`OperationMode`](README.md#operationmode)                                | -                                                                         |
| `Power?`          | `readonly` | `boolean`                                                                 | [`BaseUpdateDeviceData`](README.md#baseupdatedevicedata).`Power`          |
| `SetFanSpeed?`    | `readonly` | \| `auto` \| `very_slow` \| `slow` \| `moderate` \| `fast` \| `very_fast` | -                                                                         |
| `SetTemperature?` | `readonly` | `number`                                                                  | -                                                                         |
| `VaneHorizontal?` | `readonly` | [`Horizontal`](README.md#horizontal)                                      | -                                                                         |
| `VaneVertical?`   | `readonly` | [`Vertical`](README.md#vertical)                                          | -                                                                         |

---

### UpdateDeviceDataAtw

#### Extends

- [`BaseUpdateDeviceData`](README.md#baseupdatedevicedata)

#### Properties

| Property                       | Modifier   | Type                                               | Inherited from                                                            |
| :----------------------------- | :--------- | :------------------------------------------------- | :------------------------------------------------------------------------ |
| `EffectiveFlags`               | `public`   | `number`                                           | [`BaseUpdateDeviceData`](README.md#baseupdatedevicedata).`EffectiveFlags` |
| `ForcedHotWaterMode?`          | `readonly` | `boolean`                                          | -                                                                         |
| `OperationModeZone1?`          | `readonly` | [`OperationModeZone`](README.md#operationmodezone) | -                                                                         |
| `OperationModeZone2?`          | `readonly` | [`OperationModeZone`](README.md#operationmodezone) | -                                                                         |
| `Power?`                       | `readonly` | `boolean`                                          | [`BaseUpdateDeviceData`](README.md#baseupdatedevicedata).`Power`          |
| `SetCoolFlowTemperatureZone1?` | `readonly` | `number`                                           | -                                                                         |
| `SetCoolFlowTemperatureZone2?` | `readonly` | `number`                                           | -                                                                         |
| `SetHeatFlowTemperatureZone1?` | `readonly` | `number`                                           | -                                                                         |
| `SetHeatFlowTemperatureZone2?` | `readonly` | `number`                                           | -                                                                         |
| `SetTankWaterTemperature?`     | `readonly` | `number`                                           | -                                                                         |
| `SetTemperatureZone1?`         | `readonly` | `number`                                           | -                                                                         |
| `SetTemperatureZone2?`         | `readonly` | `number`                                           | -                                                                         |

---

### UpdateDeviceDataErv

#### Extends

- [`BaseUpdateDeviceData`](README.md#baseupdatedevicedata)

#### Properties

| Property           | Modifier   | Type                                                                      | Inherited from                                                            |
| :----------------- | :--------- | :------------------------------------------------------------------------ | :------------------------------------------------------------------------ |
| `EffectiveFlags`   | `public`   | `number`                                                                  | [`BaseUpdateDeviceData`](README.md#baseupdatedevicedata).`EffectiveFlags` |
| `Power?`           | `readonly` | `boolean`                                                                 | [`BaseUpdateDeviceData`](README.md#baseupdatedevicedata).`Power`          |
| `SetFanSpeed?`     | `readonly` | \| `auto` \| `very_slow` \| `slow` \| `moderate` \| `fast` \| `very_fast` | -                                                                         |
| `VentilationMode?` | `readonly` | [`VentilationMode`](README.md#ventilationmode)                            | -                                                                         |

---

### WifiData

#### Properties

| Property   | Modifier   | Type                     |
| :--------- | :--------- | :----------------------- |
| `Data`     | `readonly` | (`null` \| `number`)[][] |
| `FromDate` | `readonly` | `string`                 |
| `Labels`   | `readonly` | `string`[]               |
| `ToDate`   | `readonly` | `string`                 |

---

### WifiPostData

#### Properties

| Property  | Modifier   | Type                |
| :-------- | :--------- | :------------------ |
| `devices` | `readonly` | readonly `number`[] |
| `hour`    | `readonly` | `number`            |

## Type Aliases

### DeviceModelAny

```ts
type DeviceModelAny: DeviceModel<"Ata"> | DeviceModel<"Atw"> | DeviceModel<"Erv">;
```

#### Source

[src/models/device.ts:30](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/models/device.ts#L30)

---

### GetDeviceDataAta

```ts
type GetDeviceDataAta: BaseGetDeviceData & SetDeviceDataAta;
```

#### Source

[src/types/ata.ts:74](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/types/ata.ts#L74)

---

### GetDeviceDataAtw

```ts
type GetDeviceDataAtw: BaseGetDeviceData & SetDeviceDataAtw;
```

#### Source

[src/types/atw.ts:81](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/types/atw.ts#L81)

---

### GetDeviceDataErv

```ts
type GetDeviceDataErv: BaseGetDeviceData & SetDeviceDataErv;
```

#### Source

[src/types/erv.ts:47](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/types/erv.ts#L47)

---

### ListDeviceAny

```ts
type ListDeviceAny: ListDeviceAta | ListDeviceAtw | ListDeviceErv;
```

#### Source

[src/types/common.ts:219](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/types/common.ts#L219)

---

### NonEffectiveFlagsKeyOf\<T\>

```ts
type NonEffectiveFlagsKeyOf<T>: Exclude<keyof T, "EffectiveFlags">;
```

#### Type parameters

| Type parameter |
| :------------- |
| `T`            |

#### Source

[src/types/bases.ts:19](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/types/bases.ts#L19)

---

### NonEffectiveFlagsValueOf\<T\>

```ts
type NonEffectiveFlagsValueOf<T>: T[NonEffectiveFlagsKeyOf<T>];
```

#### Type parameters

| Type parameter |
| :------------- |
| `T`            |

#### Source

[src/types/bases.ts:21](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/types/bases.ts#L21)

---

### TilesPostData\<T\>

```ts
type TilesPostData<T>: T extends keyof typeof DeviceType ? {
  SelectedBuilding: number;
  SelectedDevice: number;
 } : {
  SelectedBuilding: null;
  SelectedDevice: null;
 } & {
  DeviceIDs: readonly number[];
};
```

#### Type declaration

| Member      | Type                |
| :---------- | :------------------ |
| `DeviceIDs` | readonly `number`[] |

#### Type parameters

| Type parameter                                                              |
| :-------------------------------------------------------------------------- |
| `T` _extends_ keyof _typeof_ [`DeviceType`](README.md#devicetype) \| `null` |

#### Source

[src/types/common.ts:276](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/types/common.ts#L276)

## Variables

### FLAG_UNCHANGED

```ts
const FLAG_UNCHANGED: 0 = 0x0
```

#### Source

[src/types/bases.ts:1](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/types/bases.ts#L1)

---

### effectiveFlagsAta

```ts
const effectiveFlagsAta: Record<
  NonEffectiveFlagsKeyOf<UpdateDeviceDataAta>,
  number
>
```

#### Source

[src/types/ata.ts:50](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/types/ata.ts#L50)

---

### effectiveFlagsAtw

```ts
const effectiveFlagsAtw: Record<
  NonEffectiveFlagsKeyOf<UpdateDeviceDataAtw>,
  number
>
```

#### Source

[src/types/atw.ts:42](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/types/atw.ts#L42)

---

### effectiveFlagsErv

```ts
const effectiveFlagsErv: Record<
  NonEffectiveFlagsKeyOf<UpdateDeviceDataErv>,
  number
>
```

#### Source

[src/types/erv.ts:24](https://github.com/OlivierZal/melcloud-api/blob/e0744f68a57c98d79f675368d1a091bb07d8a3ad/src/types/erv.ts#L24)
