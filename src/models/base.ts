import type { IBaseModel } from './interfaces'

export default abstract class implements IBaseModel {
  public readonly id: number

  public readonly name: string

  protected constructor({ id, name }: { id: number; name: string }) {
    this.id = id
    this.name = name
  }
}
