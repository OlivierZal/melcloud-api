import type { IModel } from './interfaces.ts'

/** Abstract base model providing common `id` and `name` properties. */
export abstract class BaseModel implements IModel {
  public readonly id: number

  public readonly name: string

  protected constructor({ id, name }: { id: number; name: string }) {
    this.id = id
    this.name = name
  }
}
