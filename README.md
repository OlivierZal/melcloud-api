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

### AreaFacade

#### Extends

- [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet)\<[`AreaModelAny`](README.md#areamodelany)\>

#### Implements

- [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade)

#### Constructors

##### new AreaFacade()

```ts
new AreaFacade(api: default, id: number): AreaFacade
```

###### Parameters

| Parameter | Type                           |
| :-------- | :----------------------------- |
| `api`     | [`default`](README.md#default) |
| `id`      | `number`                       |

###### Returns

[`AreaFacade`](README.md#areafacade)

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`constructor`](README.md#constructors-2)

###### Source

[src/facades/base.ts:79](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L79)

#### Properties

| Property                   | Modifier   | Type                                         | Default value | Overrides                                                                              | Inherited from                                                                         |
| :------------------------- | :--------- | :------------------------------------------- | :------------ | :------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- |
| `api`                      | `readonly` | [`default`](README.md#default)               | `undefined`   | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`api`                      | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`api`                      |
| `frostProtectionLocation`  | `readonly` | `"AreaIds"`                                  | `'AreaIds'`   | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`frostProtectionLocation`  | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`frostProtectionLocation`  |
| `holidayModeLocation`      | `readonly` | `"Areas"`                                    | `'Areas'`     | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`holidayModeLocation`      | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`holidayModeLocation`      |
| `modelClass`               | `readonly` | _typeof_ [`AreaModel`](README.md#areamodelt) | `AreaModel`   | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`modelClass`               | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`modelClass`               |
| `setAtaGroupSpecification` | `readonly` | `"AreaID"`                                   | `'AreaID'`    | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`setAtaGroupSpecification` | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`setAtaGroupSpecification` |
| `tableName`                | `readonly` | `"Area"`                                     | `'Area'`      | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`tableName`                | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`tableName`                |

#### Accessors

##### model

```ts
get protected model(): T
```

###### Returns

`T`

###### Source

[src/facades/base.ts:84](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L84)

#### Methods

##### getAta()

```ts
getAta(): {
  FanSpeed: null | FanSpeed;
  OperationMode: null | OperationMode;
  Power: null | boolean;
  SetTemperature: null | number;
  VaneHorizontalDirection: null | Horizontal;
  VaneHorizontalSwing: null | boolean;
  VaneVerticalDirection: null | Vertical;
  VaneVerticalSwing: null | boolean;
}
```

###### Returns

```ts
{
  FanSpeed: null | FanSpeed
  OperationMode: null | OperationMode
  Power: null | boolean
  SetTemperature: null | number
  VaneHorizontalDirection: null | Horizontal
  VaneHorizontalSwing: null | boolean
  VaneVerticalDirection: null | Vertical
  VaneVerticalSwing: null | boolean
}
```

| Member                    | Type                                                 |
| :------------------------ | :--------------------------------------------------- |
| `FanSpeed`                | `null` \| [`FanSpeed`](README.md#fanspeed)           |
| `OperationMode`           | `null` \| [`OperationMode`](README.md#operationmode) |
| `Power`                   | `null` \| `boolean`                                  |
| `SetTemperature`          | `null` \| `number`                                   |
| `VaneHorizontalDirection` | `null` \| [`Horizontal`](README.md#horizontal)       |
| `VaneHorizontalSwing`     | `null` \| `boolean`                                  |
| `VaneVerticalDirection`   | `null` \| [`Vertical`](README.md#vertical)           |
| `VaneVerticalSwing`       | `null` \| `boolean`                                  |

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getAta`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`getAta`](README.md#getata-1)

###### Source

[src/facades/base_super_device.ts:50](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base_super_device.ts#L50)

##### getErrors()

```ts
getErrors(__namedParameters: {
  from: null | string;
  to: null | string;
}): Promise<FailureData | ErrorData[]>
```

###### Parameters

| Parameter                 | Type               |
| :------------------------ | :----------------- |
| `__namedParameters`       | `object`           |
| `__namedParameters.from`? | `null` \| `string` |
| `__namedParameters.to`?   | `null` \| `string` |

###### Returns

`Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getErrors`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`getErrors`](README.md#geterrors-2)

###### Source

[src/facades/base.ts:92](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L92)

##### getFrostProtection()

```ts
getFrostProtection(): Promise<FrostProtectionData>
```

###### Returns

`Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getFrostProtection`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`getFrostProtection`](README.md#getfrostprotection-2)

###### Source

[src/facades/base.ts:110](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L110)

##### getHolidayMode()

```ts
getHolidayMode(): Promise<HolidayModeData>
```

###### Returns

`Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getHolidayMode`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`getHolidayMode`](README.md#getholidaymode-2)

###### Source

[src/facades/base.ts:126](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L126)

##### getTiles()

```ts
getTiles(): Promise<TilesData<null>>
```

###### Returns

`Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getTiles`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`getTiles`](README.md#gettiles-1)

###### Source

[src/facades/base_super_device.ts:58](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base_super_device.ts#L58)

##### getWifiReport()

```ts
getWifiReport(hour: number): Promise<WifiData>
```

###### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `hour`    | `number` |

###### Returns

`Promise`\<[`WifiData`](README.md#wifidata)\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getWifiReport`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`getWifiReport`](README.md#getwifireport-2)

###### Source

[src/facades/base.ts:142](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L142)

##### setAta()

```ts
setAta(postData: {
  FanSpeed: null | FanSpeed;
  OperationMode: null | OperationMode;
  Power: null | boolean;
  SetTemperature: null | number;
  VaneHorizontalDirection: null | Horizontal;
  VaneHorizontalSwing: null | boolean;
  VaneVerticalDirection: null | Vertical;
  VaneVerticalSwing: null | boolean;
}): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter                           | Type                                                 |
| :---------------------------------- | :--------------------------------------------------- |
| `postData`                          | `object`                                             |
| `postData.FanSpeed`?                | `null` \| [`FanSpeed`](README.md#fanspeed)           |
| `postData.OperationMode`?           | `null` \| [`OperationMode`](README.md#operationmode) |
| `postData.Power`?                   | `null` \| `boolean`                                  |
| `postData.SetTemperature`?          | `null` \| `number`                                   |
| `postData.VaneHorizontalDirection`? | `null` \| [`Horizontal`](README.md#horizontal)       |
| `postData.VaneHorizontalSwing`?     | `null` \| `boolean`                                  |
| `postData.VaneVerticalDirection`?   | `null` \| [`Vertical`](README.md#vertical)           |
| `postData.VaneVerticalSwing`?       | `null` \| `boolean`                                  |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`setAta`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`setAta`](README.md#setata-1)

###### Source

[src/facades/base_super_device.ts:64](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base_super_device.ts#L64)

##### setFrostProtection()

```ts
setFrostProtection(__namedParameters: {
  enable: boolean;
  max: number;
  min: number;
}): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter                   | Type      |
| :-------------------------- | :-------- |
| `__namedParameters`         | `object`  |
| `__namedParameters.enable`? | `boolean` |
| `__namedParameters.max`     | `number`  |
| `__namedParameters.min`     | `number`  |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`setFrostProtection`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`setFrostProtection`](README.md#setfrostprotection-2)

###### Source

[src/facades/base.ts:152](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L152)

##### setHolidayMode()

```ts
setHolidayMode(__namedParameters: {
  days: number;
  enable: boolean;
  from: null | string;
  to: null | string;
}): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter                   | Type               |
| :-------------------------- | :----------------- |
| `__namedParameters`         | `object`           |
| `__namedParameters.days`?   | `number`           |
| `__namedParameters.enable`? | `boolean`          |
| `__namedParameters.from`?   | `null` \| `string` |
| `__namedParameters.to`?     | `null` \| `string` |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

`IBaseSuperDeviceFacade.setHolidayMode`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`setHolidayMode`](README.md#setholidaymode-2)

###### Source

[src/facades/base.ts:187](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L187)

##### setPower()

```ts
setPower(enable: boolean): Promise<boolean>
```

###### Parameters

| Parameter | Type      | Default value |
| :-------- | :-------- | :------------ |
| `enable`  | `boolean` | `true`        |

###### Returns

`Promise`\<`boolean`\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`setPower`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`setPower`](README.md#setpower-2)

###### Source

[src/facades/base.ts:217](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L217)

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

[src/models/area.ts:32](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/area.ts#L32)

##### deviceIds

```ts
get deviceIds(): number[]
```

###### Returns

`number`[]

###### Source

[src/models/area.ts:36](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/area.ts#L36)

##### devices

```ts
get devices(): DeviceModelAny[]
```

###### Returns

[`DeviceModelAny`](README.md#devicemodelany)[]

###### Source

[src/models/area.ts:40](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/area.ts#L40)

##### floor

```ts
get floor(): null | FloorModel
```

###### Returns

`null` \| [`FloorModel`](README.md#floormodel)

###### Source

[src/models/area.ts:44](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/area.ts#L44)

#### Methods

##### getAll()

```ts
static getAll(): AreaModelAny[]
```

###### Returns

[`AreaModelAny`](README.md#areamodelany)[]

###### Source

[src/models/area.ts:50](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/area.ts#L50)

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

[src/models/area.ts:54](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/area.ts#L54)

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

[src/models/area.ts:58](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/area.ts#L58)

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

[src/models/area.ts:62](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/area.ts#L62)

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

[src/models/area.ts:66](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/area.ts#L66)

---

### `abstract` BaseFacade\<T\>

#### Extended by

- [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet)
- [`DeviceFacade`](README.md#devicefacadet)

#### Type parameters

| Type parameter                                                                                                                                                                               |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `T` _extends_ [`AreaModelAny`](README.md#areamodelany) \| [`BuildingModel`](README.md#buildingmodel) \| [`DeviceModelAny`](README.md#devicemodelany) \| [`FloorModel`](README.md#floormodel) |

#### Implements

- [`IBaseFacade`](README.md#ibasefacade)

#### Constructors

##### new BaseFacade()

```ts
new BaseFacade<T>(api: default, id: number): BaseFacade<T>
```

###### Parameters

| Parameter | Type                           |
| :-------- | :----------------------------- |
| `api`     | [`default`](README.md#default) |
| `id`      | `number`                       |

###### Returns

[`BaseFacade`](README.md#basefacadet)\<`T`\>

###### Source

[src/facades/base.ts:79](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L79)

#### Properties

| Property                  | Modifier   | Type                                                                 |
| :------------------------ | :--------- | :------------------------------------------------------------------- |
| `api`                     | `readonly` | [`default`](README.md#default)                                       |
| `frostProtectionLocation` | `abstract` | keyof [`FrostProtectionLocation`](README.md#frostprotectionlocation) |
| `holidayModeLocation`     | `abstract` | keyof [`HolidayModeLocation`](README.md#holidaymodelocation)         |
| `modelClass`              | `abstract` | \{ `getById`: (`id`: `number`) => `undefined` \| `T`; \}             |
| `modelClass.getById`      | `abstract` | (`id`: `number`) => `undefined` \| `T`                               |
| `tableName`               | `public`   | `"Area"` \| `"Building"` \| `"DeviceLocation"` \| `"Floor"`          |

#### Accessors

##### model

```ts
get protected model(): T
```

###### Returns

`T`

###### Source

[src/facades/base.ts:84](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L84)

#### Methods

##### getErrors()

```ts
getErrors(__namedParameters: {
  from: null | string;
  to: null | string;
}): Promise<FailureData | ErrorData[]>
```

###### Parameters

| Parameter                 | Type               |
| :------------------------ | :----------------- |
| `__namedParameters`       | `object`           |
| `__namedParameters.from`? | `null` \| `string` |
| `__namedParameters.to`?   | `null` \| `string` |

###### Returns

`Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>

###### Implementation of

[`IBaseFacade`](README.md#ibasefacade).`getErrors`

###### Source

[src/facades/base.ts:92](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L92)

##### getFrostProtection()

```ts
getFrostProtection(): Promise<FrostProtectionData>
```

###### Returns

`Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>

###### Implementation of

[`IBaseFacade`](README.md#ibasefacade).`getFrostProtection`

###### Source

[src/facades/base.ts:110](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L110)

##### getHolidayMode()

```ts
getHolidayMode(): Promise<HolidayModeData>
```

###### Returns

`Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>

###### Implementation of

[`IBaseFacade`](README.md#ibasefacade).`getHolidayMode`

###### Source

[src/facades/base.ts:126](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L126)

##### getWifiReport()

```ts
getWifiReport(hour: number): Promise<WifiData>
```

###### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `hour`    | `number` |

###### Returns

`Promise`\<[`WifiData`](README.md#wifidata)\>

###### Implementation of

[`IBaseFacade`](README.md#ibasefacade).`getWifiReport`

###### Source

[src/facades/base.ts:142](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L142)

##### setFrostProtection()

```ts
setFrostProtection(__namedParameters: {
  enable: boolean;
  max: number;
  min: number;
}): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter                   | Type      |
| :-------------------------- | :-------- |
| `__namedParameters`         | `object`  |
| `__namedParameters.enable`? | `boolean` |
| `__namedParameters.max`     | `number`  |
| `__namedParameters.min`     | `number`  |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IBaseFacade`](README.md#ibasefacade).`setFrostProtection`

###### Source

[src/facades/base.ts:152](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L152)

##### setHolidayMode()

```ts
setHolidayMode(__namedParameters: {
  days: number;
  enable: boolean;
  from: null | string;
  to: null | string;
}): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter                   | Type               |
| :-------------------------- | :----------------- |
| `__namedParameters`         | `object`           |
| `__namedParameters.days`?   | `number`           |
| `__namedParameters.enable`? | `boolean`          |
| `__namedParameters.from`?   | `null` \| `string` |
| `__namedParameters.to`?     | `null` \| `string` |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

`IBaseFacade.setHolidayMode`

###### Source

[src/facades/base.ts:187](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L187)

##### setPower()

```ts
setPower(enable: boolean): Promise<boolean>
```

###### Parameters

| Parameter | Type      | Default value |
| :-------- | :-------- | :------------ |
| `enable`  | `boolean` | `true`        |

###### Returns

`Promise`\<`boolean`\>

###### Implementation of

[`IBaseFacade`](README.md#ibasefacade).`setPower`

###### Source

[src/facades/base.ts:217](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L217)

---

### `abstract` BaseSuperDeviceFacade\<T\>

#### Extends

- [`BaseFacade`](README.md#basefacadet)\<`T`\>

#### Extended by

- [`AreaFacade`](README.md#areafacade)
- [`BuildingFacade`](README.md#buildingfacade)
- [`FloorFacade`](README.md#floorfacade)

#### Type parameters

| Type parameter                                                                                                                               |
| :------------------------------------------------------------------------------------------------------------------------------------------- |
| `T` _extends_ [`AreaModelAny`](README.md#areamodelany) \| [`BuildingModel`](README.md#buildingmodel) \| [`FloorModel`](README.md#floormodel) |

#### Implements

- [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade)

#### Constructors

##### new BaseSuperDeviceFacade()

```ts
new BaseSuperDeviceFacade<T>(api: default, id: number): BaseSuperDeviceFacade<T>
```

###### Parameters

| Parameter | Type                           |
| :-------- | :----------------------------- |
| `api`     | [`default`](README.md#default) |
| `id`      | `number`                       |

###### Returns

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet)\<`T`\>

###### Inherited from

[`BaseFacade`](README.md#basefacadet).[`constructor`](README.md#constructors-1)

###### Source

[src/facades/base.ts:79](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L79)

#### Properties

| Property                   | Modifier   | Type                                                                 | Inherited from                                                  |
| :------------------------- | :--------- | :------------------------------------------------------------------- | :-------------------------------------------------------------- |
| `api`                      | `readonly` | [`default`](README.md#default)                                       | [`BaseFacade`](README.md#basefacadet).`api`                     |
| `frostProtectionLocation`  | `abstract` | keyof [`FrostProtectionLocation`](README.md#frostprotectionlocation) | [`BaseFacade`](README.md#basefacadet).`frostProtectionLocation` |
| `holidayModeLocation`      | `abstract` | keyof [`HolidayModeLocation`](README.md#holidaymodelocation)         | [`BaseFacade`](README.md#basefacadet).`holidayModeLocation`     |
| `modelClass`               | `abstract` | \{ `getById`: (`id`: `number`) => `undefined` \| `T`; \}             | [`BaseFacade`](README.md#basefacadet).`modelClass`              |
| `modelClass.getById`       | `abstract` | (`id`: `number`) => `undefined` \| `T`                               | -                                                               |
| `setAtaGroupSpecification` | `abstract` | `"AreaID"` \| `"BuildingID"` \| `"FloorID"`                          | -                                                               |
| `tableName`                | `public`   | `"Area"` \| `"Building"` \| `"DeviceLocation"` \| `"Floor"`          | [`BaseFacade`](README.md#basefacadet).`tableName`               |

#### Accessors

##### model

```ts
get protected model(): T
```

###### Returns

`T`

###### Source

[src/facades/base.ts:84](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L84)

#### Methods

##### getAta()

```ts
getAta(): {
  FanSpeed: null | FanSpeed;
  OperationMode: null | OperationMode;
  Power: null | boolean;
  SetTemperature: null | number;
  VaneHorizontalDirection: null | Horizontal;
  VaneHorizontalSwing: null | boolean;
  VaneVerticalDirection: null | Vertical;
  VaneVerticalSwing: null | boolean;
}
```

###### Returns

```ts
{
  FanSpeed: null | FanSpeed
  OperationMode: null | OperationMode
  Power: null | boolean
  SetTemperature: null | number
  VaneHorizontalDirection: null | Horizontal
  VaneHorizontalSwing: null | boolean
  VaneVerticalDirection: null | Vertical
  VaneVerticalSwing: null | boolean
}
```

| Member                    | Type                                                 |
| :------------------------ | :--------------------------------------------------- |
| `FanSpeed`                | `null` \| [`FanSpeed`](README.md#fanspeed)           |
| `OperationMode`           | `null` \| [`OperationMode`](README.md#operationmode) |
| `Power`                   | `null` \| `boolean`                                  |
| `SetTemperature`          | `null` \| `number`                                   |
| `VaneHorizontalDirection` | `null` \| [`Horizontal`](README.md#horizontal)       |
| `VaneHorizontalSwing`     | `null` \| `boolean`                                  |
| `VaneVerticalDirection`   | `null` \| [`Vertical`](README.md#vertical)           |
| `VaneVerticalSwing`       | `null` \| `boolean`                                  |

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getAta`

###### Source

[src/facades/base_super_device.ts:50](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base_super_device.ts#L50)

##### getErrors()

```ts
getErrors(__namedParameters: {
  from: null | string;
  to: null | string;
}): Promise<FailureData | ErrorData[]>
```

###### Parameters

| Parameter                 | Type               |
| :------------------------ | :----------------- |
| `__namedParameters`       | `object`           |
| `__namedParameters.from`? | `null` \| `string` |
| `__namedParameters.to`?   | `null` \| `string` |

###### Returns

`Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getErrors`

###### Inherited from

[`BaseFacade`](README.md#basefacadet).[`getErrors`](README.md#geterrors-1)

###### Source

[src/facades/base.ts:92](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L92)

##### getFrostProtection()

```ts
getFrostProtection(): Promise<FrostProtectionData>
```

###### Returns

`Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getFrostProtection`

###### Inherited from

[`BaseFacade`](README.md#basefacadet).[`getFrostProtection`](README.md#getfrostprotection-1)

###### Source

[src/facades/base.ts:110](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L110)

##### getHolidayMode()

```ts
getHolidayMode(): Promise<HolidayModeData>
```

###### Returns

`Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getHolidayMode`

###### Inherited from

[`BaseFacade`](README.md#basefacadet).[`getHolidayMode`](README.md#getholidaymode-1)

###### Source

[src/facades/base.ts:126](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L126)

##### getTiles()

```ts
getTiles(): Promise<TilesData<null>>
```

###### Returns

`Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getTiles`

###### Source

[src/facades/base_super_device.ts:58](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base_super_device.ts#L58)

##### getWifiReport()

```ts
getWifiReport(hour: number): Promise<WifiData>
```

###### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `hour`    | `number` |

###### Returns

`Promise`\<[`WifiData`](README.md#wifidata)\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getWifiReport`

###### Inherited from

[`BaseFacade`](README.md#basefacadet).[`getWifiReport`](README.md#getwifireport-1)

###### Source

[src/facades/base.ts:142](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L142)

##### setAta()

```ts
setAta(postData: {
  FanSpeed: null | FanSpeed;
  OperationMode: null | OperationMode;
  Power: null | boolean;
  SetTemperature: null | number;
  VaneHorizontalDirection: null | Horizontal;
  VaneHorizontalSwing: null | boolean;
  VaneVerticalDirection: null | Vertical;
  VaneVerticalSwing: null | boolean;
}): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter                           | Type                                                 |
| :---------------------------------- | :--------------------------------------------------- |
| `postData`                          | `object`                                             |
| `postData.FanSpeed`?                | `null` \| [`FanSpeed`](README.md#fanspeed)           |
| `postData.OperationMode`?           | `null` \| [`OperationMode`](README.md#operationmode) |
| `postData.Power`?                   | `null` \| `boolean`                                  |
| `postData.SetTemperature`?          | `null` \| `number`                                   |
| `postData.VaneHorizontalDirection`? | `null` \| [`Horizontal`](README.md#horizontal)       |
| `postData.VaneHorizontalSwing`?     | `null` \| `boolean`                                  |
| `postData.VaneVerticalDirection`?   | `null` \| [`Vertical`](README.md#vertical)           |
| `postData.VaneVerticalSwing`?       | `null` \| `boolean`                                  |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`setAta`

###### Source

[src/facades/base_super_device.ts:64](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base_super_device.ts#L64)

##### setFrostProtection()

```ts
setFrostProtection(__namedParameters: {
  enable: boolean;
  max: number;
  min: number;
}): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter                   | Type      |
| :-------------------------- | :-------- |
| `__namedParameters`         | `object`  |
| `__namedParameters.enable`? | `boolean` |
| `__namedParameters.max`     | `number`  |
| `__namedParameters.min`     | `number`  |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`setFrostProtection`

###### Inherited from

[`BaseFacade`](README.md#basefacadet).[`setFrostProtection`](README.md#setfrostprotection-1)

###### Source

[src/facades/base.ts:152](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L152)

##### setHolidayMode()

```ts
setHolidayMode(__namedParameters: {
  days: number;
  enable: boolean;
  from: null | string;
  to: null | string;
}): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter                   | Type               |
| :-------------------------- | :----------------- |
| `__namedParameters`         | `object`           |
| `__namedParameters.days`?   | `number`           |
| `__namedParameters.enable`? | `boolean`          |
| `__namedParameters.from`?   | `null` \| `string` |
| `__namedParameters.to`?     | `null` \| `string` |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

`IBaseSuperDeviceFacade.setHolidayMode`

###### Inherited from

[`BaseFacade`](README.md#basefacadet).[`setHolidayMode`](README.md#setholidaymode-1)

###### Source

[src/facades/base.ts:187](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L187)

##### setPower()

```ts
setPower(enable: boolean): Promise<boolean>
```

###### Parameters

| Parameter | Type      | Default value |
| :-------- | :-------- | :------------ |
| `enable`  | `boolean` | `true`        |

###### Returns

`Promise`\<`boolean`\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`setPower`

###### Inherited from

[`BaseFacade`](README.md#basefacadet).[`setPower`](README.md#setpower-1)

###### Source

[src/facades/base.ts:217](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L217)

---

### BuildingFacade

#### Extends

- [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet)\<[`BuildingModel`](README.md#buildingmodel)\>

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

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`constructor`](README.md#constructors-2)

###### Source

[src/facades/base.ts:79](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L79)

#### Properties

| Property                   | Modifier   | Type                                                | Default value   | Overrides                                                                              | Inherited from                                                                         |
| :------------------------- | :--------- | :-------------------------------------------------- | :-------------- | :------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- |
| `api`                      | `readonly` | [`default`](README.md#default)                      | `undefined`     | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`api`                      | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`api`                      |
| `frostProtectionLocation`  | `readonly` | `"BuildingIds"`                                     | `'BuildingIds'` | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`frostProtectionLocation`  | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`frostProtectionLocation`  |
| `holidayModeLocation`      | `readonly` | `"Buildings"`                                       | `'Buildings'`   | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`holidayModeLocation`      | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`holidayModeLocation`      |
| `modelClass`               | `readonly` | _typeof_ [`BuildingModel`](README.md#buildingmodel) | `BuildingModel` | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`modelClass`               | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`modelClass`               |
| `setAtaGroupSpecification` | `readonly` | `"BuildingID"`                                      | `'BuildingID'`  | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`setAtaGroupSpecification` | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`setAtaGroupSpecification` |
| `tableName`                | `readonly` | `"Building"`                                        | `'Building'`    | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`tableName`                | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`tableName`                |

#### Accessors

##### data

```ts
get data(): BuildingSettings
```

###### Returns

[`BuildingSettings`](README.md#buildingsettings)

###### Source

[src/facades/building.ts:20](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/building.ts#L20)

##### model

```ts
get protected model(): T
```

###### Returns

`T`

###### Source

[src/facades/base.ts:84](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L84)

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

[src/facades/building.ts:24](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/building.ts#L24)

##### getAta()

```ts
getAta(): {
  FanSpeed: null | FanSpeed;
  OperationMode: null | OperationMode;
  Power: null | boolean;
  SetTemperature: null | number;
  VaneHorizontalDirection: null | Horizontal;
  VaneHorizontalSwing: null | boolean;
  VaneVerticalDirection: null | Vertical;
  VaneVerticalSwing: null | boolean;
}
```

###### Returns

```ts
{
  FanSpeed: null | FanSpeed
  OperationMode: null | OperationMode
  Power: null | boolean
  SetTemperature: null | number
  VaneHorizontalDirection: null | Horizontal
  VaneHorizontalSwing: null | boolean
  VaneVerticalDirection: null | Vertical
  VaneVerticalSwing: null | boolean
}
```

| Member                    | Type                                                 |
| :------------------------ | :--------------------------------------------------- |
| `FanSpeed`                | `null` \| [`FanSpeed`](README.md#fanspeed)           |
| `OperationMode`           | `null` \| [`OperationMode`](README.md#operationmode) |
| `Power`                   | `null` \| `boolean`                                  |
| `SetTemperature`          | `null` \| `number`                                   |
| `VaneHorizontalDirection` | `null` \| [`Horizontal`](README.md#horizontal)       |
| `VaneHorizontalSwing`     | `null` \| `boolean`                                  |
| `VaneVerticalDirection`   | `null` \| [`Vertical`](README.md#vertical)           |
| `VaneVerticalSwing`       | `null` \| `boolean`                                  |

###### Implementation of

[`IBuildingFacade`](README.md#ibuildingfacade).`getAta`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`getAta`](README.md#getata-1)

###### Source

[src/facades/base_super_device.ts:50](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base_super_device.ts#L50)

##### getErrors()

```ts
getErrors(__namedParameters: {
  from: null | string;
  to: null | string;
}): Promise<FailureData | ErrorData[]>
```

###### Parameters

| Parameter                 | Type               |
| :------------------------ | :----------------- |
| `__namedParameters`       | `object`           |
| `__namedParameters.from`? | `null` \| `string` |
| `__namedParameters.to`?   | `null` \| `string` |

###### Returns

`Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>

###### Implementation of

[`IBuildingFacade`](README.md#ibuildingfacade).`getErrors`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`getErrors`](README.md#geterrors-2)

###### Source

[src/facades/base.ts:92](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L92)

##### getFrostProtection()

```ts
getFrostProtection(): Promise<FrostProtectionData>
```

###### Returns

`Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>

###### Implementation of

[`IBuildingFacade`](README.md#ibuildingfacade).`getFrostProtection`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`getFrostProtection`](README.md#getfrostprotection-2)

###### Source

[src/facades/base.ts:110](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L110)

##### getHolidayMode()

```ts
getHolidayMode(): Promise<HolidayModeData>
```

###### Returns

`Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>

###### Implementation of

[`IBuildingFacade`](README.md#ibuildingfacade).`getHolidayMode`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`getHolidayMode`](README.md#getholidaymode-2)

###### Source

[src/facades/base.ts:126](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L126)

##### getTiles()

```ts
getTiles(): Promise<TilesData<null>>
```

###### Returns

`Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\>

###### Implementation of

[`IBuildingFacade`](README.md#ibuildingfacade).`getTiles`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`getTiles`](README.md#gettiles-1)

###### Source

[src/facades/base_super_device.ts:58](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base_super_device.ts#L58)

##### getWifiReport()

```ts
getWifiReport(hour: number): Promise<WifiData>
```

###### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `hour`    | `number` |

###### Returns

`Promise`\<[`WifiData`](README.md#wifidata)\>

###### Implementation of

[`IBuildingFacade`](README.md#ibuildingfacade).`getWifiReport`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`getWifiReport`](README.md#getwifireport-2)

###### Source

[src/facades/base.ts:142](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L142)

##### setAta()

```ts
setAta(postData: {
  FanSpeed: null | FanSpeed;
  OperationMode: null | OperationMode;
  Power: null | boolean;
  SetTemperature: null | number;
  VaneHorizontalDirection: null | Horizontal;
  VaneHorizontalSwing: null | boolean;
  VaneVerticalDirection: null | Vertical;
  VaneVerticalSwing: null | boolean;
}): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter                           | Type                                                 |
| :---------------------------------- | :--------------------------------------------------- |
| `postData`                          | `object`                                             |
| `postData.FanSpeed`?                | `null` \| [`FanSpeed`](README.md#fanspeed)           |
| `postData.OperationMode`?           | `null` \| [`OperationMode`](README.md#operationmode) |
| `postData.Power`?                   | `null` \| `boolean`                                  |
| `postData.SetTemperature`?          | `null` \| `number`                                   |
| `postData.VaneHorizontalDirection`? | `null` \| [`Horizontal`](README.md#horizontal)       |
| `postData.VaneHorizontalSwing`?     | `null` \| `boolean`                                  |
| `postData.VaneVerticalDirection`?   | `null` \| [`Vertical`](README.md#vertical)           |
| `postData.VaneVerticalSwing`?       | `null` \| `boolean`                                  |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IBuildingFacade`](README.md#ibuildingfacade).`setAta`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`setAta`](README.md#setata-1)

###### Source

[src/facades/base_super_device.ts:64](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base_super_device.ts#L64)

##### setFrostProtection()

```ts
setFrostProtection(__namedParameters: {
  enable: boolean;
  max: number;
  min: number;
}): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter                   | Type      |
| :-------------------------- | :-------- |
| `__namedParameters`         | `object`  |
| `__namedParameters.enable`? | `boolean` |
| `__namedParameters.max`     | `number`  |
| `__namedParameters.min`     | `number`  |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IBuildingFacade`](README.md#ibuildingfacade).`setFrostProtection`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`setFrostProtection`](README.md#setfrostprotection-2)

###### Source

[src/facades/base.ts:152](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L152)

##### setHolidayMode()

```ts
setHolidayMode(__namedParameters: {
  days: number;
  enable: boolean;
  from: null | string;
  to: null | string;
}): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter                   | Type               |
| :-------------------------- | :----------------- |
| `__namedParameters`         | `object`           |
| `__namedParameters.days`?   | `number`           |
| `__namedParameters.enable`? | `boolean`          |
| `__namedParameters.from`?   | `null` \| `string` |
| `__namedParameters.to`?     | `null` \| `string` |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

`IBuildingFacade.setHolidayMode`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`setHolidayMode`](README.md#setholidaymode-2)

###### Source

[src/facades/base.ts:187](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L187)

##### setPower()

```ts
setPower(enable: boolean): Promise<boolean>
```

###### Parameters

| Parameter | Type      | Default value |
| :-------- | :-------- | :------------ |
| `enable`  | `boolean` | `true`        |

###### Returns

`Promise`\<`boolean`\>

###### Implementation of

[`IBuildingFacade`](README.md#ibuildingfacade).`setPower`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`setPower`](README.md#setpower-2)

###### Source

[src/facades/base.ts:217](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L217)

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

[src/models/building.ts:20](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/building.ts#L20)

##### devices

```ts
get devices(): DeviceModelAny[]
```

###### Returns

[`DeviceModelAny`](README.md#devicemodelany)[]

###### Source

[src/models/building.ts:24](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/building.ts#L24)

#### Methods

##### getAll()

```ts
static getAll(): BuildingModel[]
```

###### Returns

[`BuildingModel`](README.md#buildingmodel)[]

###### Source

[src/models/building.ts:30](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/building.ts#L30)

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

[src/models/building.ts:34](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/building.ts#L34)

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

[src/models/building.ts:38](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/building.ts#L38)

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

[src/models/building.ts:42](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/building.ts#L42)

---

### DeviceFacade\<T\>

#### Extends

- [`BaseFacade`](README.md#basefacadet)\<[`DeviceModelAny`](README.md#devicemodelany)\>

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

###### Overrides

[`BaseFacade`](README.md#basefacadet).[`constructor`](README.md#constructors-1)

###### Source

[src/facades/device.ts:39](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/device.ts#L39)

#### Properties

| Property                     | Modifier   | Type                                                                                                                 | Default value      | Overrides                                                       | Inherited from                                                  |
| :--------------------------- | :--------- | :------------------------------------------------------------------------------------------------------------------- | :----------------- | :-------------------------------------------------------------- | :-------------------------------------------------------------- |
| `api`                        | `readonly` | [`default`](README.md#default)                                                                                       | `undefined`        | [`BaseFacade`](README.md#basefacadet).`api`                     | [`BaseFacade`](README.md#basefacadet).`api`                     |
| `frostProtectionLocation`    | `readonly` | `"DeviceIds"`                                                                                                        | `'DeviceIds'`      | [`BaseFacade`](README.md#basefacadet).`frostProtectionLocation` | [`BaseFacade`](README.md#basefacadet).`frostProtectionLocation` |
| `holidayModeLocation`        | `readonly` | `"Devices"`                                                                                                          | `'Devices'`        | [`BaseFacade`](README.md#basefacadet).`holidayModeLocation`     | [`BaseFacade`](README.md#basefacadet).`holidayModeLocation`     |
| `modelClass`                 | `readonly` | (`__namedParameters`: [`ListDevice`](README.md#listdevice)\[`T`\]) => [`DeviceModel`](README.md#devicemodelt)\<`T`\> | `...`              | [`BaseFacade`](README.md#basefacadet).`modelClass`              | [`BaseFacade`](README.md#basefacadet).`modelClass`              |
| `modelClass.devices`         | `readonly` | `Map`\<`number`, [`DeviceModelAny`](README.md#devicemodelany)\>                                                      | `...`              | -                                                               | -                                                               |
| `modelClass.prototype`       | `public`   | [`DeviceModel`](README.md#devicemodelt)\<`any`\>                                                                     | `undefined`        | -                                                               | -                                                               |
| `modelClass.getAll`          | `public`   | [`DeviceModelAny`](README.md#devicemodelany)[]                                                                       | `undefined`        | -                                                               | -                                                               |
| `modelClass.getByBuildingId` | `public`   | [`DeviceModelAny`](README.md#devicemodelany)[]                                                                       | `undefined`        | -                                                               | -                                                               |
| `modelClass.getById`         | `public`   | `undefined` \| [`DeviceModelAny`](README.md#devicemodelany)                                                          | `undefined`        | -                                                               | -                                                               |
| `modelClass.getByName`       | `public`   | `undefined` \| [`DeviceModelAny`](README.md#devicemodelany)                                                          | `undefined`        | -                                                               | -                                                               |
| `modelClass.getByType`       | `public`   | [`DeviceModelAny`](README.md#devicemodelany)[]                                                                       | `undefined`        | -                                                               | -                                                               |
| `modelClass.upsert`          | `public`   | `void`                                                                                                               | `undefined`        | -                                                               | -                                                               |
| `modelClass.upsertMany`      | `public`   | `void`                                                                                                               | `undefined`        | -                                                               | -                                                               |
| `tableName`                  | `public`   | `"DeviceLocation"`                                                                                                   | `'DeviceLocation'` | [`BaseFacade`](README.md#basefacadet).`tableName`               | [`BaseFacade`](README.md#basefacadet).`tableName`               |

#### Accessors

##### data

```ts
get data(): ListDevice[T]["Device"]
```

###### Returns

[`ListDevice`](README.md#listdevice)\[`T`\]\[`"Device"`\]

###### Source

[src/facades/device.ts:56](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/device.ts#L56)

##### model

```ts
get protected model(): T
```

###### Returns

`T`

###### Source

[src/facades/base.ts:84](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L84)

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

[src/facades/device.ts:60](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/device.ts#L60)

##### get()

```ts
get(): Promise<GetDeviceData[T]>
```

###### Returns

`Promise`\<[`GetDeviceData`](README.md#getdevicedata)\[`T`\]\>

###### Implementation of

[`IDeviceFacade`](README.md#idevicefacadet).`get`

###### Source

[src/facades/device.ts:65](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/device.ts#L65)

##### getEnergyReport()

```ts
getEnergyReport(__namedParameters: {
  from: null | string;
  to: null | string;
}): Promise<EnergyData[T]>
```

###### Parameters

| Parameter                 | Type               |
| :------------------------ | :----------------- |
| `__namedParameters`       | `object`           |
| `__namedParameters.from`? | `null` \| `string` |
| `__namedParameters.to`?   | `null` \| `string` |

###### Returns

`Promise`\<[`EnergyData`](README.md#energydata)\[`T`\]\>

###### Implementation of

[`IDeviceFacade`](README.md#idevicefacadet).`getEnergyReport`

###### Source

[src/facades/device.ts:73](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/device.ts#L73)

##### getErrors()

```ts
getErrors(__namedParameters: {
  from: null | string;
  to: null | string;
}): Promise<FailureData | ErrorData[]>
```

###### Parameters

| Parameter                 | Type               |
| :------------------------ | :----------------- |
| `__namedParameters`       | `object`           |
| `__namedParameters.from`? | `null` \| `string` |
| `__namedParameters.to`?   | `null` \| `string` |

###### Returns

`Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>

###### Implementation of

[`IDeviceFacade`](README.md#idevicefacadet).`getErrors`

###### Inherited from

[`BaseFacade`](README.md#basefacadet).[`getErrors`](README.md#geterrors-1)

###### Source

[src/facades/base.ts:92](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L92)

##### getFrostProtection()

```ts
getFrostProtection(): Promise<FrostProtectionData>
```

###### Returns

`Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>

###### Implementation of

[`IDeviceFacade`](README.md#idevicefacadet).`getFrostProtection`

###### Inherited from

[`BaseFacade`](README.md#basefacadet).[`getFrostProtection`](README.md#getfrostprotection-1)

###### Source

[src/facades/base.ts:110](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L110)

##### getHolidayMode()

```ts
getHolidayMode(): Promise<HolidayModeData>
```

###### Returns

`Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>

###### Implementation of

[`IDeviceFacade`](README.md#idevicefacadet).`getHolidayMode`

###### Inherited from

[`BaseFacade`](README.md#basefacadet).[`getHolidayMode`](README.md#getholidaymode-1)

###### Source

[src/facades/base.ts:126](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L126)

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

[src/facades/device.ts:91](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/device.ts#L91)

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

[src/facades/device.ts:92](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/device.ts#L92)

##### getWifiReport()

```ts
getWifiReport(hour: number): Promise<WifiData>
```

###### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `hour`    | `number` |

###### Returns

`Promise`\<[`WifiData`](README.md#wifidata)\>

###### Implementation of

[`IDeviceFacade`](README.md#idevicefacadet).`getWifiReport`

###### Inherited from

[`BaseFacade`](README.md#basefacadet).[`getWifiReport`](README.md#getwifireport-1)

###### Source

[src/facades/base.ts:142](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L142)

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

[src/facades/device.ts:108](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/device.ts#L108)

##### setFrostProtection()

```ts
setFrostProtection(__namedParameters: {
  enable: boolean;
  max: number;
  min: number;
}): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter                   | Type      |
| :-------------------------- | :-------- |
| `__namedParameters`         | `object`  |
| `__namedParameters.enable`? | `boolean` |
| `__namedParameters.max`     | `number`  |
| `__namedParameters.min`     | `number`  |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IDeviceFacade`](README.md#idevicefacadet).`setFrostProtection`

###### Inherited from

[`BaseFacade`](README.md#basefacadet).[`setFrostProtection`](README.md#setfrostprotection-1)

###### Source

[src/facades/base.ts:152](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L152)

##### setHolidayMode()

```ts
setHolidayMode(__namedParameters: {
  days: number;
  enable: boolean;
  from: null | string;
  to: null | string;
}): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter                   | Type               |
| :-------------------------- | :----------------- |
| `__namedParameters`         | `object`           |
| `__namedParameters.days`?   | `number`           |
| `__namedParameters.enable`? | `boolean`          |
| `__namedParameters.from`?   | `null` \| `string` |
| `__namedParameters.to`?     | `null` \| `string` |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

`IDeviceFacade.setHolidayMode`

###### Inherited from

[`BaseFacade`](README.md#basefacadet).[`setHolidayMode`](README.md#setholidaymode-1)

###### Source

[src/facades/base.ts:187](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L187)

##### setPower()

```ts
setPower(enable: boolean): Promise<boolean>
```

###### Parameters

| Parameter | Type      | Default value |
| :-------- | :-------- | :------------ |
| `enable`  | `boolean` | `true`        |

###### Returns

`Promise`\<`boolean`\>

###### Implementation of

[`IDeviceFacade`](README.md#idevicefacadet).`setPower`

###### Inherited from

[`BaseFacade`](README.md#basefacadet).[`setPower`](README.md#setpower-1)

###### Source

[src/facades/base.ts:217](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L217)

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

[src/models/device.ts:49](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/device.ts#L49)

##### building

```ts
get building(): null | BuildingModel
```

###### Returns

`null` \| [`BuildingModel`](README.md#buildingmodel)

###### Source

[src/models/device.ts:53](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/device.ts#L53)

##### floor

```ts
get floor(): null | FloorModel
```

###### Returns

`null` \| [`FloorModel`](README.md#floormodel)

###### Source

[src/models/device.ts:57](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/device.ts#L57)

#### Methods

##### getAll()

```ts
static getAll(): DeviceModelAny[]
```

###### Returns

[`DeviceModelAny`](README.md#devicemodelany)[]

###### Source

[src/models/device.ts:63](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/device.ts#L63)

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

[src/models/device.ts:67](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/device.ts#L67)

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

[src/models/device.ts:71](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/device.ts#L71)

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

[src/models/device.ts:75](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/device.ts#L75)

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

[src/models/device.ts:79](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/device.ts#L79)

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

[src/models/device.ts:85](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/device.ts#L85)

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

[src/models/device.ts:89](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/device.ts#L89)

---

### FloorFacade

#### Extends

- [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet)\<[`FloorModel`](README.md#floormodel)\>

#### Implements

- [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade)

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

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`constructor`](README.md#constructors-2)

###### Source

[src/facades/base.ts:79](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L79)

#### Properties

| Property                   | Modifier   | Type                                          | Default value | Overrides                                                                              | Inherited from                                                                         |
| :------------------------- | :--------- | :-------------------------------------------- | :------------ | :------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- |
| `api`                      | `readonly` | [`default`](README.md#default)                | `undefined`   | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`api`                      | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`api`                      |
| `frostProtectionLocation`  | `readonly` | `"FloorIds"`                                  | `'FloorIds'`  | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`frostProtectionLocation`  | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`frostProtectionLocation`  |
| `holidayModeLocation`      | `readonly` | `"Floors"`                                    | `'Floors'`    | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`holidayModeLocation`      | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`holidayModeLocation`      |
| `modelClass`               | `readonly` | _typeof_ [`FloorModel`](README.md#floormodel) | `FloorModel`  | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`modelClass`               | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`modelClass`               |
| `setAtaGroupSpecification` | `readonly` | `"FloorID"`                                   | `'FloorID'`   | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`setAtaGroupSpecification` | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`setAtaGroupSpecification` |
| `tableName`                | `readonly` | `"Floor"`                                     | `'Floor'`     | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`tableName`                | [`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).`tableName`                |

#### Accessors

##### model

```ts
get protected model(): T
```

###### Returns

`T`

###### Source

[src/facades/base.ts:84](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L84)

#### Methods

##### getAta()

```ts
getAta(): {
  FanSpeed: null | FanSpeed;
  OperationMode: null | OperationMode;
  Power: null | boolean;
  SetTemperature: null | number;
  VaneHorizontalDirection: null | Horizontal;
  VaneHorizontalSwing: null | boolean;
  VaneVerticalDirection: null | Vertical;
  VaneVerticalSwing: null | boolean;
}
```

###### Returns

```ts
{
  FanSpeed: null | FanSpeed
  OperationMode: null | OperationMode
  Power: null | boolean
  SetTemperature: null | number
  VaneHorizontalDirection: null | Horizontal
  VaneHorizontalSwing: null | boolean
  VaneVerticalDirection: null | Vertical
  VaneVerticalSwing: null | boolean
}
```

| Member                    | Type                                                 |
| :------------------------ | :--------------------------------------------------- |
| `FanSpeed`                | `null` \| [`FanSpeed`](README.md#fanspeed)           |
| `OperationMode`           | `null` \| [`OperationMode`](README.md#operationmode) |
| `Power`                   | `null` \| `boolean`                                  |
| `SetTemperature`          | `null` \| `number`                                   |
| `VaneHorizontalDirection` | `null` \| [`Horizontal`](README.md#horizontal)       |
| `VaneHorizontalSwing`     | `null` \| `boolean`                                  |
| `VaneVerticalDirection`   | `null` \| [`Vertical`](README.md#vertical)           |
| `VaneVerticalSwing`       | `null` \| `boolean`                                  |

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getAta`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`getAta`](README.md#getata-1)

###### Source

[src/facades/base_super_device.ts:50](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base_super_device.ts#L50)

##### getErrors()

```ts
getErrors(__namedParameters: {
  from: null | string;
  to: null | string;
}): Promise<FailureData | ErrorData[]>
```

###### Parameters

| Parameter                 | Type               |
| :------------------------ | :----------------- |
| `__namedParameters`       | `object`           |
| `__namedParameters.from`? | `null` \| `string` |
| `__namedParameters.to`?   | `null` \| `string` |

###### Returns

`Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getErrors`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`getErrors`](README.md#geterrors-2)

###### Source

[src/facades/base.ts:92](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L92)

##### getFrostProtection()

```ts
getFrostProtection(): Promise<FrostProtectionData>
```

###### Returns

`Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getFrostProtection`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`getFrostProtection`](README.md#getfrostprotection-2)

###### Source

[src/facades/base.ts:110](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L110)

##### getHolidayMode()

```ts
getHolidayMode(): Promise<HolidayModeData>
```

###### Returns

`Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getHolidayMode`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`getHolidayMode`](README.md#getholidaymode-2)

###### Source

[src/facades/base.ts:126](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L126)

##### getTiles()

```ts
getTiles(): Promise<TilesData<null>>
```

###### Returns

`Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getTiles`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`getTiles`](README.md#gettiles-1)

###### Source

[src/facades/base_super_device.ts:58](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base_super_device.ts#L58)

##### getWifiReport()

```ts
getWifiReport(hour: number): Promise<WifiData>
```

###### Parameters

| Parameter | Type     |
| :-------- | :------- |
| `hour`    | `number` |

###### Returns

`Promise`\<[`WifiData`](README.md#wifidata)\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getWifiReport`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`getWifiReport`](README.md#getwifireport-2)

###### Source

[src/facades/base.ts:142](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L142)

##### setAta()

```ts
setAta(postData: {
  FanSpeed: null | FanSpeed;
  OperationMode: null | OperationMode;
  Power: null | boolean;
  SetTemperature: null | number;
  VaneHorizontalDirection: null | Horizontal;
  VaneHorizontalSwing: null | boolean;
  VaneVerticalDirection: null | Vertical;
  VaneVerticalSwing: null | boolean;
}): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter                           | Type                                                 |
| :---------------------------------- | :--------------------------------------------------- |
| `postData`                          | `object`                                             |
| `postData.FanSpeed`?                | `null` \| [`FanSpeed`](README.md#fanspeed)           |
| `postData.OperationMode`?           | `null` \| [`OperationMode`](README.md#operationmode) |
| `postData.Power`?                   | `null` \| `boolean`                                  |
| `postData.SetTemperature`?          | `null` \| `number`                                   |
| `postData.VaneHorizontalDirection`? | `null` \| [`Horizontal`](README.md#horizontal)       |
| `postData.VaneHorizontalSwing`?     | `null` \| `boolean`                                  |
| `postData.VaneVerticalDirection`?   | `null` \| [`Vertical`](README.md#vertical)           |
| `postData.VaneVerticalSwing`?       | `null` \| `boolean`                                  |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`setAta`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`setAta`](README.md#setata-1)

###### Source

[src/facades/base_super_device.ts:64](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base_super_device.ts#L64)

##### setFrostProtection()

```ts
setFrostProtection(__namedParameters: {
  enable: boolean;
  max: number;
  min: number;
}): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter                   | Type      |
| :-------------------------- | :-------- |
| `__namedParameters`         | `object`  |
| `__namedParameters.enable`? | `boolean` |
| `__namedParameters.max`     | `number`  |
| `__namedParameters.min`     | `number`  |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`setFrostProtection`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`setFrostProtection`](README.md#setfrostprotection-2)

###### Source

[src/facades/base.ts:152](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L152)

##### setHolidayMode()

```ts
setHolidayMode(__namedParameters: {
  days: number;
  enable: boolean;
  from: null | string;
  to: null | string;
}): Promise<SuccessData | FailureData>
```

###### Parameters

| Parameter                   | Type               |
| :-------------------------- | :----------------- |
| `__namedParameters`         | `object`           |
| `__namedParameters.days`?   | `number`           |
| `__namedParameters.enable`? | `boolean`          |
| `__namedParameters.from`?   | `null` \| `string` |
| `__namedParameters.to`?     | `null` \| `string` |

###### Returns

`Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>

###### Implementation of

`IBaseSuperDeviceFacade.setHolidayMode`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`setHolidayMode`](README.md#setholidaymode-2)

###### Source

[src/facades/base.ts:187](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L187)

##### setPower()

```ts
setPower(enable: boolean): Promise<boolean>
```

###### Parameters

| Parameter | Type      | Default value |
| :-------- | :-------- | :------------ |
| `enable`  | `boolean` | `true`        |

###### Returns

`Promise`\<`boolean`\>

###### Implementation of

[`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`setPower`

###### Inherited from

[`BaseSuperDeviceFacade`](README.md#basesuperdevicefacadet).[`setPower`](README.md#setpower-2)

###### Source

[src/facades/base.ts:217](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/base.ts#L217)

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

[src/models/floor.ts:26](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/floor.ts#L26)

##### areas

```ts
get areas(): AreaModel<number>[]
```

###### Returns

[`AreaModel`](README.md#areamodelt)\<`number`\>[]

###### Source

[src/models/floor.ts:30](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/floor.ts#L30)

##### building

```ts
get building(): null | BuildingModel
```

###### Returns

`null` \| [`BuildingModel`](README.md#buildingmodel)

###### Source

[src/models/floor.ts:36](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/floor.ts#L36)

##### deviceIds

```ts
get deviceIds(): number[]
```

###### Returns

`number`[]

###### Source

[src/models/floor.ts:40](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/floor.ts#L40)

##### devices

```ts
get devices(): DeviceModelAny[]
```

###### Returns

[`DeviceModelAny`](README.md#devicemodelany)[]

###### Source

[src/models/floor.ts:44](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/floor.ts#L44)

#### Methods

##### getAll()

```ts
static getAll(): FloorModel[]
```

###### Returns

[`FloorModel`](README.md#floormodel)[]

###### Source

[src/models/floor.ts:48](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/floor.ts#L48)

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

[src/models/floor.ts:52](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/floor.ts#L52)

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

[src/models/floor.ts:56](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/floor.ts#L56)

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

[src/models/floor.ts:60](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/floor.ts#L60)

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

[src/models/floor.ts:64](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/floor.ts#L64)

---

### default

#### Implements

- [`IMELCloudAPI`](README.md#imelcloudapi)

#### Constructors

##### new default()

```ts
new default(config: {
  autoSync: null | number;
  language: string;
  logger: Logger;
  settingManager: SettingManager;
  shouldVerifySSL: boolean;
  syncFunction: () => Promise<void>;
  timezone: string;
 }): default
```

###### Parameters

| Parameter                 | Type                                         |
| :------------------------ | :------------------------------------------- |
| `config`                  | `object`                                     |
| `config.autoSync`?        | `null` \| `number`                           |
| `config.language`?        | `string`                                     |
| `config.logger`?          | [`Logger`](README.md#logger)                 |
| `config.settingManager`?  | [`SettingManager`](README.md#settingmanager) |
| `config.shouldVerifySSL`? | `boolean`                                    |
| `config.syncFunction`?    | () => `Promise`\<`void`\>                    |
| `config.timezone`?        | `string`                                     |

###### Returns

[`default`](README.md#default)

###### Source

[src/services/api.ts:86](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/services/api.ts#L86)

#### Methods

##### applyLogin()

```ts
applyLogin(data?: LoginCredentials): Promise<boolean>
```

###### Parameters

| Parameter | Type                                             |
| :-------- | :----------------------------------------------- |
| `data`?   | [`LoginCredentials`](README.md#logincredentials) |

###### Returns

`Promise`\<`boolean`\>

###### Implementation of

[`IMELCloudAPI`](README.md#imelcloudapi).`applyLogin`

###### Source

[src/services/api.ts:157](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/services/api.ts#L157)

##### clearSync()

```ts
clearSync(): void
```

###### Returns

`void`

###### Source

[src/services/api.ts:183](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/services/api.ts#L183)

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

[src/services/api.ts:190](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/services/api.ts#L190)

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

[src/services/api.ts:213](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/services/api.ts#L213)

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

[src/services/api.ts:223](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/services/api.ts#L223)

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

[src/services/api.ts:231](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/services/api.ts#L231)

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

[src/services/api.ts:242](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/services/api.ts#L242)

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

[src/services/api.ts:252](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/services/api.ts#L252)

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

[src/services/api.ts:262](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/services/api.ts#L262)

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

[src/services/api.ts:267](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/services/api.ts#L267)

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

[src/services/api.ts:280](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/services/api.ts#L280)

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

[src/services/api.ts:288](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/services/api.ts#L288)

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

[src/services/api.ts:307](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/services/api.ts#L307)

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

[src/services/api.ts:322](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/services/api.ts#L322)

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

[src/services/api.ts:335](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/services/api.ts#L335)

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

[src/services/api.ts:346](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/services/api.ts#L346)

##### setLanguage()

```ts
setLanguage(language: string): Promise<{
  data: boolean;
}>
```

###### Parameters

| Parameter  | Type     |
| :--------- | :------- |
| `language` | `string` |

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

[src/services/api.ts:357](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/services/api.ts#L357)

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

[src/services/api.ts:367](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/services/api.ts#L367)

##### sync()

```ts
sync(): Promise<void>
```

###### Returns

`Promise`\<`void`\>

###### Source

[src/services/api.ts:375](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/services/api.ts#L375)

## Interfaces

### APISettings

#### Properties

| Property      | Type               |
| :------------ | :----------------- |
| `contextKey?` | `null` \| `string` |
| `expiry?`     | `null` \| `string` |
| `password?`   | `null` \| `string` |
| `username?`   | `null` \| `string` |

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

| Property          | Modifier   | Type      |
| :---------------- | :--------- | :-------- |
| `EffectiveFlags?` | `public`   | `number`  |
| `Power?`          | `readonly` | `boolean` |

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

### DateTimeComponents

#### Properties

| Property | Modifier   | Type     |
| :------- | :--------- | :------- |
| `Day`    | `readonly` | `number` |
| `Hour`   | `readonly` | `number` |
| `Minute` | `readonly` | `number` |
| `Month`  | `readonly` | `number` |
| `Second` | `readonly` | `number` |
| `Year`   | `readonly` | `number` |

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

### FrostProtectionLocation

#### Extended by

- [`FrostProtectionPostData`](README.md#frostprotectionpostdata)

#### Properties

| Property       | Modifier   | Type                |
| :------------- | :--------- | :------------------ |
| `AreaIds?`     | `readonly` | readonly `number`[] |
| `BuildingIds?` | `readonly` | readonly `number`[] |
| `DeviceIds?`   | `readonly` | readonly `number`[] |
| `FloorIds?`    | `readonly` | readonly `number`[] |

---

### FrostProtectionPostData

#### Extends

- [`FrostProtectionLocation`](README.md#frostprotectionlocation)

#### Properties

| Property             | Modifier   | Type                | Inherited from                                                               |
| :------------------- | :--------- | :------------------ | :--------------------------------------------------------------------------- |
| `AreaIds?`           | `readonly` | readonly `number`[] | [`FrostProtectionLocation`](README.md#frostprotectionlocation).`AreaIds`     |
| `BuildingIds?`       | `readonly` | readonly `number`[] | [`FrostProtectionLocation`](README.md#frostprotectionlocation).`BuildingIds` |
| `DeviceIds?`         | `readonly` | readonly `number`[] | [`FrostProtectionLocation`](README.md#frostprotectionlocation).`DeviceIds`   |
| `Enabled`            | `readonly` | `boolean`           | -                                                                            |
| `FloorIds?`          | `readonly` | readonly `number`[] | [`FrostProtectionLocation`](README.md#frostprotectionlocation).`FloorIds`    |
| `MaximumTemperature` | `readonly` | `number`            | -                                                                            |
| `MinimumTemperature` | `readonly` | `number`            | -                                                                            |

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

### HMTimeZone

#### Extends

- [`HolidayModeLocation`](README.md#holidaymodelocation)

#### Properties

| Property     | Modifier   | Type                | Inherited from                                                     |
| :----------- | :--------- | :------------------ | :----------------------------------------------------------------- |
| `Areas?`     | `readonly` | readonly `number`[] | [`HolidayModeLocation`](README.md#holidaymodelocation).`Areas`     |
| `Buildings?` | `readonly` | readonly `number`[] | [`HolidayModeLocation`](README.md#holidaymodelocation).`Buildings` |
| `Devices?`   | `readonly` | readonly `number`[] | [`HolidayModeLocation`](README.md#holidaymodelocation).`Devices`   |
| `Floors?`    | `readonly` | readonly `number`[] | [`HolidayModeLocation`](README.md#holidaymodelocation).`Floors`    |
| `TimeZone?`  | `readonly` | `number`            | -                                                                  |

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

### HolidayModeLocation

#### Extended by

- [`HMTimeZone`](README.md#hmtimezone)

#### Properties

| Property     | Modifier   | Type                |
| :----------- | :--------- | :------------------ |
| `Areas?`     | `readonly` | readonly `number`[] |
| `Buildings?` | `readonly` | readonly `number`[] |
| `Devices?`   | `readonly` | readonly `number`[] |
| `Floors?`    | `readonly` | readonly `number`[] |

---

### HolidayModePostData

#### Properties

| Property      | Modifier   | Type                                                           |
| :------------ | :--------- | :------------------------------------------------------------- |
| `Enabled`     | `readonly` | `boolean`                                                      |
| `EndDate`     | `readonly` | `null` \| [`DateTimeComponents`](README.md#datetimecomponents) |
| `HMTimeZones` | `readonly` | readonly [`HMTimeZone`](README.md#hmtimezone)[]                |
| `StartDate`   | `readonly` | `null` \| [`DateTimeComponents`](README.md#datetimecomponents) |

---

### IAreaModel

#### Extends

- [`IBaseSubFloorModel`](README.md#ibasesubfloormodel).[`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel)

#### Properties

| Property     | Type                                                    | Inherited from                                                         |
| :----------- | :------------------------------------------------------ | :--------------------------------------------------------------------- |
| `building`   | `null` \| [`BuildingModel`](README.md#buildingmodel)    | [`IBaseSubFloorModel`](README.md#ibasesubfloormodel).`building`        |
| `buildingId` | `number`                                                | [`IBaseSubFloorModel`](README.md#ibasesubfloormodel).`buildingId`      |
| `deviceIds`  | readonly `number`[]                                     | [`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel).`deviceIds` |
| `devices`    | readonly [`DeviceModelAny`](README.md#devicemodelany)[] | [`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel).`devices`   |
| `floor`      | `null` \| [`FloorModel`](README.md#floormodel)          | [`IBaseSubFloorModel`](README.md#ibasesubfloormodel).`floor`           |
| `floorId`    | `null` \| `number`                                      | [`IBaseSubFloorModel`](README.md#ibasesubfloormodel).`floorId`         |
| `id`         | `number`                                                | [`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel).`id`        |
| `name`       | `string`                                                | [`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel).`name`      |

---

### IBaseFacade

#### Extended by

- [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade)
- [`IDeviceFacade`](README.md#idevicefacadet)

#### Properties

| Property             | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getErrors`          | (`__namedParameters`: \{ `from`: `null` \| `string`; `to`: `null` \| `string`; \}) => `Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>                                                                                                                                                                                                                                                                                                                                                                                            |
| `getFrostProtection` | () => `Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `getHolidayMode`     | () => `Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `getWifiReport`      | (`hour`: `number`) => `Promise`\<[`WifiData`](README.md#wifidata)\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `setFrostProtection` | (`__namedParameters`: \{ `enable`: `boolean`; `max`: `number`; `min`: `number`; \}) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>                                                                                                                                                                                                                                                                                                                                                                                         |
| `setHolidayMode`     | (`__namedParameters`: \{ `enable`: `false`; `from`: `null`; `to`: `null`; \}) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> & (`__namedParameters`: \{ `enable`: `true`; `from`: `null` \| `string`; `to`: `string`; \}) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> & (`__namedParameters`: \{ `days`: `number`; `enable`: `true`; `from`: `null` \| `string`; \}) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> |
| `setPower`           | (`enable`?: `boolean`) => `Promise`\<`boolean`\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

---

### IBaseModel

#### Extended by

- [`IBaseSubBuildingModel`](README.md#ibasesubbuildingmodel)
- [`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel)

#### Properties

| Property | Type     |
| :------- | :------- |
| `id`     | `number` |
| `name`   | `string` |

---

### IBaseSubBuildingModel

#### Extends

- [`IBaseModel`](README.md#ibasemodel)

#### Extended by

- [`IBaseSubFloorModel`](README.md#ibasesubfloormodel)
- [`IFloorModel`](README.md#ifloormodel)

#### Properties

| Property     | Type                                                 | Inherited from                              |
| :----------- | :--------------------------------------------------- | :------------------------------------------ |
| `building`   | `null` \| [`BuildingModel`](README.md#buildingmodel) | -                                           |
| `buildingId` | `number`                                             | -                                           |
| `id`         | `number`                                             | [`IBaseModel`](README.md#ibasemodel).`id`   |
| `name`       | `string`                                             | [`IBaseModel`](README.md#ibasemodel).`name` |

---

### IBaseSubFloorModel

#### Extends

- [`IBaseSubBuildingModel`](README.md#ibasesubbuildingmodel)

#### Extended by

- [`IAreaModel`](README.md#iareamodel)
- [`IDeviceModel`](README.md#idevicemodelt)

#### Properties

| Property     | Type                                                 | Inherited from                                                          |
| :----------- | :--------------------------------------------------- | :---------------------------------------------------------------------- |
| `building`   | `null` \| [`BuildingModel`](README.md#buildingmodel) | [`IBaseSubBuildingModel`](README.md#ibasesubbuildingmodel).`building`   |
| `buildingId` | `number`                                             | [`IBaseSubBuildingModel`](README.md#ibasesubbuildingmodel).`buildingId` |
| `floor`      | `null` \| [`FloorModel`](README.md#floormodel)       | -                                                                       |
| `floorId`    | `null` \| `number`                                   | -                                                                       |
| `id`         | `number`                                             | [`IBaseSubBuildingModel`](README.md#ibasesubbuildingmodel).`id`         |
| `name`       | `string`                                             | [`IBaseSubBuildingModel`](README.md#ibasesubbuildingmodel).`name`       |

---

### IBaseSuperDeviceFacade

#### Extends

- [`IBaseFacade`](README.md#ibasefacade)

#### Extended by

- [`IBuildingFacade`](README.md#ibuildingfacade)

#### Properties

| Property             | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Inherited from                                              |
| :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| `getAta`             | () => \{ `FanSpeed`: `null` \| [`FanSpeed`](README.md#fanspeed); `OperationMode`: `null` \| [`OperationMode`](README.md#operationmode); `Power`: `null` \| `boolean`; `SetTemperature`: `null` \| `number`; `VaneHorizontalDirection`: `null` \| [`Horizontal`](README.md#horizontal); `VaneHorizontalSwing`: `null` \| `boolean`; `VaneVerticalDirection`: `null` \| [`Vertical`](README.md#vertical); `VaneVerticalSwing`: `null` \| `boolean`; \}                                                                                                                         | -                                                           |
| `getErrors`          | (`__namedParameters`: \{ `from`: `null` \| `string`; `to`: `null` \| `string`; \}) => `Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>                                                                                                                                                                                                                                                                                                                                                                                            | [`IBaseFacade`](README.md#ibasefacade).`getErrors`          |
| `getFrostProtection` | () => `Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | [`IBaseFacade`](README.md#ibasefacade).`getFrostProtection` |
| `getHolidayMode`     | () => `Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | [`IBaseFacade`](README.md#ibasefacade).`getHolidayMode`     |
| `getTiles`           | () => `Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | -                                                           |
| `getWifiReport`      | (`hour`: `number`) => `Promise`\<[`WifiData`](README.md#wifidata)\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [`IBaseFacade`](README.md#ibasefacade).`getWifiReport`      |
| `setAta`             | (`postData`: \{ `FanSpeed`: `null` \| [`FanSpeed`](README.md#fanspeed); `OperationMode`: `null` \| [`OperationMode`](README.md#operationmode); `Power`: `null` \| `boolean`; `SetTemperature`: `null` \| `number`; `VaneHorizontalDirection`: `null` \| [`Horizontal`](README.md#horizontal); `VaneHorizontalSwing`: `null` \| `boolean`; `VaneVerticalDirection`: `null` \| [`Vertical`](README.md#vertical); `VaneVerticalSwing`: `null` \| `boolean`; \}) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>                | -                                                           |
| `setFrostProtection` | (`__namedParameters`: \{ `enable`: `boolean`; `max`: `number`; `min`: `number`; \}) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>                                                                                                                                                                                                                                                                                                                                                                                         | [`IBaseFacade`](README.md#ibasefacade).`setFrostProtection` |
| `setHolidayMode`     | (`__namedParameters`: \{ `enable`: `false`; `from`: `null`; `to`: `null`; \}) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> & (`__namedParameters`: \{ `enable`: `true`; `from`: `null` \| `string`; `to`: `string`; \}) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> & (`__namedParameters`: \{ `days`: `number`; `enable`: `true`; `from`: `null` \| `string`; \}) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> | [`IBaseFacade`](README.md#ibasefacade).`setHolidayMode`     |
| `setPower`           | (`enable`?: `boolean`) => `Promise`\<`boolean`\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | [`IBaseFacade`](README.md#ibasefacade).`setPower`           |

---

### IBaseSuperDeviceModel

#### Extends

- [`IBaseModel`](README.md#ibasemodel)

#### Extended by

- [`IAreaModel`](README.md#iareamodel)
- [`IBuildingModel`](README.md#ibuildingmodel)
- [`IFloorModel`](README.md#ifloormodel)

#### Properties

| Property    | Type                                                    | Inherited from                              |
| :---------- | :------------------------------------------------------ | :------------------------------------------ |
| `deviceIds` | readonly `number`[]                                     | -                                           |
| `devices`   | readonly [`DeviceModelAny`](README.md#devicemodelany)[] | -                                           |
| `id`        | `number`                                                | [`IBaseModel`](README.md#ibasemodel).`id`   |
| `name`      | `string`                                                | [`IBaseModel`](README.md#ibasemodel).`name` |

---

### IBuildingFacade

#### Extends

- [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade)

#### Properties

| Property             | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Inherited from                                                                    |
| :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| `data`               | [`BuildingSettings`](README.md#buildingsettings)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | -                                                                                 |
| `fetch`              | () => `Promise`\<[`BuildingSettings`](README.md#buildingsettings)\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | -                                                                                 |
| `getAta`             | () => \{ `FanSpeed`: `null` \| [`FanSpeed`](README.md#fanspeed); `OperationMode`: `null` \| [`OperationMode`](README.md#operationmode); `Power`: `null` \| `boolean`; `SetTemperature`: `null` \| `number`; `VaneHorizontalDirection`: `null` \| [`Horizontal`](README.md#horizontal); `VaneHorizontalSwing`: `null` \| `boolean`; `VaneVerticalDirection`: `null` \| [`Vertical`](README.md#vertical); `VaneVerticalSwing`: `null` \| `boolean`; \}                                                                                                                         | [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getAta`             |
| `getErrors`          | (`__namedParameters`: \{ `from`: `null` \| `string`; `to`: `null` \| `string`; \}) => `Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>                                                                                                                                                                                                                                                                                                                                                                                            | [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getErrors`          |
| `getFrostProtection` | () => `Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getFrostProtection` |
| `getHolidayMode`     | () => `Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getHolidayMode`     |
| `getTiles`           | () => `Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getTiles`           |
| `getWifiReport`      | (`hour`: `number`) => `Promise`\<[`WifiData`](README.md#wifidata)\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`getWifiReport`      |
| `setAta`             | (`postData`: \{ `FanSpeed`: `null` \| [`FanSpeed`](README.md#fanspeed); `OperationMode`: `null` \| [`OperationMode`](README.md#operationmode); `Power`: `null` \| `boolean`; `SetTemperature`: `null` \| `number`; `VaneHorizontalDirection`: `null` \| [`Horizontal`](README.md#horizontal); `VaneHorizontalSwing`: `null` \| `boolean`; `VaneVerticalDirection`: `null` \| [`Vertical`](README.md#vertical); `VaneVerticalSwing`: `null` \| `boolean`; \}) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>                | [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`setAta`             |
| `setFrostProtection` | (`__namedParameters`: \{ `enable`: `boolean`; `max`: `number`; `min`: `number`; \}) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>                                                                                                                                                                                                                                                                                                                                                                                         | [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`setFrostProtection` |
| `setHolidayMode`     | (`__namedParameters`: \{ `enable`: `false`; `from`: `null`; `to`: `null`; \}) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> & (`__namedParameters`: \{ `enable`: `true`; `from`: `null` \| `string`; `to`: `string`; \}) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> & (`__namedParameters`: \{ `days`: `number`; `enable`: `true`; `from`: `null` \| `string`; \}) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> | [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`setHolidayMode`     |
| `setPower`           | (`enable`?: `boolean`) => `Promise`\<`boolean`\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | [`IBaseSuperDeviceFacade`](README.md#ibasesuperdevicefacade).`setPower`           |

---

### IBuildingModel

#### Extends

- [`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel)

#### Properties

| Property    | Type                                                    | Inherited from                                                         |
| :---------- | :------------------------------------------------------ | :--------------------------------------------------------------------- |
| `data`      | [`BuildingSettings`](README.md#buildingsettings)        | -                                                                      |
| `deviceIds` | readonly `number`[]                                     | [`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel).`deviceIds` |
| `devices`   | readonly [`DeviceModelAny`](README.md#devicemodelany)[] | [`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel).`devices`   |
| `id`        | `number`                                                | [`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel).`id`        |
| `name`      | `string`                                                | [`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel).`name`      |

---

### IDeviceFacade\<T\>

#### Extends

- [`IBaseFacade`](README.md#ibasefacade)

#### Type parameters

| Type parameter                                                    |
| :---------------------------------------------------------------- |
| `T` _extends_ keyof _typeof_ [`DeviceType`](README.md#devicetype) |

#### Properties

| Property             | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Inherited from                                              |
| :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| `data`               | [`ListDevice`](README.md#listdevice)\[`T`\]\[`"Device"`\]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | -                                                           |
| `fetch`              | () => `Promise`\<[`ListDevice`](README.md#listdevice)\[`T`\]\[`"Device"`\]\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -                                                           |
| `get`                | () => `Promise`\<[`GetDeviceData`](README.md#getdevicedata)\[`T`\]\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | -                                                           |
| `getEnergyReport`    | (`__namedParameters`: \{ `from`: `null` \| `string`; `to`: `null` \| `string`; \}) => `Promise`\<[`EnergyData`](README.md#energydata)\[`T`\]\>                                                                                                                                                                                                                                                                                                                                                                                                                               | -                                                           |
| `getErrors`          | (`__namedParameters`: \{ `from`: `null` \| `string`; `to`: `null` \| `string`; \}) => `Promise`\<[`FailureData`](README.md#failuredata) \| [`ErrorData`](README.md#errordata)[]\>                                                                                                                                                                                                                                                                                                                                                                                            | [`IBaseFacade`](README.md#ibasefacade).`getErrors`          |
| `getFrostProtection` | () => `Promise`\<[`FrostProtectionData`](README.md#frostprotectiondata)\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | [`IBaseFacade`](README.md#ibasefacade).`getFrostProtection` |
| `getHolidayMode`     | () => `Promise`\<[`HolidayModeData`](README.md#holidaymodedata)\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | [`IBaseFacade`](README.md#ibasefacade).`getHolidayMode`     |
| `getTile`            | (`select`?: `false`) => `Promise`\<[`TilesData`](README.md#tilesdatat)\<`null`\>\> & (`select`: `true`) => `Promise`\<[`TilesData`](README.md#tilesdatat)\<`T`\>\>                                                                                                                                                                                                                                                                                                                                                                                                           | -                                                           |
| `getWifiReport`      | (`hour`: `number`) => `Promise`\<[`WifiData`](README.md#wifidata)\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [`IBaseFacade`](README.md#ibasefacade).`getWifiReport`      |
| `set`                | (`postData`: [`UpdateDeviceData`](README.md#updatedevicedata)\[`T`\]) => `Promise`\<[`SetDeviceData`](README.md#setdevicedata)\[`T`\]\>                                                                                                                                                                                                                                                                                                                                                                                                                                      | -                                                           |
| `setFrostProtection` | (`__namedParameters`: \{ `enable`: `boolean`; `max`: `number`; `min`: `number`; \}) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\>                                                                                                                                                                                                                                                                                                                                                                                         | [`IBaseFacade`](README.md#ibasefacade).`setFrostProtection` |
| `setHolidayMode`     | (`__namedParameters`: \{ `enable`: `false`; `from`: `null`; `to`: `null`; \}) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> & (`__namedParameters`: \{ `enable`: `true`; `from`: `null` \| `string`; `to`: `string`; \}) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> & (`__namedParameters`: \{ `days`: `number`; `enable`: `true`; `from`: `null` \| `string`; \}) => `Promise`\<[`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata)\> | [`IBaseFacade`](README.md#ibasefacade).`setHolidayMode`     |
| `setPower`           | (`enable`?: `boolean`) => `Promise`\<`boolean`\>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | [`IBaseFacade`](README.md#ibasefacade).`setPower`           |

---

### IDeviceModel\<T\>

#### Extends

- [`IBaseSubFloorModel`](README.md#ibasesubfloormodel)

#### Type parameters

| Type parameter                                                    |
| :---------------------------------------------------------------- |
| `T` _extends_ keyof _typeof_ [`DeviceType`](README.md#devicetype) |

#### Properties

| Property     | Type                                                      | Inherited from                                                    |
| :----------- | :-------------------------------------------------------- | :---------------------------------------------------------------- |
| `area`       | `null` \| [`AreaModelAny`](README.md#areamodelany)        | -                                                                 |
| `areaId`     | `null` \| `number`                                        | -                                                                 |
| `building`   | `null` \| [`BuildingModel`](README.md#buildingmodel)      | [`IBaseSubFloorModel`](README.md#ibasesubfloormodel).`building`   |
| `buildingId` | `number`                                                  | [`IBaseSubFloorModel`](README.md#ibasesubfloormodel).`buildingId` |
| `data`       | [`ListDevice`](README.md#listdevice)\[`T`\]\[`"Device"`\] | -                                                                 |
| `floor`      | `null` \| [`FloorModel`](README.md#floormodel)            | [`IBaseSubFloorModel`](README.md#ibasesubfloormodel).`floor`      |
| `floorId`    | `null` \| `number`                                        | [`IBaseSubFloorModel`](README.md#ibasesubfloormodel).`floorId`    |
| `id`         | `number`                                                  | [`IBaseSubFloorModel`](README.md#ibasesubfloormodel).`id`         |
| `name`       | `string`                                                  | [`IBaseSubFloorModel`](README.md#ibasesubfloormodel).`name`       |
| `type`       | `T`                                                       | -                                                                 |

---

### IFloorModel

#### Extends

- [`IBaseSubBuildingModel`](README.md#ibasesubbuildingmodel).[`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel)

#### Properties

| Property     | Type                                                       | Inherited from                                                          |
| :----------- | :--------------------------------------------------------- | :---------------------------------------------------------------------- |
| `areaIds`    | readonly `number`[]                                        | -                                                                       |
| `areas`      | readonly [`AreaModel`](README.md#areamodelt)\<`number`\>[] | -                                                                       |
| `building`   | `null` \| [`BuildingModel`](README.md#buildingmodel)       | [`IBaseSubBuildingModel`](README.md#ibasesubbuildingmodel).`building`   |
| `buildingId` | `number`                                                   | [`IBaseSubBuildingModel`](README.md#ibasesubbuildingmodel).`buildingId` |
| `deviceIds`  | readonly `number`[]                                        | [`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel).`deviceIds`  |
| `devices`    | readonly [`DeviceModelAny`](README.md#devicemodelany)[]    | [`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel).`devices`    |
| `id`         | `number`                                                   | [`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel).`id`         |
| `name`       | `string`                                                   | [`IBaseSuperDeviceModel`](README.md#ibasesuperdevicemodel).`name`       |

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
| `getWifiReport`      | (`__namedParameters`: \{ `postData`: [`WifiPostData`](README.md#wifipostdata); \}) => `Promise`\<\{ `data`: [`WifiData`](README.md#wifidata); \}\>                                                                                                                                                                                                           |
| `login`              | (`__namedParameters`: \{ `postData`: [`LoginPostData`](README.md#loginpostdata); \}) => `Promise`\<\{ `data`: [`LoginData`](README.md#logindata); \}\>                                                                                                                                                                                                       |
| `setAtaGroup`        | (`__namedParameters`: \{ `postData`: [`SetAtaGroupPostData`](README.md#setatagrouppostdata); \}) => `Promise`\<\{ `data`: [`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata); \}\>                                                                                                                                             |
| `setDevice`          | \<`T`\>(`__namedParameters`: \{ `heatPumpType`: `T`; `postData`: [`SetDevicePostData`](README.md#setdevicepostdatat)\<`T`\>; \}) => `Promise`\<\{ `data`: [`SetDeviceData`](README.md#setdevicedata)\[`T`\]; \}\>                                                                                                                                            |
| `setFrostProtection` | (`__namedParameters`: \{ `postData`: [`FrostProtectionPostData`](README.md#frostprotectionpostdata); \}) => `Promise`\<\{ `data`: [`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata); \}\>                                                                                                                                     |
| `setHolidayMode`     | (`__namedParameters`: \{ `postData`: [`HolidayModePostData`](README.md#holidaymodepostdata); \}) => `Promise`\<\{ `data`: [`SuccessData`](README.md#successdata) \| [`FailureData`](README.md#failuredata); \}\>                                                                                                                                             |
| `setLanguage`        | (`language`: `string`) => `Promise`\<\{ `data`: `boolean`; \}\>                                                                                                                                                                                                                                                                                              |
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

### ListDeviceData

#### Properties

| Property | Modifier   | Type                                               |
| :------- | :--------- | :------------------------------------------------- |
| `Ata`    | `readonly` | [`ListDeviceDataAta`](README.md#listdevicedataata) |
| `Atw`    | `readonly` | [`ListDeviceDataAtw`](README.md#listdevicedataatw) |
| `Erv`    | `readonly` | [`ListDeviceDataErv`](README.md#listdevicedataerv) |

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

| Property | Type                                                        |
| :------- | :---------------------------------------------------------- |
| `error`  | (`message`?: `any`, ...`optionalParams`: `any`[]) => `void` |
| `log`    | (`message`?: `any`, ...`optionalParams`: `any`[]) => `void` |

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

| Property                         | Modifier   | Type                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| :------------------------------- | :--------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Specification`                  | `readonly` | \{ `AreaID`: `null` \| `number`; `BuildingID`: `null` \| `number`; `FloorID`: `null` \| `number`; \}                                                                                                                                                                                                                                                                                                                                           |
| `Specification.AreaID?`          | `readonly` | `null` \| `number`                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `Specification.BuildingID?`      | `public`   | `null` \| `number`                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `Specification.FloorID?`         | `public`   | `null` \| `number`                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `State`                          | `public`   | \{ `FanSpeed`: `null` \| [`FanSpeed`](README.md#fanspeed); `OperationMode`: `null` \| [`OperationMode`](README.md#operationmode); `Power`: `null` \| `boolean`; `SetTemperature`: `null` \| `number`; `VaneHorizontalDirection`: `null` \| [`Horizontal`](README.md#horizontal); `VaneHorizontalSwing`: `null` \| `boolean`; `VaneVerticalDirection`: `null` \| [`Vertical`](README.md#vertical); `VaneVerticalSwing`: `null` \| `boolean`; \} |
| `State.FanSpeed?`                | `public`   | `null` \| [`FanSpeed`](README.md#fanspeed)                                                                                                                                                                                                                                                                                                                                                                                                     |
| `State.OperationMode?`           | `public`   | `null` \| [`OperationMode`](README.md#operationmode)                                                                                                                                                                                                                                                                                                                                                                                           |
| `State.Power?`                   | `public`   | `null` \| `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `State.SetTemperature?`          | `public`   | `null` \| `number`                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `State.VaneHorizontalDirection?` | `public`   | `null` \| [`Horizontal`](README.md#horizontal)                                                                                                                                                                                                                                                                                                                                                                                                 |
| `State.VaneHorizontalSwing?`     | `public`   | `null` \| `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `State.VaneVerticalDirection?`   | `public`   | `null` \| [`Vertical`](README.md#vertical)                                                                                                                                                                                                                                                                                                                                                                                                     |
| `State.VaneVerticalSwing?`       | `public`   | `null` \| `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                            |

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
| `EffectiveFlags?` | `public`   | `number`                                                                  | [`BaseUpdateDeviceData`](README.md#baseupdatedevicedata).`EffectiveFlags` |
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
| `EffectiveFlags?`              | `public`   | `number`                                           | [`BaseUpdateDeviceData`](README.md#baseupdatedevicedata).`EffectiveFlags` |
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
| `EffectiveFlags?`  | `public`   | `number`                                                                  | [`BaseUpdateDeviceData`](README.md#baseupdatedevicedata).`EffectiveFlags` |
| `Power?`           | `readonly` | `boolean`                                                                 | [`BaseUpdateDeviceData`](README.md#baseupdatedevicedata).`Power`          |
| `SetFanSpeed?`     | `readonly` | \| `auto` \| `very_slow` \| `slow` \| `moderate` \| `fast` \| `very_fast` | -                                                                         |
| `VentilationMode?` | `readonly` | [`VentilationMode`](README.md#ventilationmode)                            | -                                                                         |

---

### WifiData

#### Properties

| Property   | Modifier   | Type                                       |
| :--------- | :--------- | :----------------------------------------- |
| `Data`     | `readonly` | readonly readonly (`null` \| `number`)[][] |
| `FromDate` | `readonly` | `string`                                   |
| `Labels`   | `readonly` | readonly `string`[]                        |
| `ToDate`   | `readonly` | `string`                                   |

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

[src/types/common.ts:201](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/types/common.ts#L201)

---

### AreaModelAny

```ts
type AreaModelAny: AreaModel<number> | AreaModel<null>;
```

#### Source

[src/models/area.ts:7](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/area.ts#L7)

---

### DeviceModelAny

```ts
type DeviceModelAny: DeviceModel<"Ata"> | DeviceModel<"Atw"> | DeviceModel<"Erv">;
```

#### Source

[src/models/device.ts:7](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/models/device.ts#L7)

---

### GetDeviceDataAta

```ts
type GetDeviceDataAta: BaseGetDeviceData & SetDeviceDataAta;
```

#### Source

[src/types/ata.ts:70](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/types/ata.ts#L70)

---

### GetDeviceDataAtw

```ts
type GetDeviceDataAtw: BaseGetDeviceData & SetDeviceDataAtw;
```

#### Source

[src/types/atw.ts:77](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/types/atw.ts#L77)

---

### GetDeviceDataErv

```ts
type GetDeviceDataErv: BaseGetDeviceData & SetDeviceDataErv;
```

#### Source

[src/types/erv.ts:43](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/types/erv.ts#L43)

---

### ListDeviceAny

```ts
type ListDeviceAny: ListDeviceAta | ListDeviceAtw | ListDeviceErv;
```

#### Source

[src/types/common.ts:216](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/types/common.ts#L216)

---

### ListDeviceDataAny

```ts
type ListDeviceDataAny: ListDeviceDataAta | ListDeviceDataAtw | ListDeviceDataErv;
```

#### Source

[src/types/common.ts:207](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/types/common.ts#L207)

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

[src/types/bases.ts:19](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/types/bases.ts#L19)

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

[src/types/bases.ts:21](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/types/bases.ts#L21)

---

### SetDevicePostData\<T\>

```ts
type SetDevicePostData<T>: UpdateDeviceData[T] & Required<{
  EffectiveFlags: number;
 }> & BaseDevicePostData;
```

#### Type parameters

| Type parameter                                                    |
| :---------------------------------------------------------------- |
| `T` _extends_ keyof _typeof_ [`DeviceType`](README.md#devicetype) |

#### Source

[src/types/common.ts:91](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/types/common.ts#L91)

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

[src/types/common.ts:260](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/types/common.ts#L260)

## Variables

### FLAG_UNCHANGED

```ts
const FLAG_UNCHANGED: 0 = 0x0
```

#### Source

[src/types/bases.ts:1](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/types/bases.ts#L1)

---

### YEAR_1970

```ts
const YEAR_1970: '1970-01-01' = '1970-01-01'
```

#### Source

[src/facades/utils.ts:3](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/utils.ts#L3)

---

### effectiveFlagsAta

```ts
const effectiveFlagsAta: Record<
  NonEffectiveFlagsKeyOf<UpdateDeviceDataAta>,
  number
>
```

#### Source

[src/types/ata.ts:50](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/types/ata.ts#L50)

---

### effectiveFlagsAtw

```ts
const effectiveFlagsAtw: Record<
  NonEffectiveFlagsKeyOf<UpdateDeviceDataAtw>,
  number
>
```

#### Source

[src/types/atw.ts:42](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/types/atw.ts#L42)

---

### effectiveFlagsErv

```ts
const effectiveFlagsErv: Record<
  NonEffectiveFlagsKeyOf<UpdateDeviceDataErv>,
  number
>
```

#### Source

[src/types/erv.ts:24](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/types/erv.ts#L24)

## Functions

### nowISO()

```ts
function nowISO(): string
```

#### Returns

`string`

#### Source

[src/facades/utils.ts:4](https://github.com/OlivierZal/melcloud-api/blob/769af426e8f947367af8defbb6a1b6974d05d37a/src/facades/utils.ts#L4)
