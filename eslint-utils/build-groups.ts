const cartesianProduct = (arrays: string[][]): string[][] => {
  let result: string[][] = [[]]
  for (const array of arrays) {
    result = result.flatMap((partial) =>
      array.map((item) => [...partial, item]),
    )
  }
  return result
}

const modifierCombos = ({ modifiers }: { modifiers: string[][] }): string[][] =>
  cartesianProduct(modifiers).map((combo) => combo.filter(Boolean))

const compatibleModifierCombos = ({
  modifierIncompatibilities,
  modifiers,
}: {
  modifierIncompatibilities: Record<string, string[]>
  modifiers: string[][]
}): string[][] =>
  modifierCombos({ modifiers }).filter((combo) =>
    combo.every((modifier) =>
      (modifierIncompatibilities[modifier] ?? []).every(
        (incompatibleModifier) => !combo.includes(incompatibleModifier),
      ),
    ),
  )

const buildGroupsForSelector = ({
  modifierIncompatibilities,
  modifiers,
  selector,
  selectorIncompatibilities,
}: {
  modifierIncompatibilities: Record<string, string[]>
  modifiers: string[][]
  selector: string
  selectorIncompatibilities: Record<string, string[]>
}): string[] => {
  const incompatibilities = new Set(selectorIncompatibilities[selector])
  return compatibleModifierCombos({ modifierIncompatibilities, modifiers })
    .filter((combo) =>
      combo.every((modifier) => !incompatibilities.has(modifier)),
    )
    .map((combo) => [...combo, selector].join('-'))
}

export const buildGroups = ({
  modifierIncompatibilities,
  modifiers,
  selectorIncompatibilities,
  selectors,
}: {
  modifierIncompatibilities: Record<string, string[]>
  modifiers: string[][]
  selectorIncompatibilities: Record<string, string[]>
  selectors: (string | string[])[]
}): (string | string[])[] =>
  selectors.flatMap((selector) => {
    if (Array.isArray(selector)) {
      const groupPairs = selector.map((pairedSelector) =>
        buildGroupsForSelector({
          modifierIncompatibilities,
          modifiers,
          selector: pairedSelector,
          selectorIncompatibilities,
        }),
      )
      const [first] = groupPairs
      const { length } = first!
      return [...Array.from({ length }).keys()].map((index) =>
        groupPairs.map((groupPair) => groupPair[index]!),
      )
    }
    return buildGroupsForSelector({
      modifierIncompatibilities,
      modifiers,
      selector,
      selectorIncompatibilities,
    })
  })
