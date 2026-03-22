import type { Model, ModelKind } from './interfaces.ts'

/** Abstract base model providing common `id` and `name` properties. */
export abstract class BaseModel implements Model {
  public readonly id: number

  public name: string

  public abstract readonly modelKind: ModelKind

  protected constructor({ id, name }: { id: number; name: string }) {
    this.id = id
    this.name = name
  }
}
