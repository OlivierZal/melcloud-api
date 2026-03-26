import type { ModelKind } from './interfaces.ts'

/** Abstract base model providing common `id` and `name` properties. */
export abstract class BaseModel {
  public readonly id: number

  public abstract readonly modelKind: ModelKind

  public name: string

  protected constructor({ id, name }: { id: number; name: string }) {
    this.id = id
    this.name = name
  }
}
