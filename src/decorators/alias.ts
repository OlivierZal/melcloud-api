// @ts-expect-error: most runtimes do not support natively
Symbol.metadata ??= Symbol('Symbol.metadata')
export const valueSymbol = Symbol('value')

export default <
    This extends { canCool: boolean; data: object; hasZone2: boolean },
  >(
    key: string,
  ) =>
  (
    _target: unknown,
    context: ClassAccessorDecoratorContext<This>,
  ): ClassAccessorDecoratorResult<This, unknown> => ({
    get(this: This): unknown {
      const value = String(context.name)
      if (!(key in this.data)) {
        throw new Error(`Cannot get value for ${value}`)
      }
      if (
        (!value.includes('Cool') || this.canCool) &&
        (!value.includes('Zone2') || this.hasZone2)
      ) {
        context.metadata[valueSymbol] ??= []
        const values = context.metadata[valueSymbol] as string[]
        if (!values.includes(value)) {
          values.push(value)
        }
      }
      return this.data[key as keyof typeof this.data]
    },
    set(): void {
      throw new Error(`Cannot set value for ${String(context.name)}`)
    },
  })