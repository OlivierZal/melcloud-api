import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Logger, MELCloudHomeConfig } from '../../src/services/index.ts'
import type { MELCloudHomeAPI } from '../../src/services/melcloud-home.ts'
import type { MELCloudHomeClaim } from '../../src/types/index.ts'
import { cast } from '../helpers.ts'

const BASE_URL = 'https://melcloudhome.com'
const COGNITO = 'https://live-melcloudhome.auth.eu-west-1.amazoncognito.com'

const cognitoLoginPage = (
  action = '/login?client_id=test&amp;state=abc',
  csrf = 'csrf-token',
): string =>
  `<form action="${action}" method="POST">` +
  `<input type="hidden" name="_csrf" value="${csrf}"/>` +
  '<input type="hidden" name="cognitoAsfData" value=""/>' +
  '</form>'

const userClaims: MELCloudHomeClaim[] = [
  { type: 'sub', value: 'user-123', valueType: 'null' },
  { type: 'given_name', value: 'John', valueType: 'null' },
  { type: 'family_name', value: 'Doe', valueType: 'null' },
  { type: 'email', value: 'john@example.com', valueType: 'null' },
]

const mockRequest = vi.fn()
const mockAxiosInstance = {
  defaults: { baseURL: undefined as string | undefined },
  request: mockRequest,
}

vi.mock(import('axios'), async (importOriginal) => ({
  ...(await importOriginal()),
  default: cast({
    create: vi.fn().mockReturnValue(mockAxiosInstance),
  }),
}))

const createLogger = (): Logger => ({
  error: vi.fn<(...data: unknown[]) => void>(),
  log: vi.fn<(...data: unknown[]) => void>(),
})

/*
 * Simulate the OIDC redirect chain:
 *   1. GET /bff/login → 302 → Cognito authorize → 302 → Cognito login page (200)
 *   2. POST credentials → 302 → callback URL
 *   3. GET callback → 302 chain → final 200
 *   4. GET /bff/user → 200 with claims
 */
const setupSuccessfulLogin = (): void => {
  const callbackUrl =
    'https://auth.melcloudhome.com/signin-oidc-meu?code=abc&state=xyz'
  mockRequest
    .mockResolvedValueOnce({
      data: '',
      headers: { location: `${BASE_URL}/auth-redirect` },
      status: 302,
    })
    .mockResolvedValueOnce({
      data: '',
      headers: { location: `${COGNITO}/oauth2/authorize?client_id=test` },
      status: 302,
    })
    .mockResolvedValueOnce({
      data: '',
      headers: { location: `${COGNITO}/login?client_id=test` },
      status: 302,
    })
    .mockResolvedValueOnce({
      data: cognitoLoginPage(),
      headers: {},
      status: 200,
    })
    .mockResolvedValueOnce({
      data: '',
      headers: { location: callbackUrl },
      status: 302,
    })
    .mockResolvedValueOnce({
      data: '',
      headers: {
        location: 'https://auth.melcloudhome.com/ExternalLogin/Callback',
      },
      status: 302,
    })
    .mockResolvedValueOnce({
      data: '',
      headers: { location: `${BASE_URL}/signin-oidc?code=final` },
      status: 302,
    })
    .mockResolvedValueOnce({ data: '', headers: {}, status: 200 })
    .mockResolvedValueOnce({
      data: userClaims,
      headers: {},
      status: 200,
    })
}

describe('mELCloudHomeAPI', () => {
  let melCloudHomeApi: { create: typeof MELCloudHomeAPI.create } = cast(null)

  beforeEach(async () => {
    mockRequest.mockReset()
    vi.clearAllMocks()
    mockAxiosInstance.defaults.baseURL = BASE_URL
    ;({ MELCloudHomeAPI: melCloudHomeApi } =
      await import('../../src/services/melcloud-home.ts'))
  })

  const createApi = async (
    config: MELCloudHomeConfig = {},
  ): ReturnType<typeof melCloudHomeApi.create> =>
    melCloudHomeApi.create({
      baseURL: BASE_URL,
      password: 'pass',
      username: 'user@test.com',
      ...config,
    })

  describe('create', () => {
    it('should authenticate and return user on success', async () => {
      setupSuccessfulLogin()
      const api = await createApi()

      expect(api.isAuthenticated()).toBe(true)
      expect(api.user).toStrictEqual({
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        sub: 'user-123',
      })
    })

    it('should return unauthenticated when no credentials', async () => {
      const api = await melCloudHomeApi.create({ baseURL: BASE_URL })

      expect(api.isAuthenticated()).toBe(false)
      expect(api.user).toBeNull()
    })
  })

  describe('authenticate', () => {
    it('should return false without credentials', async () => {
      const api = await melCloudHomeApi.create({ baseURL: BASE_URL })
      const isAuthenticated = await api.authenticate()

      expect(isAuthenticated).toBe(false)
    })

    it('should clear user state on re-authentication', async () => {
      setupSuccessfulLogin()
      const api = await createApi()

      expect(api.isAuthenticated()).toBe(true)

      mockRequest.mockRejectedValueOnce(new Error('network'))

      await expect(
        api.authenticate({ password: 'wrong', username: 'u@t.com' }),
      ).rejects.toThrow('network')

      expect(api.user).toBeNull()
    })

    it('should log and return false on stored credential failure', async () => {
      const logger = createLogger()
      mockRequest.mockRejectedValueOnce(new Error('network'))
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        logger,
        password: 'pass',
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Authentication failed:',
        expect.any(Error),
      )
    })

    it('should throw on explicit credential failure', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockRejectedValueOnce(new Error('bad credentials'))

      await expect(
        api.authenticate({ password: 'wrong', username: 'user@test.com' }),
      ).rejects.toThrow('bad credentials')
    })

    it('should re-authenticate with new credentials', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      setupSuccessfulLogin()
      const isAuthenticated = await api.authenticate({
        password: 'new-pass',
        username: 'new@test.com',
      })

      expect(isAuthenticated).toBe(true)
    })
  })

  describe('getUser', () => {
    it('should return null on failure', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockRejectedValueOnce(new Error('unauthorized'))
      const user = await api.getUser()

      expect(user).toBeNull()
      expect(api.isAuthenticated()).toBe(false)
    })
  })

  describe('redirect handling', () => {
    it('should stop on empty location header', async () => {
      mockRequest
        .mockResolvedValueOnce({
          data: '',
          headers: { location: '' },
          status: 302,
        })
        .mockResolvedValueOnce({
          data: userClaims,
          headers: {},
          status: 200,
        })
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        password: 'pass',
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
    })

    it('should stop on missing location header in redirect chain', async () => {
      mockRequest
        .mockResolvedValueOnce({
          data: '',
          headers: { location: `${BASE_URL}/step1` },
          status: 302,
        })
        .mockResolvedValueOnce({
          data: '',
          headers: {},
          status: 302,
        })
      const logger = createLogger()
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        logger,
        password: 'pass',
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Authentication failed:',
        expect.any(Error),
      )
    })

    it('should throw on too many redirects', async () => {
      Array.from({ length: 21 }, (_unused, index) =>
        mockRequest.mockResolvedValueOnce({
          data: '',
          headers: { location: `${BASE_URL}/redirect-${String(index)}` },
          status: 302,
        }),
      )
      const logger = createLogger()
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        logger,
        password: 'pass',
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Authentication failed:',
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest matcher returns `any`
          message: expect.stringContaining('Too many redirects'),
        }),
      )
    })

    it('should resolve relative redirect URLs', async () => {
      mockRequest
        .mockResolvedValueOnce({
          data: '',
          headers: { location: `${BASE_URL}/auth-redirect` },
          status: 302,
        })
        .mockResolvedValueOnce({
          data: '',
          headers: { location: '/relative-path' },
          status: 302,
        })
        .mockResolvedValueOnce({
          data: cognitoLoginPage(`${COGNITO}/login?client_id=test`),
          headers: {},
          status: 200,
        })
        .mockResolvedValueOnce({
          data: '',
          headers: {
            location:
              'https://auth.melcloudhome.com/signin-oidc-meu?code=x&state=y',
          },
          status: 302,
        })
        .mockResolvedValueOnce({ data: '', headers: {}, status: 200 })
        .mockResolvedValueOnce({ data: userClaims, headers: {}, status: 200 })
      const api = await createApi()

      expect(api.isAuthenticated()).toBe(true)
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${BASE_URL}/relative-path`,
        }),
      )
    })
  })

  describe('form parsing', () => {
    it('should throw when form action is missing', async () => {
      mockRequest.mockResolvedValueOnce({
        data: '<html>no form here</html>',
        headers: {},
        status: 200,
      })
      const logger = createLogger()
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        logger,
        password: 'pass',
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Authentication failed:',
        expect.any(Error),
      )
    })

    it('should prefix relative form action with Cognito authority', async () => {
      mockRequest
        .mockResolvedValueOnce({
          data: cognitoLoginPage('/login?client_id=test&amp;state=abc'),
          headers: {},
          status: 200,
        })
        .mockResolvedValueOnce({
          data: '',
          headers: {
            location:
              'https://auth.melcloudhome.com/signin-oidc-meu?code=x&state=y',
          },
          status: 302,
        })
        .mockResolvedValueOnce({ data: '', headers: {}, status: 200 })
        .mockResolvedValueOnce({ data: userClaims, headers: {}, status: 200 })
      await createApi()

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${COGNITO}/login?client_id=test&state=abc`,
        }),
      )
    })

    it('should handle hidden fields without name or value attributes', async () => {
      const htmlWithEdgeCases =
        '<form action="/login?id=test" method="POST">' +
        '<input type="hidden" name="_csrf" value="tok"/>' +
        '<input type="hidden" value="orphan"/>' +
        '<input type="hidden" name="noValue"/>' +
        '</form>'
      mockRequest
        .mockResolvedValueOnce({
          data: htmlWithEdgeCases,
          headers: {},
          status: 200,
        })
        .mockResolvedValueOnce({
          data: '',
          headers: {
            location:
              'https://auth.melcloudhome.com/signin-oidc-meu?code=x&state=y',
          },
          status: 302,
        })
        .mockResolvedValueOnce({ data: '', headers: {}, status: 200 })
        .mockResolvedValueOnce({ data: userClaims, headers: {}, status: 200 })
      const api = await createApi()

      expect(api.isAuthenticated()).toBe(true)
    })

    it('should handle missing claim types with empty string fallback', async () => {
      const partialClaims: MELCloudHomeClaim[] = [
        { type: 'sub', value: 'user-456', valueType: 'null' },
      ]
      mockRequest
        .mockResolvedValueOnce({
          data: cognitoLoginPage(),
          headers: {},
          status: 200,
        })
        .mockResolvedValueOnce({
          data: '',
          headers: {
            location:
              'https://auth.melcloudhome.com/signin-oidc-meu?code=x&state=y',
          },
          status: 302,
        })
        .mockResolvedValueOnce({ data: '', headers: {}, status: 200 })
        .mockResolvedValueOnce({
          data: partialClaims,
          headers: {},
          status: 200,
        })
      const api = await createApi()

      expect(api.user).toStrictEqual({
        email: '',
        firstName: '',
        lastName: '',
        sub: 'user-456',
      })
    })

    it('should use absolute form action as-is', async () => {
      const absoluteAction = `${COGNITO}/login?client_id=test`
      mockRequest
        .mockResolvedValueOnce({
          data: cognitoLoginPage(absoluteAction),
          headers: {},
          status: 200,
        })
        .mockResolvedValueOnce({
          data: '',
          headers: {
            location:
              'https://auth.melcloudhome.com/signin-oidc-meu?code=x&state=y',
          },
          status: 302,
        })
        .mockResolvedValueOnce({ data: '', headers: {}, status: 200 })
        .mockResolvedValueOnce({ data: userClaims, headers: {}, status: 200 })
      await createApi()

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: absoluteAction }),
      )
    })

    it('should handle missing location header from credential submission', async () => {
      mockRequest
        .mockResolvedValueOnce({
          data: cognitoLoginPage(),
          headers: {},
          status: 200,
        })
        .mockResolvedValueOnce({
          data: '',
          headers: {},
          status: 302,
        })
        .mockResolvedValueOnce({ data: '', headers: {}, status: 200 })
        .mockResolvedValueOnce({ data: userClaims, headers: {}, status: 200 })
      const api = await createApi()

      expect(api.isAuthenticated()).toBe(true)
    })
  })

  describe('cookie handling', () => {
    it('should store and send Set-Cookie headers across requests', async () => {
      mockRequest
        .mockResolvedValueOnce({
          data: '',
          headers: {
            location: `${COGNITO}/login`,
            'set-cookie': ['session=abc; Path=/; Secure'],
          },
          status: 302,
        })
        .mockResolvedValueOnce({
          data: cognitoLoginPage(`${COGNITO}/login?id=test`),
          headers: {},
          status: 200,
        })
        .mockResolvedValueOnce({
          data: '',
          headers: {
            location:
              'https://auth.melcloudhome.com/signin-oidc-meu?code=x&state=y',
          },
          status: 302,
        })
        .mockResolvedValueOnce({ data: '', headers: {}, status: 200 })
        .mockResolvedValueOnce({ data: userClaims, headers: {}, status: 200 })
      const api = await createApi()

      expect(api.isAuthenticated()).toBe(true)
    })

    it('should ignore invalid Set-Cookie values', async () => {
      mockRequest
        .mockResolvedValueOnce({
          data: cognitoLoginPage(`${COGNITO}/login?id=test`),
          headers: { 'set-cookie': [''] },
          status: 200,
        })
        .mockResolvedValueOnce({
          data: '',
          headers: {
            location:
              'https://auth.melcloudhome.com/signin-oidc-meu?code=x&state=y',
          },
          status: 302,
        })
        .mockResolvedValueOnce({ data: '', headers: {}, status: 200 })
        .mockResolvedValueOnce({ data: userClaims, headers: {}, status: 200 })

      await expect(createApi()).resolves.toBeDefined()
    })
  })

  describe('logging', () => {
    it('should not log sensitive query parameters', async () => {
      setupSuccessfulLogin()
      const logger = createLogger()
      await createApi({ logger })

      const {
        mock: { calls },
      } = vi.mocked(logger.log)
      for (const [message] of calls) {
        expect(String(message)).not.toContain('code=')
        expect(String(message)).not.toContain('state=')
      }
    })
  })
})
