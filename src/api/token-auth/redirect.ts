import type { CookieJar } from 'tough-cookie'

import {
  MAX_REDIRECTS,
  REDIRECT_STATUS_MAX,
  REDIRECT_STATUS_MIN,
  REDIRECT_URI,
} from './constants.ts'
import { extractPageRedirect } from './html-parsing.ts'
import { type OidcResponse, authRequest } from './transport.ts'

/** Options for {@link authFollowRedirects}. */
export interface FollowRedirectsOptions {
  jar: CookieJar
  url: string
  abortSignal?: AbortSignal
  remaining?: number
}

/**
 * Resolve a potentially relative URL against a base URL.
 * @param options - The resolution options.
 * @param options.base - The base URL for resolution.
 * @param options.location - The URL or relative path to resolve.
 * @returns The fully qualified URL.
 */
export const resolveUrl = ({
  base,
  location,
}: {
  base: string
  location: string
}): string =>
  location.startsWith('http') ? location : new URL(location, base).href

/**
 * Extract the redirect target from an HTTP or JS redirect response.
 * @param response - The raw HTTP response.
 * @param currentUrl - The URL that produced this response.
 * @returns The resolved redirect URL, or `null` if no redirect was detected.
 */
const extractRedirectTarget = (
  response: OidcResponse<string>,
  currentUrl: string,
): string | null => {
  if (
    response.status >= REDIRECT_STATUS_MIN &&
    response.status < REDIRECT_STATUS_MAX
  ) {
    const location = String(response.headers['location'] ?? '')
    return resolveUrl({ base: currentUrl, location })
  }
  const jsRedirect = extractPageRedirect(response.data)
  return jsRedirect === null ? null : (
      resolveUrl({ base: currentUrl, location: jsRedirect })
    )
}

/**
 * Follow HTTP 302 redirects and IS JavaScript redirects until a
 * non-redirect page is reached or the URL matches the app's custom
 * scheme (`melcloudhome://`).
 * @param options - The redirect-following options.
 * @param options.abortSignal - Optional abort signal.
 * @param options.jar - CookieJar for cross-domain cookie management.
 * @param options.remaining - Number of remaining redirects allowed.
 * @param options.url - Current URL to follow.
 * @returns The final response data and URL.
 */
export const authFollowRedirects = async ({
  abortSignal,
  jar,
  remaining = MAX_REDIRECTS,
  url,
}: FollowRedirectsOptions): Promise<{ data: string; url: string }> => {
  if (remaining <= 0) {
    throw new Error(`Too many redirects (max ${String(MAX_REDIRECTS)})`)
  }
  if (url.startsWith(REDIRECT_URI)) {
    return { data: '', url }
  }
  const response = await authRequest({
    config: { headers: {} },
    jar,
    method: 'get',
    url,
    ...(abortSignal === undefined ? {} : { abortSignal }),
  })
  const redirectTarget = extractRedirectTarget(response, url)
  if (redirectTarget !== null) {
    return authFollowRedirects({
      jar,
      remaining: remaining - 1,
      url: redirectTarget,
      ...(abortSignal === undefined ? {} : { abortSignal }),
    })
  }
  return { data: response.data, url }
}
