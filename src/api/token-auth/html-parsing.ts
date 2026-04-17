import { COGNITO_AUTHORITY } from './constants.ts'

/**
 * Extract the `action` attribute from the first `<form>` element in an HTML string.
 * @param html - Raw HTML string from the login page.
 * @returns The resolved form action URL, or `null` if not found.
 */
export const extractFormAction = (html: string): string | null => {
  const match = /<form[^>]+action="(?<action>[^"]+)"/iu.exec(html)
  const encoded = match?.groups?.['action']
  if (encoded === undefined) {
    return null
  }
  const action = encoded.split('&amp;').join('&')
  return action.startsWith('/') ? `${COGNITO_AUTHORITY}${action}` : action
}

/**
 * Extract all hidden form fields from an HTML string.
 * @param html - Raw HTML string containing hidden `<input>` fields.
 * @returns A record of name-value pairs for each hidden field.
 */
export const extractHiddenFields = (html: string): Record<string, string> =>
  Object.fromEntries(
    [...html.matchAll(/<input[^>]+type="hidden"[^>]*>/giu)].flatMap(([tag]) => {
      const name = /name="(?<name>[^"]+)"/u.exec(tag)?.groups?.['name']
      const value =
        /value="(?<value>[^"]*)"/u.exec(tag)?.groups?.['value'] ?? ''
      return name === undefined ? [] : [[name, value] as const]
    }),
  )

/**
 * Extract a JavaScript-based redirect URL from an HTML response body.
 * @param html - The HTML string to search for a JS redirect.
 * @returns The redirect URL if found, or `null`.
 */
export const extractPageRedirect = (html: string): string | null => {
  const jsMatch = /window\.location\s*=\s*['"](?<url>[^'"]+)/u.exec(html)
  if (jsMatch?.groups?.['url'] !== undefined) {
    return jsMatch.groups['url'].split('&amp;').join('&')
  }
  const metaMatch =
    /<meta[^>]+http-equiv="refresh"[^>]+content="[^"]*url=(?<url>[^"]+)/iu.exec(
      html,
    )
  if (metaMatch?.groups?.['url'] !== undefined) {
    return metaMatch.groups['url'].split('&amp;').join('&')
  }
  return null
}
