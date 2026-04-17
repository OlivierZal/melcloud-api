import { z } from 'zod'

/*
 * Runtime schemas for API boundaries where silent shape drift would hide
 * behind later undefined-property errors. Scoped to authentication-critical
 * payloads; the bulk of the response surface stays on compile-time types.
 */

/** Classic /Login/ClientLogin3 response. */
export const ClassicLoginDataSchema = z.looseObject({
  LoginData: z
    .looseObject({
      ContextKey: z.string(),
      Expiry: z.string(),
    })
    .nullable(),
})

/** Home OIDC /connect/token response. */
export const HomeTokenResponseSchema = z.looseObject({
  access_token: z.string().min(1),
  expires_in: z.number(),
  id_token: z.string().optional(),
  refresh_token: z.string().optional(),
  scope: z.string(),
  token_type: z.string(),
})

/**
 * Parse `data` against `schema`; throw a descriptive error on mismatch.
 * @param schema - Zod schema to validate against.
 * @param data - Untrusted data from an upstream API response.
 * @param context - Short label surfaced in the thrown error message.
 * @returns The parsed, typed data.
 */
export const parseOrThrow = <T>(
  schema: z.ZodType<T>,
  data: unknown,
  context: string,
): T => {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new Error(
      `Invalid API response shape (${context}): ${result.error.message}`,
    )
  }
  return result.data
}
