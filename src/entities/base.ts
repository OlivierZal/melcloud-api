import type { ClassicModelKind } from './classic-types.ts'

/**
 * Abstract base model providing common `id` and `name` properties.
 * @template TId - The branded id domain of the model (area, building,
 * device or floor), carried from the wire value that built it.
 * @internal
 */
export abstract class BaseModel<TId extends number> {
  public abstract readonly modelKind: ClassicModelKind

  public readonly id: TId

  public name: string

  protected constructor({ id, name }: { id: TId; name: string }) {
    this.id = id
    this.name = name
  }
}
