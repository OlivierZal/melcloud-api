# Plan de refactoring - @olivierzal/melcloud-api

## Vue d'ensemble

Refonte complète du module en 5 phases incrémentales. Chaque phase compile et lint proprement avant de passer à la suivante. Version finale : v22.0.0 (breaking changes en phases 3-4).

**Objectifs principaux :**
- Migrer les `enum` vers `as const` objects + union types
- Réduire les `eslint-disable` de 18 à ~2
- Remplacer les `Map` statiques par un `ModelRegistry` (injection de dépendances)
- Préparer l'architecture dual-API (MELCloud + MELCloud Home)
- Ajouter vitest + tests unitaires
- Patterns modernes : `Symbol.dispose`, `satisfies`, `Object.groupBy`, etc.

---

## Phase 1 : Fondations type-safe (non-breaking)

### 1.1 Migrer les enums vers `as const` objects

**Fichier :** `src/enums.ts` -> renommer en `src/constants.ts` (fusionner avec l'existant)

Remplacer les 10 enums par des objets `as const` + union types. Exemple :

```typescript
// Avant
export enum DeviceType { Ata = 0, Atw = 1, Erv = 3 }

// Après
export const DeviceType = { Ata: 0, Atw: 1, Erv: 3 } as const
export type DeviceType = typeof DeviceType[keyof typeof DeviceType]
```

Idem pour : `FanSpeed`, `Horizontal`, `LabelType`, `Language`, `OperationMode`, `OperationModeState`, `OperationModeZone`, `VentilationMode`, `Vertical`.

**Impact :**
- `enums.ts` supprimé, contenu fusionné dans `constants.ts`
- L'ESLint rule `perfectionist/sort-enums` ne s'applique plus (pas de breaking)
- Le naming convention `enumMember` dans ESLint doit être adapté -> utiliser `objectLiteralProperty` à la place
- Le `no-magic-numbers.ignoreEnums` ne s'applique plus -> les valeurs sont dans un objet `as const`, qui est une constante
- `DeviceType[type]` dans `api.ts:417` (`DeviceType[type]` pour construire l'URL) utilise le reverse mapping des enums numériques -> remplacer par un objet de lookup explicite `const DEVICE_TYPE_NAMES: Record<DeviceType, string> = { [DeviceType.Ata]: 'Ata', ... }`
- `Language[language]` dans `api.ts:562` utilise aussi le reverse mapping -> même pattern
- `isLanguage` type guard à adapter

### 1.2 Supprimer les dépendances mortes

- **`core-js`** : Aucun import dans le code source. Supprimer de `package.json`.
- **`https` (npm)** : Stub inutile, le code importe `node:https`. Supprimer.
- **`source-map-support`** : Side-effect import dans un package `sideEffects: false` = bug latent pour les tree-shakers. Node.js 22+ supporte `--enable-source-maps` nativement. Supprimer la dépendance + l'import dans `main.ts` + la rule `import-x/no-unassigned-import.allow`.

### 1.3 Utilitaires type-safe pour `Object.fromEntries`/`Object.keys`

**Nouveau fichier :** `src/type-helpers.ts`

```typescript
// Les 2 seuls eslint-disable du projet
export const typedFromEntries = <K extends PropertyKey, V>(
  entries: readonly (readonly [K, V])[],
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
): Record<K, V> => Object.fromEntries(entries) as Record<K, V>

export const typedKeys = <T extends Record<string, unknown>>(
  obj: T,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
): (keyof T & string)[] => Object.keys(obj) as (keyof T & string)[]
```

### 1.4 Affiner le type `ListDevice<T>` pour éliminer les assertions dans DeviceModel

**Fichier :** `src/types/bases.ts`

Rendre `BaseListDevice` générique pour que `Type` soit déjà narrowé :

```typescript
export interface BaseListDevice<T extends DeviceType = DeviceType> {
  readonly Type: T  // narrowed au lieu de DeviceType
  // ... reste identique
}
```

**Fichier :** `src/types/generic.ts` - `ListDevice<T>` hérite de `BaseListDevice<T>` -> `Type` est automatiquement `T`.

**Impact :** Dans `DeviceModel` constructor, `type as T` et `data as ListDeviceData<T>` ne sont plus nécessaires car les types sont déjà corrects.

### 1.5 Éliminer les assertions dans `BaseDeviceFacade`

Avec la phase 1.4, les assertions liées au type narrowing disparaissent. Pour les assertions `Object.fromEntries` dans `setData` et `setValues`, utiliser `typedFromEntries` et `typedKeys` de 1.3.

Pour le constructeur `super(api, instance as IDeviceModelAny)` : élargir le generic constraint de `BaseFacade<T>` de `IAreaModel | IBuildingModel | IDeviceModelAny | IFloorModel` vers simplement `IModel` (qui est le type parent commun). Ainsi `IDeviceModel<T>` est directement accepté.

**Fichier :** `src/facades/base.ts` - ligne 51-52 : changer le generic constraint

```typescript
// Avant
export abstract class BaseFacade<T extends IAreaModel | IBuildingModel | IDeviceModelAny | IFloorModel>

// Après
export abstract class BaseFacade<T extends IModel>
```

### 1.6 Factory : switch au lieu de 3 type guards

**Fichier :** `src/facades/factory.ts`

Remplacer les 3 fonctions `isDeviceModelAta/Atw/Erv` par un `switch (instance.type)`. Le discriminant `type` dans `IDeviceModelAny` (union) permet le narrowing automatique par TypeScript.

```typescript
const createDeviceFacade = (api: IAPI, instance: IDeviceModelAny): IDeviceFacadeAny => {
  switch (instance.type) {
    case DeviceType.Ata:
      return new DeviceAtaFacade(api, instance)
    case DeviceType.Atw:
      return instance.data.HasZone2
        ? new DeviceAtwHasZone2Facade(api, instance)
        : new DeviceAtwFacade(api, instance)
    case DeviceType.Erv:
      return new DeviceErvFacade(api, instance)
  }
}
```

Supprimer le `throw new Error('Device model not supported')` - le switch est exhaustif.
Supprimer le type local `DeviceModelAny` - utiliser `IDeviceModelAny` directement.

### 1.7 Corriger `fromListToSetAta` - assertion inutile

**Fichier :** `src/utils.ts`

Au lieu de construire `fromListToSetAta` par inversion de `fromSetToListAta` avec `Object.fromEntries` (qui perd les types), le définir explicitement :

```typescript
export const fromListToSetAta: Record<keyof SetDeviceDataAtaInList, KeyOfSetDeviceDataAtaNotInList> = {
  FanSpeed: 'SetFanSpeed',
  VaneHorizontalDirection: 'VaneHorizontal',
  VaneVerticalDirection: 'VaneVertical',
}
```

### 1.8 Supprimer les `Promise.resolve()` inutiles

**Fichiers :** `src/facades/base-device.ts:124`, `src/facades/building.ts:42`

Les méthodes `fetch()` retournent `Promise.resolve(this.data)`. Comme elles sont `async`, `return this.data` suffit. Supprimer les 2 `eslint-disable unicorn/no-useless-promise-resolve-reject`.

### 1.9 Ajouter `el: false` dans les abbreviations ESLint

**Fichier :** `eslint.config.js` - `unicorn/prevent-abbreviations.replacements`

Ajouter `el: false` pour supprimer le `eslint-disable` dans `enums.ts` (Language.el). Restera pertinent même après migration vers `as const` puisque `el` sera une clé d'objet.

**Bilan Phase 1 : `eslint-disable` passe de 18 à 2** (uniquement dans `type-helpers.ts`).

---

## Phase 2 : Patterns modernes (non-breaking)

### 2.1 `Symbol.dispose` pour le nettoyage des timers

**Fichier :** `src/services/api.ts`

Créer une classe `DisposableTimeout` implémentant `Disposable` :

```typescript
class DisposableTimeout implements Disposable {
  #timeout: ReturnType<typeof setTimeout> | undefined

  schedule(callback: () => void, ms: number): void {
    this.clear()
    this.#timeout = setTimeout(callback, ms)
  }

  clear(): void {
    if (this.#timeout !== undefined) {
      clearTimeout(this.#timeout)
      this.#timeout = undefined
    }
  }

  [Symbol.dispose](): void {
    this.clear()
  }
}
```

Remplacer `#retryTimeout: NodeJS.Timeout | null` et `#syncTimeout: NodeJS.Timeout | null` par des instances de `DisposableTimeout`. La classe `API` implémente `Disposable` :

```typescript
class API implements IAPI, Disposable {
  [Symbol.dispose](): void {
    this.#syncTimeout[Symbol.dispose]()
    this.#retryTimeout[Symbol.dispose]()
  }
}
```

### 2.2 `satisfies` sur les `flags` des facades

**Fichiers :** `device-ata.ts`, `device-atw.ts`, `device-erv.ts`

Ajouter `satisfies Record<keyof UpdateDeviceData<DeviceType.Xxx>, number>` pour une vérification compile-time sans élargir le type.

### 2.3 Améliorer les décorateurs

**Fichiers :** `src/decorators/sync-devices.ts`, `src/decorators/update-devices.ts`

- Changer `...args: any[]` en `...args: unknown[]` dans les target types
- Extraire des interfaces de contrat explicites (`Syncable`, `Fetchable`) au lieu de `this: IAPI | IFacade`

### 2.4 Supprimer l'index signature du logging

**Fichier :** `src/logging/context.ts`

Remplacer `[key: string]: unknown` par un `JSON.stringify` avec replacer array :

```typescript
public toString(): string {
  return JSON.stringify(
    this,
    ['dataType', 'method', 'url', 'params', 'headers', 'requestData', 'responseData', 'status', 'errorMessage'],
    2,
  )
}
```

Ou utiliser une méthode abstraite `toRecord()` dans chaque sous-classe.

### 2.5 Optimisations mineures

- `DeviceModel.getByType()` : ajouter un type predicate propre sur le `.filter()` pour éviter le cast
- `DeviceAtwFacade.#handleTargetTemperatures` : `Object.fromEntries` -> `typedFromEntries`
- `formatLabels` dans `utils.ts` : remplacer l'objet lookup avec IIFE par un `switch`/`if` plus lisible

---

## Phase 3 : Model Registry (breaking change -> v22.0.0)

### 3.1 Créer `ModelRegistry`

**Nouveau fichier :** `src/models/registry.ts`

```typescript
export class ModelRegistry {
  readonly #buildings = new Map<number, BuildingModel>()
  readonly #floors = new Map<number, FloorModel>()
  readonly #areas = new Map<number, AreaModel>()
  readonly #devices = new Map<number, IDeviceModelAny>()

  // Sync methods
  syncBuildings(data: readonly BuildingData[]): void { ... }
  syncFloors(data: readonly FloorData[]): void { ... }
  syncAreas(data: readonly AreaDataAny[]): void { ... }
  syncDevices(devices: readonly ListDeviceAny[]): void { ... }

  // Query methods
  getAllBuildings(): BuildingModel[] { ... }
  getBuildingById(id: number): BuildingModel | undefined { ... }
  // ... idem pour floors, areas, devices

  // Cross-references
  getDevicesByBuildingId(buildingId: number): IDeviceModelAny[] { ... }
  getAreasByFloorId(floorId: number): AreaModel[] { ... }
  // etc.
}
```

### 3.2 Simplifier les modèles

**Fichiers :** `building.ts`, `floor.ts`, `area.ts`, `device.ts`

Supprimer de chaque modèle :
- Toutes les `static #instances` Maps
- Toutes les `static #xModel` références
- `setModels()`
- `getAll()`, `getById()`, `getByXId()`, `sync()`
- Les getters de cross-référence (`building`, `floor`, `area`, `devices`)

Les modèles deviennent de simples data holders avec les propriétés d'instance.

### 3.3 Mettre à jour `models/index.ts`

Supprimer les appels `setModels()` (side-effects -> cohérent avec `sideEffects: false`). Export pur barrel.

### 3.4 Injecter le registry

- `API` possède et expose le registry
- `FacadeManager` reçoit le registry dans son constructeur
- `BaseFacade` reçoit le registry pour les requêtes cross-référence
- Les facades accèdent aux modèles via `this.registry` au lieu de `DeviceModel.getById()`

### 3.5 `WeakMap` pour le cache de facades

**Fichier :** `src/facades/manager.ts`

Remplacer `Map<string, IFacade>` par `WeakMap<IModel, IFacade>`. Avantage : les facades sont garbage-collected quand le modèle n'est plus référencé (après un sync qui remplace les instances).

---

## Phase 4 : Architecture dual-API (breaking change)

### 4.1 Extraire l'interface API adapter

**Nouveau fichier :** `src/services/adapter.ts`

```typescript
export interface IAPIAdapter {
  readonly onSync?: OnSyncFunction
  authenticate(data?: LoginCredentials): Promise<boolean>
  clearSync(): void
  fetch(): Promise<void>  // normalise et sync le registry
  // Core device operations
  setValues<T extends DeviceType>(params: ...): Promise<SetDeviceData<T>>
  values(params: GetDeviceDataParams): Promise<GetDeviceData<DeviceType>>
  setPower(params: SetPowerPostData): Promise<boolean>
  // Optional capabilities (pas toutes les APIs les supportent)
  energy?(params: ...): Promise<EnergyData<DeviceType>>
  frostProtection?(params: ...): Promise<FrostProtectionData>
  // ... etc.
}
```

### 4.2 Adapter la classe API existante

`API` implémente `IAPIAdapter`. Les facades dépendent de `IAPIAdapter` (pas de `IAPI`).

### 4.3 Préparer la structure pour MELCloud Home

```
src/
├── services/
│   ├── adapter.ts         # IAPIAdapter interface
│   ├── melcloud.ts        # API class actuelle (renommée)
│   ├── melcloud-home.ts   # Stub pour la future API
│   └── interfaces.ts      # Types partagés
```

### 4.4 Consumer migration path

```typescript
// Backward compatible
export { API as MELCloudAPI } from './services/melcloud.ts'
// New way
export { createAPI } from './services/index.ts'
export type { IAPIAdapter } from './services/adapter.ts'
```

---

## Phase 5 : Tests + finitions

### 5.1 Configurer vitest

- Ajouter `vitest` en devDependency
- Créer `vitest.config.ts`
- Ajouter script `npm test` dans `package.json`
- Structure : `src/__tests__/` ou `tests/` à la racine

### 5.2 Tests unitaires prioritaires

1. **`type-helpers.ts`** - `typedFromEntries`, `typedKeys`
2. **`ModelRegistry`** - sync, query, cross-references
3. **`factory.ts`** - `createFacade`, `createDeviceFacade` (switch exhaustiveness)
4. **`utils.ts`** - Fonctions utilitaires, type guards
5. **Device facades** - `handle()` methods (temperature clamping, operation mode logic)
6. **API interceptors** - Auth retry, rate limiting, error handling (avec mocks axios)

### 5.3 Nettoyage ESLint config

- Supprimer les rules liées aux enums (`perfectionist/sort-enums`, `naming-convention.enumMember`)
- Ajouter les rules pour `as const` objects si nécessaire
- Mettre à jour `no-magic-numbers` si des constantes numériques sont exposées

---

## Résumé des eslint-disable

| Phase | Avant | Après | Commentaire |
|-------|-------|-------|-------------|
| Initial | 18 | 18 | État actuel |
| Phase 1 | 18 | 2 | Seulement `typedFromEntries` + `typedKeys` |
| Phase 2-5 | 2 | 2 | Stable - minimum irréductible |

## Fichiers créés

- `src/type-helpers.ts`
- `src/models/registry.ts`
- `src/services/adapter.ts`
- `vitest.config.ts`
- `src/__tests__/*.test.ts`

## Fichiers supprimés

- `src/enums.ts` (contenu fusionné dans `src/constants.ts`)

## Dépendances supprimées

- `core-js`
- `https`
- `source-map-support`

## Dépendances ajoutées (dev)

- `vitest`
