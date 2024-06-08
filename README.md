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

### AreaFacade\<T\>

#### Type parameters

| Type parameter                   |
| :------------------------------- |
| `T` _extends_ `number` \| `null` |

#### Implements

- [`IAreaFacade`](README.md#iareafacade)

#### Constructors

##### new AreaFacade()

```ts
new AreaFacade<T>(api: default, id: number): AreaFacade<T>
```

###### Parameters

| Parameter | Type                           |
| :-------- | :----------------------------- |
| `api`     | [`default`](README.md#default) |
| `id`      | `number`                       |

###### Returns

[`AreaFacade`](README.md#areafacadet)\<`T`\>

###### Source

[src/facades/area.ts:23](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/area.ts#L23)

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

[`IAreaFacade`](README.md#iareafacade).`getErrors`

###### Source

[src/facades/area.ts:36](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/area.ts#L36)

##### getFrostProtection()

```ts
getFrostProtection(): Promise<FrostProtectionData>
```

###### Returns

`Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>

###### Implementation of

[`IAreaFacade`](README.md#iareafacade).`getFrostProtection`

###### Source

[src/facades/area.ts:46](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/area.ts#L46)

##### getHolidayMode()

```ts
getHolidayMode(): Promise<HolidayModeData>
```

###### Returns

`Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>

###### Implementation of

[`IAreaFacade`](README.md#iareafacade).`getHolidayMode`

###### Source

[src/facades/area.ts:63](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/area.ts#L63)

##### getTiles()

```ts
getTiles(): Promise<TilesData<null>>
```

###### Returns

`Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\>

###### Implementation of

[`IAreaFacade`](README.md#iareafacade).`getTiles`

###### Source

[src/facades/area.ts:80](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/area.ts#L80)

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

[`IAreaFacade`](README.md#iareafacade).`setAtaGroup`

###### Source

[src/facades/area.ts:88](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/area.ts#L88)

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

[`IAreaFacade`](README.md#iareafacade).`setFrostProtection`

###### Source

[src/facades/area.ts:98](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/area.ts#L98)

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

[`IAreaFacade`](README.md#iareafacade).`setHolidayMode`

###### Source

[src/facades/area.ts:113](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/area.ts#L113)

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

[`IAreaFacade`](README.md#iareafacade).`setPower`

###### Source

[src/facades/area.ts:130](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/area.ts#L130)

---

### AreaModel\<T\>

#### Type parameters

| Type parameter                   |
| :------------------------------- |
| `T` _extends_ `number` \| `null` |

#### Implements

- [`IAreaModel`](README.md#iareamodel)

#### Properties

| Property     | Modifier   | Type                                                        | Default value |
| :----------- | :--------- | :---------------------------------------------------------- | :------------ |
| `buildingId` | `readonly` | `number`                                                    | `undefined`   |
| `floorId`    | `readonly` | `null` \| `number`                                          | `undefined`   |
| `id`         | `readonly` | `number`                                                    | `undefined`   |
| `name`       | `readonly` | `string`                                                    | `undefined`   |
| `areas`      | `readonly` | `Map`\<`number`, [`AreaModelAny`](README.md#areamodelany)\> | `...`         |

#### Accessors

##### building

```ts
get building(): null | BuildingModel
```

###### Returns

`null` \| [`BuildingModel`](README.md#buildingmodel)

###### Source

[src/models/area.ts:36](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/area.ts#L36)

##### deviceIds

```ts
get deviceIds(): number[]
```

###### Returns

`number`[]

###### Source

[src/models/area.ts:40](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/area.ts#L40)

##### devices

```ts
get devices(): DeviceModelAny[]
```

###### Returns

[`DeviceModelAny`](README.md#devicemodelany)[]

###### Source

[src/models/area.ts:44](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/area.ts#L44)

##### floor

```ts
get floor(): null | FloorModel
```

###### Returns

`null` \| [`FloorModel`](README.md#floormodel)

###### Source

[src/models/area.ts:48](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/area.ts#L48)

#### Methods

##### getAll()

```ts
static getAll(): AreaModelAny[]
```

###### Returns

[`AreaModelAny`](README.md#areamodelany)[]

###### Source

[src/models/area.ts:54](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/area.ts#L54)

##### getByBuildingId()

```ts
static getByBuildingId(buildingId: number): AreaModelAny[]
```

###### Parameters

| Parameter    | Type     |
| :----------- | :------- |
| `buildingId` | `number` |

###### Returns

[`AreaModelAny`](README.md#areamodelany)[]

###### Source

[src/models/area.ts:58](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/area.ts#L58)

##### getById()

```ts
static getById(id: number): undefined | AreaModelAny
```

###### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `id`      | `number` |

###### Returns

`undefined` \| [`AreaModelAny`](README.md#areamodelany)

###### Source

[src/models/area.ts:62](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/area.ts#L62)

##### getByName()

```ts
static getByName(areaName: string): undefined | AreaModelAny
```

###### Parameters

| Parameter  | Type     |
| :--------- | :------- |
| `areaName` | `string` |

###### Returns

`undefined` \| [`AreaModelAny`](README.md#areamodelany)

###### Source

[src/models/area.ts:66](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/area.ts#L66)

##### upsert()

```ts
static upsert(data: AreaDataAny): void
```

###### Parameters

| Parameter | Type                                   |
| :-------- | :------------------------------------- |
| `data`    | [`AreaDataAny`](README.md#areadataany) |

###### Returns

`void`

###### Source

[src/models/area.ts:70](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/area.ts#L70)

---

### BuildingFacade

#### Implements

- [`IBuildingFacade`](README.md#ibuildingfacade)

#### Constructors

##### new BuildingFacade()

```ts
new BuildingFacade(api: default, id: number): BuildingFacade
```

###### Parameters

| Parameter | Type                           |
| :-------- | :----------------------------- |
| `api`     | [`default`](README.md#default) |
| `id`      | `number`                       |

###### Returns

[`BuildingFacade`](README.md#buildingfacade)

###### Source

[src/facades/building.ts:24](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/building.ts#L24)

#### Methods

##### fetch()

```ts
fetch(): Promise<BuildingSettings>
```

###### Returns

`Promise`\<[`BuildingSettings`](README.md#buildingsettings)\>

###### Implementation of

[`IBuildingFacade`](README.md#ibuildingfacade).`fetch`

###### Source

[src/facades/building.ts:37](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/building.ts#L37)

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

[`IBuildingFacade`](README.md#ibuildingfacade).`getErrors`

###### Source

[src/facades/building.ts:42](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/building.ts#L42)

##### getFrostProtection()

```ts
getFrostProtection(): Promise<FrostProtectionData>
```

###### Returns

`Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>

###### Implementation of

[`IBuildingFacade`](README.md#ibuildingfacade).`getFrostProtection`

###### Source

[src/facades/building.ts:52](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/building.ts#L52)

##### getHolidayMode()

```ts
getHolidayMode(): Promise<HolidayModeData>
```

###### Returns

`Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>

###### Implementation of

[`IBuildingFacade`](README.md#ibuildingfacade).`getHolidayMode`

###### Source

[src/facades/building.ts:69](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/building.ts#L69)

##### getTiles()

```ts
getTiles(): Promise<TilesData<null>>
```

###### Returns

`Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\>

###### Implementation of

[`IBuildingFacade`](README.md#ibuildingfacade).`getTiles`

###### Source

[src/facades/building.ts:86](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/building.ts#L86)

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

[`IBuildingFacade`](README.md#ibuildingfacade).`setAtaGroup`

###### Source

[src/facades/building.ts:94](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/building.ts#L94)

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

[`IBuildingFacade`](README.md#ibuildingfacade).`setFrostProtection`

###### Source

[src/facades/building.ts:107](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/building.ts#L107)

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

[`IBuildingFacade`](README.md#ibuildingfacade).`setHolidayMode`

###### Source

[src/facades/building.ts:122](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/building.ts#L122)

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

[`IBuildingFacade`](README.md#ibuildingfacade).`setPower`

###### Source

[src/facades/building.ts:139](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/building.ts#L139)

---

### BuildingModel

#### Implements

- [`IBuildingModel`](README.md#ibuildingmodel)

#### Properties

| Property    | Modifier   | Type                                                          | Default value |
| :---------- | :--------- | :------------------------------------------------------------ | :------------ |
| `data`      | `readonly` | [`BuildingSettings`](README.md#buildingsettings)              | `undefined`   |
| `id`        | `readonly` | `number`                                                      | `undefined`   |
| `name`      | `readonly` | `string`                                                      | `undefined`   |
| `buildings` | `readonly` | `Map`\<`number`, [`BuildingModel`](README.md#buildingmodel)\> | `...`         |

#### Accessors

##### deviceIds

```ts
get deviceIds(): number[]
```

###### Returns

`number`[]

###### Source

[src/models/building.ts:24](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/building.ts#L24)

##### devices

```ts
get devices(): DeviceModelAny[]
```

###### Returns

[`DeviceModelAny`](README.md#devicemodelany)[]

###### Source

[src/models/building.ts:28](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/building.ts#L28)

#### Methods

##### getAll()

```ts
static getAll(): BuildingModel[]
```

###### Returns

[`BuildingModel`](README.md#buildingmodel)[]

###### Source

[src/models/building.ts:34](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/building.ts#L34)

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

[src/models/building.ts:38](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/building.ts#L38)

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

[src/models/building.ts:42](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/building.ts#L42)

##### upsert()

```ts
static upsert(data: BuildingData): void
```

###### Parameters

| Parameter | Type                                     |
| :-------- | :--------------------------------------- |
| `data`    | [`BuildingData`](README.md#buildingdata) |

###### Returns

`void`

###### Source

[src/models/building.ts:46](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/building.ts#L46)

---

### DeviceFacade\<T\>

#### Type parameters

| Type parameter                                                    |
| :---------------------------------------------------------------- |
| `T` _extends_ keyof _typeof_ [`DeviceType`](README.md#devicetype) |

#### Implements

- [`IDeviceFacade`](README.md#idevicefacadet)\<`T`\>

#### Constructors

##### new DeviceFacade()

```ts
new DeviceFacade<T>(api: default, id: number): DeviceFacade<T>
```

###### Parameters

| Parameter | Type                           |
| :-------- | :----------------------------- |
| `api`     | [`default`](README.md#default) |
| `id`      | `number`                       |

###### Returns

[`DeviceFacade`](README.md#devicefacadet)\<`T`\>

###### Source

[src/facades/device.ts:31](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/device.ts#L31)

#### Methods

##### fetch()

```ts
fetch(): Promise<ListDevice[T]["Device"]>
```

###### Returns

`Promise`\<[`ListDevice`](README.md#listdevice)\[`T`\]\[`"Device"`\]\>

###### Implementation of

[`IDeviceFacade`](README.md#idevicefacadet).`fetch`

###### Source

[src/facades/device.ts:44](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/device.ts#L44)

##### get()

```ts
get(): Promise<GetDeviceData[T]>
```

###### Returns

`Promise`\<[`GetDeviceData`](README.md#getdevicedata)\[`T`\]\>

###### Implementation of

[`IDeviceFacade`](README.md#idevicefacadet).`get`

###### Source

[src/facades/device.ts:49](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/device.ts#L49)

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

[`IDeviceFacade`](README.md#idevicefacadet).`getEnergyReport`

###### Source

[src/facades/device.ts:57](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/device.ts#L57)

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

[`IDeviceFacade`](README.md#idevicefacadet).`getErrors`

###### Source

[src/facades/device.ts:67](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/device.ts#L67)

##### getFrostProtection()

```ts
getFrostProtection(): Promise<FrostProtectionData>
```

###### Returns

`Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>

###### Implementation of

[`IDeviceFacade`](README.md#idevicefacadet).`getFrostProtection`

###### Source

[src/facades/device.ts:77](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/device.ts#L77)

##### getHolidayMode()

```ts
getHolidayMode(): Promise<HolidayModeData>
```

###### Returns

`Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>

###### Implementation of

[`IDeviceFacade`](README.md#idevicefacadet).`getHolidayMode`

###### Source

[src/facades/device.ts:85](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/device.ts#L85)

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

`IDeviceFacade.getTile`

###### Source

[src/facades/device.ts:93](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/device.ts#L93)

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

`IDeviceFacade.getTile`

###### Source

[src/facades/device.ts:94](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/device.ts#L94)

##### set()

```ts
set(postData: UpdateDeviceData[T]): Promise<SetDeviceData[T]>
```

###### Parameters

| Parameter  | Type                                                    |
| :--------- | :------------------------------------------------------ |
| `postData` | [`UpdateDeviceData`](README.md#updatedevicedata)\[`T`\] |

###### Returns

`Promise`\<[`SetDeviceData`](README.md#setdevicedata)\[`T`\]\>

###### Implementation of

[`IDeviceFacade`](README.md#idevicefacadet).`set`

###### Source

[src/facades/device.ts:115](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/device.ts#L115)

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

[`IDeviceFacade`](README.md#idevicefacadet).`setFrostProtection`

###### Source

[src/facades/device.ts:124](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/device.ts#L124)

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

[`IDeviceFacade`](README.md#idevicefacadet).`setHolidayMode`

###### Source

[src/facades/device.ts:134](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/device.ts#L134)

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

[`IDeviceFacade`](README.md#idevicefacadet).`setPower`

###### Source

[src/facades/device.ts:147](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/device.ts#L147)

---

### DeviceModel\<T\>

#### Type parameters

| Type parameter                                                    |
| :---------------------------------------------------------------- |
| `T` _extends_ keyof _typeof_ [`DeviceType`](README.md#devicetype) |

#### Implements

- [`IDeviceModel`](README.md#idevicemodelt)\<`T`\>

#### Properties

| Property     | Modifier   | Type                                                            | Default value |
| :----------- | :--------- | :-------------------------------------------------------------- | :------------ |
| `areaId`     | `readonly` | `null` \| `number`                                              | `null`        |
| `buildingId` | `readonly` | `number`                                                        | `undefined`   |
| `data`       | `readonly` | [`ListDevice`](README.md#listdevice)\[`T`\]\[`"Device"`\]       | `undefined`   |
| `floorId`    | `readonly` | `null` \| `number`                                              | `null`        |
| `id`         | `readonly` | `number`                                                        | `undefined`   |
| `name`       | `readonly` | `string`                                                        | `undefined`   |
| `type`       | `readonly` | `T`                                                             | `undefined`   |
| `devices`    | `readonly` | `Map`\<`number`, [`DeviceModelAny`](README.md#devicemodelany)\> | `...`         |

#### Accessors

##### area

```ts
get area(): null | AreaModelAny
```

###### Returns

`null` \| [`AreaModelAny`](README.md#areamodelany)

###### Source

[src/models/device.ts:53](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/device.ts#L53)

##### building

```ts
get building(): null | BuildingModel
```

###### Returns

`null` \| [`BuildingModel`](README.md#buildingmodel)

###### Source

[src/models/device.ts:57](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/device.ts#L57)

##### floor

```ts
get floor(): null | FloorModel
```

###### Returns

`null` \| [`FloorModel`](README.md#floormodel)

###### Source

[src/models/device.ts:61](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/device.ts#L61)

#### Methods

##### getAll()

```ts
static getAll(): DeviceModelAny[]
```

###### Returns

[`DeviceModelAny`](README.md#devicemodelany)[]

###### Source

[src/models/device.ts:67](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/device.ts#L67)

##### getByBuildingId()

```ts
static getByBuildingId(buildingId: number): DeviceModelAny[]
```

###### Parameters

| Parameter    | Type     |
| :----------- | :------- |
| `buildingId` | `number` |

###### Returns

[`DeviceModelAny`](README.md#devicemodelany)[]

###### Source

[src/models/device.ts:71](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/device.ts#L71)

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

[src/models/device.ts:75](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/device.ts#L75)

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

[src/models/device.ts:79](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/device.ts#L79)

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

[src/models/device.ts:83](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/device.ts#L83)

##### upsert()

```ts
static upsert(data: ListDeviceAny): void
```

###### Parameters

| Parameter | Type                                       |
| :-------- | :----------------------------------------- |
| `data`    | [`ListDeviceAny`](README.md#listdeviceany) |

###### Returns

`void`

###### Source

[src/models/device.ts:89](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/device.ts#L89)

##### upsertMany()

```ts
static upsertMany(dataList: readonly ListDeviceAny[]): void
```

###### Parameters

| Parameter  | Type                                                  |
| :--------- | :---------------------------------------------------- |
| `dataList` | readonly [`ListDeviceAny`](README.md#listdeviceany)[] |

###### Returns

`void`

###### Source

[src/models/device.ts:93](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/device.ts#L93)

---

### FloorFacade

#### Implements

- [`IFloorFacade`](README.md#ifloorfacade)

#### Constructors

##### new FloorFacade()

```ts
new FloorFacade(api: default, id: number): FloorFacade
```

###### Parameters

| Parameter | Type                           |
| :-------- | :----------------------------- |
| `api`     | [`default`](README.md#default) |
| `id`      | `number`                       |

###### Returns

[`FloorFacade`](README.md#floorfacade)

###### Source

[src/facades/floor.ts:23](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/floor.ts#L23)

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

[`IFloorFacade`](README.md#ifloorfacade).`getErrors`

###### Source

[src/facades/floor.ts:36](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/floor.ts#L36)

##### getFrostProtection()

```ts
getFrostProtection(): Promise<FrostProtectionData>
```

###### Returns

`Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>

###### Implementation of

[`IFloorFacade`](README.md#ifloorfacade).`getFrostProtection`

###### Source

[src/facades/floor.ts:46](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/floor.ts#L46)

##### getHolidayMode()

```ts
getHolidayMode(): Promise<HolidayModeData>
```

###### Returns

`Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>

###### Implementation of

[`IFloorFacade`](README.md#ifloorfacade).`getHolidayMode`

###### Source

[src/facades/floor.ts:63](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/floor.ts#L63)

##### getTiles()

```ts
getTiles(): Promise<TilesData<null>>
```

###### Returns

`Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\>

###### Implementation of

[`IFloorFacade`](README.md#ifloorfacade).`getTiles`

###### Source

[src/facades/floor.ts:80](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/floor.ts#L80)

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

[`IFloorFacade`](README.md#ifloorfacade).`setAtaGroup`

###### Source

[src/facades/floor.ts:88](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/floor.ts#L88)

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

[`IFloorFacade`](README.md#ifloorfacade).`setFrostProtection`

###### Source

[src/facades/floor.ts:98](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/floor.ts#L98)

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

[`IFloorFacade`](README.md#ifloorfacade).`setHolidayMode`

###### Source

[src/facades/floor.ts:113](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/floor.ts#L113)

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

[`IFloorFacade`](README.md#ifloorfacade).`setPower`

###### Source

[src/facades/floor.ts:130](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/facades/floor.ts#L130)

---

### FloorModel

#### Implements

- [`IFloorModel`](README.md#ifloormodel)

#### Properties

| Property     | Modifier   | Type                                                    | Default value |
| :----------- | :--------- | :------------------------------------------------------ | :------------ |
| `buildingId` | `readonly` | `number`                                                | `undefined`   |
| `id`         | `readonly` | `number`                                                | `undefined`   |
| `name`       | `readonly` | `string`                                                | `undefined`   |
| `floors`     | `readonly` | `Map`\<`number`, [`FloorModel`](README.md#floormodel)\> | `...`         |

#### Accessors

##### areaIds

```ts
get areaIds(): number[]
```

###### Returns

`number`[]

###### Source

[src/models/floor.ts:30](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/floor.ts#L30)

##### areas

```ts
get areas(): AreaModel<number>[]
```

###### Returns

[`AreaModel`](README.md#areamodelt)\<`number`\>[]

###### Source

[src/models/floor.ts:34](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/floor.ts#L34)

##### building

```ts
get building(): null | BuildingModel
```

###### Returns

`null` \| [`BuildingModel`](README.md#buildingmodel)

###### Source

[src/models/floor.ts:40](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/floor.ts#L40)

##### deviceIds

```ts
get deviceIds(): number[]
```

###### Returns

`number`[]

###### Source

[src/models/floor.ts:44](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/floor.ts#L44)

##### devices

```ts
get devices(): DeviceModelAny[]
```

###### Returns

[`DeviceModelAny`](README.md#devicemodelany)[]

###### Source

[src/models/floor.ts:48](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/floor.ts#L48)

#### Methods

##### getAll()

```ts
static getAll(): FloorModel[]
```

###### Returns

[`FloorModel`](README.md#floormodel)[]

###### Source

[src/models/floor.ts:52](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/floor.ts#L52)

##### getByBuildingId()

```ts
static getByBuildingId(buildingId: number): FloorModel[]
```

###### Parameters

| Parameter    | Type     |
| :----------- | :------- |
| `buildingId` | `number` |

###### Returns

[`FloorModel`](README.md#floormodel)[]

###### Source

[src/models/floor.ts:56](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/floor.ts#L56)

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

[src/models/floor.ts:60](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/floor.ts#L60)

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

[src/models/floor.ts:64](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/floor.ts#L64)

##### upsert()

```ts
static upsert(data: FloorData): void
```

###### Parameters

| Parameter | Type                               |
| :-------- | :--------------------------------- |
| `data`    | [`FloorData`](README.md#floordata) |

###### Returns

`void`

###### Source

[src/models/floor.ts:68](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/floor.ts#L68)

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

[src/services/api.ts:80](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/services/api.ts#L80)

#### Properties

| Property   | Modifier | Type                             |
| :--------- | :------- | :------------------------------- |
| `language` | `public` | [`Language`](README.md#language) |

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

[src/services/api.ts:148](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/services/api.ts#L148)

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

[src/services/api.ts:179](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/services/api.ts#L179)

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

[src/services/api.ts:202](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/services/api.ts#L202)

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

[src/services/api.ts:212](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/services/api.ts#L212)

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

[src/services/api.ts:220](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/services/api.ts#L220)

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

[src/services/api.ts:231](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/services/api.ts#L231)

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

[src/services/api.ts:241](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/services/api.ts#L241)

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

[src/services/api.ts:251](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/services/api.ts#L251)

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

[src/services/api.ts:256](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/services/api.ts#L256)

##### getWifiReport()

```ts
getWifiReport(__namedParameters: {
  postData: WifiPostData;
 }): Promise<{
  data: WifiData;
}>
```

###### Parameters

| Parameter                    | Type                                     |
| :--------------------------- | :--------------------------------------- |
| `__namedParameters`          | `object`                                 |
| `__namedParameters.postData` | [`WifiPostData`](README.md#wifipostdata) |

###### Returns

`Promise`\<\{
`data`: [`WifiData`](README.md#wifidata);
\}\>

| Member | Type                             |
| :----- | :------------------------------- |
| `data` | [`WifiData`](README.md#wifidata) |

###### Implementation of

[`IMELCloudAPI`](README.md#imelcloudapi).`getWifiReport`

###### Source

[src/services/api.ts:269](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/services/api.ts#L269)

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

[src/services/api.ts:277](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/services/api.ts#L277)

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

[src/services/api.ts:296](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/services/api.ts#L296)

##### setDevice()

```ts
setDevice<T>(__namedParameters: {
  heatPumpType: T;
  postData: SetDevicePostData<T>;
 }): Promise<{
  data: SetDeviceData[T];
}>
```

###### Type parameters

| Type parameter                              |
| :------------------------------------------ |
| `T` _extends_ `"Ata"` \| `"Atw"` \| `"Erv"` |

###### Parameters

| Parameter                        | Type                                                       |
| :------------------------------- | :--------------------------------------------------------- |
| `__namedParameters`              | `object`                                                   |
| `__namedParameters.heatPumpType` | `T`                                                        |
| `__namedParameters.postData`     | [`SetDevicePostData`](README.md#setdevicepostdatat)\<`T`\> |

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

[src/services/api.ts:311](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/services/api.ts#L311)

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

[src/services/api.ts:324](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/services/api.ts#L324)

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

[src/services/api.ts:335](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/services/api.ts#L335)

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

[src/services/api.ts:346](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/services/api.ts#L346)

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

[src/services/api.ts:360](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/services/api.ts#L360)

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

### AreaData\<T\>

#### Extends

- [`FloorData`](README.md#floordata)

#### Type parameters

| Type parameter                   |
| :------------------------------- |
| `T` _extends_ `number` \| `null` |

#### Properties

| Property     | Modifier   | Type     | Inherited from                                  |
| :----------- | :--------- | :------- | :---------------------------------------------- |
| `BuildingId` | `readonly` | `number` | [`FloorData`](README.md#floordata).`BuildingId` |
| `FloorId`    | `readonly` | `T`      | -                                               |
| `ID`         | `readonly` | `number` | [`FloorData`](README.md#floordata).`ID`         |
| `Name`       | `readonly` | `string` | [`FloorData`](README.md#floordata).`Name`       |

---

### BaseDevicePostData

#### Extended by

- [`EnergyPostData`](README.md#energypostdata)

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

| Property            | Modifier   | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Inherited from                                              |
| :------------------ | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| `FPDefined`         | `readonly` | `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [`BuildingData`](README.md#buildingdata).`FPDefined`        |
| `FPEnabled`         | `readonly` | `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [`BuildingData`](README.md#buildingdata).`FPEnabled`        |
| `FPMaxTemperature`  | `readonly` | `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | [`BuildingData`](README.md#buildingdata).`FPMaxTemperature` |
| `FPMinTemperature`  | `readonly` | `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | [`BuildingData`](README.md#buildingdata).`FPMinTemperature` |
| `HMDefined`         | `readonly` | `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [`BuildingData`](README.md#buildingdata).`HMDefined`        |
| `HMEnabled`         | `readonly` | `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [`BuildingData`](README.md#buildingdata).`HMEnabled`        |
| `HMEndDate`         | `readonly` | `null` \| `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | [`BuildingData`](README.md#buildingdata).`HMEndDate`        |
| `HMStartDate`       | `readonly` | `null` \| `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | [`BuildingData`](README.md#buildingdata).`HMStartDate`      |
| `ID`                | `readonly` | `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | [`BuildingData`](README.md#buildingdata).`ID`               |
| `Name`              | `readonly` | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | [`BuildingData`](README.md#buildingdata).`Name`             |
| `Structure`         | `readonly` | \{ `Areas`: readonly [`AreaData`](README.md#areadatat)\<`null`\> & \{ `Devices`: readonly [`ListDeviceAny`](README.md#listdeviceany)[]; \}[]; `Devices`: readonly [`ListDeviceAny`](README.md#listdeviceany)[]; `Floors`: readonly [`FloorData`](README.md#floordata) & \{ `Areas`: readonly [`AreaData`](README.md#areadatat)\<`number`\> & \{ `Devices`: readonly [`ListDeviceAny`](README.md#listdeviceany)[]; \}[]; `Devices`: readonly [`ListDeviceAny`](README.md#listdeviceany)[]; \}[]; \} | -                                                           |
| `Structure.Areas`   | `readonly` | readonly [`AreaData`](README.md#areadatat)\<`null`\> & \{ `Devices`: readonly [`ListDeviceAny`](README.md#listdeviceany)[]; \}[]                                                                                                                                                                                                                                                                                                                                                                   | -                                                           |
| `Structure.Devices` | `public`   | readonly [`ListDeviceAny`](README.md#listdeviceany)[]                                                                                                                                                                                                                                                                                                                                                                                                                                              | -                                                           |
| `Structure.Floors`  | `public`   | readonly [`FloorData`](README.md#floordata) & \{ `Areas`: readonly [`AreaData`](README.md#areadatat)\<`number`\> & \{ `Devices`: readonly [`ListDeviceAny`](README.md#listdeviceany)[]; \}[]; `Devices`: readonly [`ListDeviceAny`](README.md#listdeviceany)[]; \}[]                                                                                                                                                                                                                               | -                                                           |
| `TimeZone`          | `public`   | `number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | [`BuildingData`](README.md#buildingdata).`TimeZone`         |

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

### FloorData

#### Extended by

- [`AreaData`](README.md#areadatat)

#### Properties

| Property     | Modifier   | Type     |
| :----------- | :--------- | :------- |
| `BuildingId` | `readonly` | `number` |
| `ID`         | `readonly` | `number` |
| `Name`       | `readonly` | `string` |

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

### IAreaFacade

#### Extends

- [`IBaseFacade`](README.md#ibasefacade).[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade)

#### Properties

| Property             | Type                                                                                                                                                                                                     | Inherited from                                                             |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------- |
| `getErrors`          | (`postData`: `Omit`\<[`ErrorPostData`](README.md#errorpostdata), `"DeviceIDs"`\>) => `Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>                         | [`IBaseFacade`](README.md#ibasefacade).`getErrors`                         |
| `getFrostProtection` | () => `Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>                                                                                                                                | [`IBaseFacade`](README.md#ibasefacade).`getFrostProtection`                |
| `getHolidayMode`     | () => `Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>                                                                                                                                        | [`IBaseFacade`](README.md#ibasefacade).`getHolidayMode`                    |
| `getTiles`           | () => `Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\>                                                                                                                                         | [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getTiles`    |
| `setAtaGroup`        | (`postData`: `Omit`\<[`SetAtaGroupPostData`](README.md#setatagrouppostdata), `"Specification"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>       | [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`setAtaGroup` |
| `setFrostProtection` | (`postData`: `Omit`\<[`FrostProtectionPostData`](README.md#frostprotectionpostdata), `"BuildingIds"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> | [`IBaseFacade`](README.md#ibasefacade).`setFrostProtection`                |
| `setHolidayMode`     | (`postData`: `Omit`\<[`HolidayModePostData`](README.md#holidaymodepostdata), `"HMTimeZones"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>         | [`IBaseFacade`](README.md#ibasefacade).`setHolidayMode`                    |
| `setPower`           | (`postData`: `Omit`\<[`SetPowerPostData`](README.md#setpowerpostdata), `"DeviceIds"`\>) => `Promise`\<`boolean`\>                                                                                        | [`IBaseFacade`](README.md#ibasefacade).`setPower`                          |

---

### IAreaModel

#### Extends

- [`IBaseModel`](README.md#ibasemodel).[`IBaseSubBuildingModel`](README.md#ibasesubbuildingmodel).[`IBaseSubFloorModel`](README.md#ibasesubfloormodel).[`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel)

#### Properties

| Property     | Modifier   | Type                                                 | Inherited from                                                          |
| :----------- | :--------- | :--------------------------------------------------- | :---------------------------------------------------------------------- |
| `building`   | `readonly` | `null` \| [`BuildingModel`](README.md#buildingmodel) | [`IBaseSubBuildingModel`](README.md#ibasesubbuildingmodel).`building`   |
| `buildingId` | `readonly` | `number`                                             | [`IBaseSubBuildingModel`](README.md#ibasesubbuildingmodel).`buildingId` |
| `deviceIds`  | `readonly` | `number`[]                                           | [`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel).`deviceIds`  |
| `devices`    | `readonly` | [`DeviceModelAny`](README.md#devicemodelany)[]       | [`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel).`devices`    |
| `floor`      | `readonly` | `null` \| [`FloorModel`](README.md#floormodel)       | [`IBaseSubFloorModel`](README.md#ibasesubfloormodel).`floor`            |
| `floorId`    | `readonly` | `null` \| `number`                                   | [`IBaseSubFloorModel`](README.md#ibasesubfloormodel).`floorId`          |
| `id`         | `readonly` | `number`                                             | [`IBaseModel`](README.md#ibasemodel).`id`                               |
| `name`       | `readonly` | `string`                                             | [`IBaseModel`](README.md#ibasemodel).`name`                             |

---

### IBaseFacade

#### Extended by

- [`IAreaFacade`](README.md#iareafacade)
- [`IBuildingFacade`](README.md#ibuildingfacade)
- [`IDeviceFacade`](README.md#idevicefacadet)
- [`IFloorFacade`](README.md#ifloorfacade)

#### Properties

| Property             | Type                                                                                                                                                                                                     |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getErrors`          | (`postData`: `Omit`\<[`ErrorPostData`](README.md#errorpostdata), `"DeviceIDs"`\>) => `Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>                         |
| `getFrostProtection` | () => `Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>                                                                                                                                |
| `getHolidayMode`     | () => `Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>                                                                                                                                        |
| `setFrostProtection` | (`postData`: `Omit`\<[`FrostProtectionPostData`](README.md#frostprotectionpostdata), `"BuildingIds"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> |
| `setHolidayMode`     | (`postData`: `Omit`\<[`HolidayModePostData`](README.md#holidaymodepostdata), `"HMTimeZones"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>         |
| `setPower`           | (`postData`: `Omit`\<[`SetPowerPostData`](README.md#setpowerpostdata), `"DeviceIds"`\>) => `Promise`\<`boolean`\>                                                                                        |

---

### IBaseModel

#### Extended by

- [`IAreaModel`](README.md#iareamodel)
- [`IBuildingModel`](README.md#ibuildingmodel)
- [`IDeviceModel`](README.md#idevicemodelt)
- [`IFloorModel`](README.md#ifloormodel)

#### Properties

| Property | Modifier   | Type     |
| :------- | :--------- | :------- |
| `id`     | `readonly` | `number` |
| `name`   | `readonly` | `string` |

---

### IBaseSubBuildingModel

#### Extended by

- [`IAreaModel`](README.md#iareamodel)
- [`IDeviceModel`](README.md#idevicemodelt)
- [`IFloorModel`](README.md#ifloormodel)

#### Properties

| Property     | Modifier   | Type                                                 |
| :----------- | :--------- | :--------------------------------------------------- |
| `building`   | `readonly` | `null` \| [`BuildingModel`](README.md#buildingmodel) |
| `buildingId` | `readonly` | `number`                                             |

---

### IBaseSubFloorModel

#### Extended by

- [`IAreaModel`](README.md#iareamodel)
- [`IDeviceModel`](README.md#idevicemodelt)

#### Properties

| Property  | Modifier   | Type                                           |
| :-------- | :--------- | :--------------------------------------------- |
| `floor`   | `readonly` | `null` \| [`FloorModel`](README.md#floormodel) |
| `floorId` | `readonly` | `null` \| `number`                             |

---

### IBaseSuperDeviceFacade

#### Extended by

- [`IAreaFacade`](README.md#iareafacade)
- [`IBuildingFacade`](README.md#ibuildingfacade)
- [`IFloorFacade`](README.md#ifloorfacade)

#### Properties

| Property      | Type                                                                                                                                                                                               |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getTiles`    | () => `Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\>                                                                                                                                   |
| `setAtaGroup` | (`postData`: `Omit`\<[`SetAtaGroupPostData`](README.md#setatagrouppostdata), `"Specification"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> |

---

### IBaseSuperDeviceModel

#### Extended by

- [`IAreaModel`](README.md#iareamodel)
- [`IBuildingModel`](README.md#ibuildingmodel)
- [`IFloorModel`](README.md#ifloormodel)

#### Properties

| Property    | Modifier   | Type                                           |
| :---------- | :--------- | :--------------------------------------------- |
| `deviceIds` | `readonly` | `number`[]                                     |
| `devices`   | `readonly` | [`DeviceModelAny`](README.md#devicemodelany)[] |

---

### IBuildingFacade

#### Extends

- [`IBaseFacade`](README.md#ibasefacade).[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade)

#### Properties

| Property             | Type                                                                                                                                                                                                     | Inherited from                                                             |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------- |
| `fetch`              | () => `Promise`\<[`BuildingSettings`](README.md#buildingsettings)\>                                                                                                                                      | -                                                                          |
| `getErrors`          | (`postData`: `Omit`\<[`ErrorPostData`](README.md#errorpostdata), `"DeviceIDs"`\>) => `Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>                         | [`IBaseFacade`](README.md#ibasefacade).`getErrors`                         |
| `getFrostProtection` | () => `Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>                                                                                                                                | [`IBaseFacade`](README.md#ibasefacade).`getFrostProtection`                |
| `getHolidayMode`     | () => `Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>                                                                                                                                        | [`IBaseFacade`](README.md#ibasefacade).`getHolidayMode`                    |
| `getTiles`           | () => `Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\>                                                                                                                                         | [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getTiles`    |
| `setAtaGroup`        | (`postData`: `Omit`\<[`SetAtaGroupPostData`](README.md#setatagrouppostdata), `"Specification"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>       | [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`setAtaGroup` |
| `setFrostProtection` | (`postData`: `Omit`\<[`FrostProtectionPostData`](README.md#frostprotectionpostdata), `"BuildingIds"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> | [`IBaseFacade`](README.md#ibasefacade).`setFrostProtection`                |
| `setHolidayMode`     | (`postData`: `Omit`\<[`HolidayModePostData`](README.md#holidaymodepostdata), `"HMTimeZones"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>         | [`IBaseFacade`](README.md#ibasefacade).`setHolidayMode`                    |
| `setPower`           | (`postData`: `Omit`\<[`SetPowerPostData`](README.md#setpowerpostdata), `"DeviceIds"`\>) => `Promise`\<`boolean`\>                                                                                        | [`IBaseFacade`](README.md#ibasefacade).`setPower`                          |

---

### IBuildingModel

#### Extends

- [`IBaseModel`](README.md#ibasemodel).[`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel)

#### Properties

| Property    | Modifier   | Type                                             | Inherited from                                                         |
| :---------- | :--------- | :----------------------------------------------- | :--------------------------------------------------------------------- |
| `data`      | `readonly` | [`BuildingSettings`](README.md#buildingsettings) | -                                                                      |
| `deviceIds` | `readonly` | `number`[]                                       | [`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel).`deviceIds` |
| `devices`   | `readonly` | [`DeviceModelAny`](README.md#devicemodelany)[]   | [`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel).`devices`   |
| `id`        | `readonly` | `number`                                         | [`IBaseModel`](README.md#ibasemodel).`id`                              |
| `name`      | `readonly` | `string`                                         | [`IBaseModel`](README.md#ibasemodel).`name`                            |

---

### IDeviceFacade\<T\>

#### Extends

- [`IBaseFacade`](README.md#ibasefacade)

#### Type parameters

| Type parameter                                                    |
| :---------------------------------------------------------------- |
| `T` _extends_ keyof _typeof_ [`DeviceType`](README.md#devicetype) |

#### Properties

| Property             | Type                                                                                                                                                                                                     | Inherited from                                              |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| `fetch`              | () => `Promise`\<[`ListDevice`](README.md#listdevice)\[`T`\]\[`"Device"`\]\>                                                                                                                             | -                                                           |
| `get`                | () => `Promise`\<[`GetDeviceData`](README.md#getdevicedata)\[`T`\]\>                                                                                                                                     | -                                                           |
| `getEnergyReport`    | (`postData`: `Omit`\<[`EnergyPostData`](README.md#energypostdata), `"DeviceID"`\>) => `Promise`\<[`EnergyData`](README.md#energydata)\[`T`\]\>                                                           | -                                                           |
| `getErrors`          | (`postData`: `Omit`\<[`ErrorPostData`](README.md#errorpostdata), `"DeviceIDs"`\>) => `Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>                         | [`IBaseFacade`](README.md#ibasefacade).`getErrors`          |
| `getFrostProtection` | () => `Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>                                                                                                                                | [`IBaseFacade`](README.md#ibasefacade).`getFrostProtection` |
| `getHolidayMode`     | () => `Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>                                                                                                                                        | [`IBaseFacade`](README.md#ibasefacade).`getHolidayMode`     |
| `getTile`            | (`select`?: `false`) => `Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\> & (`select`: `true`) => `Promise`\<[`TilesData`](README.md#tilesdatat)\<`T`\>\>                                       | -                                                           |
| `set`                | (`postData`: [`UpdateDeviceData`](README.md#updatedevicedata)\[`T`\]) => `Promise`\<[`SetDeviceData`](README.md#setdevicedata)\[`T`\]\>                                                                  | -                                                           |
| `setFrostProtection` | (`postData`: `Omit`\<[`FrostProtectionPostData`](README.md#frostprotectionpostdata), `"BuildingIds"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> | [`IBaseFacade`](README.md#ibasefacade).`setFrostProtection` |
| `setHolidayMode`     | (`postData`: `Omit`\<[`HolidayModePostData`](README.md#holidaymodepostdata), `"HMTimeZones"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>         | [`IBaseFacade`](README.md#ibasefacade).`setHolidayMode`     |
| `setPower`           | (`postData`: `Omit`\<[`SetPowerPostData`](README.md#setpowerpostdata), `"DeviceIds"`\>) => `Promise`\<`boolean`\>                                                                                        | [`IBaseFacade`](README.md#ibasefacade).`setPower`           |

---

### IDeviceModel\<T\>

#### Extends

- [`IBaseModel`](README.md#ibasemodel).[`IBaseSubBuildingModel`](README.md#ibasesubbuildingmodel).[`IBaseSubFloorModel`](README.md#ibasesubfloormodel)

#### Type parameters

| Type parameter                                                    |
| :---------------------------------------------------------------- |
| `T` _extends_ keyof _typeof_ [`DeviceType`](README.md#devicetype) |

#### Properties

| Property     | Modifier   | Type                                                      | Inherited from                                                          |
| :----------- | :--------- | :-------------------------------------------------------- | :---------------------------------------------------------------------- |
| `area`       | `readonly` | `null` \| [`AreaModelAny`](README.md#areamodelany)        | -                                                                       |
| `areaId`     | `readonly` | `null` \| `number`                                        | -                                                                       |
| `building`   | `readonly` | `null` \| [`BuildingModel`](README.md#buildingmodel)      | [`IBaseSubBuildingModel`](README.md#ibasesubbuildingmodel).`building`   |
| `buildingId` | `readonly` | `number`                                                  | [`IBaseSubBuildingModel`](README.md#ibasesubbuildingmodel).`buildingId` |
| `data`       | `readonly` | [`ListDevice`](README.md#listdevice)\[`T`\]\[`"Device"`\] | -                                                                       |
| `floor`      | `readonly` | `null` \| [`FloorModel`](README.md#floormodel)            | [`IBaseSubFloorModel`](README.md#ibasesubfloormodel).`floor`            |
| `floorId`    | `readonly` | `null` \| `number`                                        | [`IBaseSubFloorModel`](README.md#ibasesubfloormodel).`floorId`          |
| `id`         | `readonly` | `number`                                                  | [`IBaseModel`](README.md#ibasemodel).`id`                               |
| `name`       | `readonly` | `string`                                                  | [`IBaseModel`](README.md#ibasemodel).`name`                             |
| `type`       | `readonly` | `T`                                                       | -                                                                       |

---

### IFloorFacade

#### Extends

- [`IBaseFacade`](README.md#ibasefacade).[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade)

#### Properties

| Property             | Type                                                                                                                                                                                                     | Inherited from                                                             |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------- |
| `getErrors`          | (`postData`: `Omit`\<[`ErrorPostData`](README.md#errorpostdata), `"DeviceIDs"`\>) => `Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>                         | [`IBaseFacade`](README.md#ibasefacade).`getErrors`                         |
| `getFrostProtection` | () => `Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>                                                                                                                                | [`IBaseFacade`](README.md#ibasefacade).`getFrostProtection`                |
| `getHolidayMode`     | () => `Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>                                                                                                                                        | [`IBaseFacade`](README.md#ibasefacade).`getHolidayMode`                    |
| `getTiles`           | () => `Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\>                                                                                                                                         | [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getTiles`    |
| `setAtaGroup`        | (`postData`: `Omit`\<[`SetAtaGroupPostData`](README.md#setatagrouppostdata), `"Specification"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>       | [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`setAtaGroup` |
| `setFrostProtection` | (`postData`: `Omit`\<[`FrostProtectionPostData`](README.md#frostprotectionpostdata), `"BuildingIds"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> | [`IBaseFacade`](README.md#ibasefacade).`setFrostProtection`                |
| `setHolidayMode`     | (`postData`: `Omit`\<[`HolidayModePostData`](README.md#holidaymodepostdata), `"HMTimeZones"`\>) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>         | [`IBaseFacade`](README.md#ibasefacade).`setHolidayMode`                    |
| `setPower`           | (`postData`: `Omit`\<[`SetPowerPostData`](README.md#setpowerpostdata), `"DeviceIds"`\>) => `Promise`\<`boolean`\>                                                                                        | [`IBaseFacade`](README.md#ibasefacade).`setPower`                          |

---

### IFloorModel

#### Extends

- [`IBaseModel`](README.md#ibasemodel).[`IBaseSubBuildingModel`](README.md#ibasesubbuildingmodel).[`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel)

#### Properties

| Property     | Modifier   | Type                                                 | Inherited from                                                          |
| :----------- | :--------- | :--------------------------------------------------- | :---------------------------------------------------------------------- |
| `areaIds`    | `readonly` | `number`[]                                           | -                                                                       |
| `areas`      | `readonly` | [`AreaModel`](README.md#areamodelt)\<`number`\>[]    | -                                                                       |
| `building`   | `readonly` | `null` \| [`BuildingModel`](README.md#buildingmodel) | [`IBaseSubBuildingModel`](README.md#ibasesubbuildingmodel).`building`   |
| `buildingId` | `readonly` | `number`                                             | [`IBaseSubBuildingModel`](README.md#ibasesubbuildingmodel).`buildingId` |
| `deviceIds`  | `readonly` | `number`[]                                           | [`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel).`deviceIds`  |
| `devices`    | `readonly` | [`DeviceModelAny`](README.md#devicemodelany)[]       | [`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel).`devices`    |
| `id`         | `readonly` | `number`                                             | [`IBaseModel`](README.md#ibasemodel).`id`                               |
| `name`       | `readonly` | `string`                                             | [`IBaseModel`](README.md#ibasemodel).`name`                             |

---

### IMELCloudAPI

#### Properties

| Property             | Modifier   | Type                                                                                                                                                                                                                                                                                                                                                         |
| :------------------- | :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `applyLogin`         | `public`   | (`data`?: [`LoginCredentials`](README.md#logincredentials), `onSuccess`?: () => `Promise`\<`void`\>) => `Promise`\<`boolean`\>                                                                                                                                                                                                                               |
| `fetchDevices`       | `public`   | () => `Promise`\<\{ `data`: [`Building`](README.md#building-3)[]; \}\>                                                                                                                                                                                                                                                                                       |
| `getDevice`          | `public`   | \<`T`\>(`__namedParameters`: \{ `params`: [`GetDeviceDataParams`](README.md#getdevicedataparams); \}) => `Promise`\<\{ `data`: [`GetDeviceData`](README.md#getdevicedata)\[`T`\]; \}\>                                                                                                                                                                       |
| `getEnergyReport`    | `public`   | \<`T`\>(`__namedParameters`: \{ `postData`: [`EnergyPostData`](README.md#energypostdata); \}) => `Promise`\<\{ `data`: [`EnergyData`](README.md#energydata)\[`T`\]; \}\>                                                                                                                                                                                     |
| `getErrors`          | `public`   | (`__namedParameters`: \{ `postData`: [`ErrorPostData`](README.md#errorpostdata); \}) => `Promise`\<\{ `data`: [`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]; \}\>                                                                                                                                                           |
| `getFrostProtection` | `public`   | (`__namedParameters`: \{ `params`: [`SettingsParams`](README.md#settingsparams); \}) => `Promise`\<\{ `data`: [`FrostProtectionData`](README.md#frostprotectiondata); \}\>                                                                                                                                                                                   |
| `getHolidayMode`     | `public`   | (`__namedParameters`: \{ `params`: [`SettingsParams`](README.md#settingsparams); \}) => `Promise`\<\{ `data`: [`HolidayModeData`](README.md#holidaymodedata); \}\>                                                                                                                                                                                           |
| `getTiles`           | `public`   | (`__namedParameters`: \{ `postData`: [`TilesPostData`](README.md#tilespostdatat)\<`null`\>; \}) => `Promise`\<\{ `data`: [`TilesData`](README.md#tilesdatat)\<`null`\>; \}\> & \<`T`\>(`__namedParameters`: \{ `postData`: [`TilesPostData`](README.md#tilespostdatat)\<`T`\>; \}) => `Promise`\<\{ `data`: [`TilesData`](README.md#tilesdatat)\<`T`\>; \}\> |
| `getWifiReport`      | `public`   | (`__namedParameters`: \{ `postData`: [`WifiPostData`](README.md#wifipostdata); \}) => `Promise`\<\{ `data`: [`WifiData`](README.md#wifidata); \}\>                                                                                                                                                                                                           |
| `language`           | `readonly` | [`Language`](README.md#language)                                                                                                                                                                                                                                                                                                                             |
| `login`              | `public`   | (`__namedParameters`: \{ `postData`: [`LoginPostData`](README.md#loginpostdata); \}) => `Promise`\<\{ `data`: [`LoginData`](README.md#logindata); \}\>                                                                                                                                                                                                       |
| `setAtaGroup`        | `public`   | (`__namedParameters`: \{ `postData`: [`SetAtaGroupPostData`](README.md#setatagrouppostdata); \}) => `Promise`\<\{ `data`: [`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata); \}\>                                                                                                                                             |
| `setDevice`          | `public`   | \<`T`\>(`__namedParameters`: \{ `heatPumpType`: `T`; `postData`: [`SetDevicePostData`](README.md#setdevicepostdatat)\<`T`\>; \}) => `Promise`\<\{ `data`: [`SetDeviceData`](README.md#setdevicedata)\[`T`\]; \}\>                                                                                                                                            |
| `setFrostProtection` | `public`   | (`__namedParameters`: \{ `postData`: [`FrostProtectionPostData`](README.md#frostprotectionpostdata); \}) => `Promise`\<\{ `data`: [`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata); \}\>                                                                                                                                     |
| `setHolidayMode`     | `public`   | (`__namedParameters`: \{ `postData`: [`HolidayModePostData`](README.md#holidaymodepostdata); \}) => `Promise`\<\{ `data`: [`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata); \}\>                                                                                                                                             |
| `setLanguage`        | `public`   | (`__namedParameters`: \{ `postData`: \{ `language`: [`Language`](README.md#language); \}; \}) => `Promise`\<\{ `data`: `boolean`; \}\>                                                                                                                                                                                                                       |
| `setPower`           | `public`   | (`__namedParameters`: \{ `postData`: [`SetPowerPostData`](README.md#setpowerpostdata); \}) => `Promise`\<\{ `data`: `boolean`; \}\>                                                                                                                                                                                                                          |

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

### AreaDataAny

```ts
type AreaDataAny: AreaData<number> | AreaData<null>;
```

#### Source

[src/types/common.ts:222](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/types/common.ts#L222)

---

### AreaModelAny

```ts
type AreaModelAny: AreaModel<number> | AreaModel<null>;
```

#### Source

[src/models/area.ts:11](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/area.ts#L11)

---

### DeviceModelAny

```ts
type DeviceModelAny: DeviceModel<"Ata"> | DeviceModel<"Atw"> | DeviceModel<"Erv">;
```

#### Source

[src/models/device.ts:11](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/models/device.ts#L11)

---

### GetDeviceDataAta

```ts
type GetDeviceDataAta: BaseGetDeviceData & SetDeviceDataAta;
```

#### Source

[src/types/ata.ts:69](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/types/ata.ts#L69)

---

### GetDeviceDataAtw

```ts
type GetDeviceDataAtw: BaseGetDeviceData & SetDeviceDataAtw;
```

#### Source

[src/types/atw.ts:76](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/types/atw.ts#L76)

---

### GetDeviceDataErv

```ts
type GetDeviceDataErv: BaseGetDeviceData & SetDeviceDataErv;
```

#### Source

[src/types/erv.ts:42](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/types/erv.ts#L42)

---

### ListDeviceAny

```ts
type ListDeviceAny: ListDeviceAta | ListDeviceAtw | ListDeviceErv;
```

#### Source

[src/types/common.ts:213](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/types/common.ts#L213)

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

[src/types/bases.ts:19](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/types/bases.ts#L19)

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

[src/types/bases.ts:21](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/types/bases.ts#L21)

---

### SetDevicePostData\<T\>

```ts
type SetDevicePostData<T>: UpdateDeviceData[T] & BaseDevicePostData;
```

#### Type parameters

| Type parameter                                                    |
| :---------------------------------------------------------------- |
| `T` _extends_ keyof _typeof_ [`DeviceType`](README.md#devicetype) |

#### Source

[src/types/common.ts:86](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/types/common.ts#L86)

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

[src/types/common.ts:272](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/types/common.ts#L272)

## Variables

### FLAG_UNCHANGED

```ts
const FLAG_UNCHANGED: 0 = 0x0
```

#### Source

[src/types/bases.ts:1](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/types/bases.ts#L1)

---

### effectiveFlagsAta

```ts
const effectiveFlagsAta: Record<
  NonEffectiveFlagsKeyOf<UpdateDeviceDataAta>,
  number
>
```

#### Source

[src/types/ata.ts:49](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/types/ata.ts#L49)

---

### effectiveFlagsAtw

```ts
const effectiveFlagsAtw: Record<
  NonEffectiveFlagsKeyOf<UpdateDeviceDataAtw>,
  number
>
```

#### Source

[src/types/atw.ts:41](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/types/atw.ts#L41)

---

### effectiveFlagsErv

```ts
const effectiveFlagsErv: Record<
  NonEffectiveFlagsKeyOf<UpdateDeviceDataErv>,
  number
>
```

#### Source

[src/types/erv.ts:23](https://github.com/OlivierZal/melcloud-api/blob/5e352f37703fc5eeb0fee45893edfd243ac21fe2/src/types/erv.ts#L23)
