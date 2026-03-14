import type {
  AxiosError,
  AxiosRequestHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'

import { describe, expect, it } from 'vitest'

import {
  APICallRequestData,
  APICallResponseData,
  createAPICallErrorData,
} from '../../src/logging/index.ts'
import { mock } from '../helpers.ts'

const createConfig = (
  overrides: Partial<InternalAxiosRequestConfig> = {},
): InternalAxiosRequestConfig =>
  mock<InternalAxiosRequestConfig>({
    data: { key: 'value' },
    headers: mock<AxiosRequestHeaders>({
      'Content-Type': 'application/json',
    }),
    method: 'post',
    params: { id: 1 },
    url: '/test/endpoint',
    ...overrides,
  })

const createResponse = (
  overrides: Partial<AxiosResponse> = {},
): AxiosResponse =>
  mock<AxiosResponse>({
    config: createConfig(),
    data: { result: 'ok' },
    headers: { 'x-custom': 'header' },
    status: 200,
    ...overrides,
  })

describe('aPICallRequestData', () => {
  it('extracts request fields from config', () => {
    const data = new APICallRequestData(createConfig())

    expect(data.dataType).toBe('API request')
    expect(data.method).toBe('POST')
    expect(data.url).toBe('/test/endpoint')
    expect(data.params).toStrictEqual({ id: 1 })
    expect(data.requestData).toStrictEqual({ key: 'value' })
    expect(data.headers).toStrictEqual({ 'Content-Type': 'application/json' })
  })

  it('handles undefined config', () => {
    const data = new APICallRequestData()

    expect(data.method).toBeUndefined()
    expect(data.url).toBeUndefined()
    expect(data.params).toBeUndefined()
    expect(data.requestData).toBeUndefined()
    expect(data.headers).toBeUndefined()
  })

  it('serializes to JSON with LOG_KEYS', () => {
    const data = new APICallRequestData(createConfig())
    const parsed = JSON.parse(data.toString())

    expect(parsed.dataType).toBe('API request')
    expect(parsed.method).toBe('POST')
    expect(parsed.url).toBe('/test/endpoint')
    expect(parsed).toHaveProperty('headers')
    expect(parsed).toHaveProperty('params')
    expect(parsed).toHaveProperty('requestData')
  })
})

describe('aPICallResponseData', () => {
  it('extracts response fields', () => {
    const data = new APICallResponseData(createResponse())

    expect(data.dataType).toBe('API response')
    expect(data.method).toBe('POST')
    expect(data.url).toBe('/test/endpoint')
    expect(data.status).toBe(200)
    expect(data.responseData).toStrictEqual({ result: 'ok' })
    expect(data.requestData).toStrictEqual({ key: 'value' })
  })

  it('handles undefined response', () => {
    const data = new APICallResponseData()

    expect(data.method).toBeUndefined()
    expect(data.url).toBeUndefined()
    expect(data.status).toBeUndefined()
    expect(data.responseData).toBeUndefined()
    expect(data.requestData).toBeUndefined()
  })

  it('serializes to JSON with LOG_KEYS', () => {
    const data = new APICallResponseData(createResponse())
    const parsed = JSON.parse(data.toString())

    expect(parsed.dataType).toBe('API response')
    expect(parsed.method).toBe('POST')
    expect(parsed.url).toBe('/test/endpoint')
    expect(parsed.status).toBe(200)
    expect(parsed).toHaveProperty('requestData')
    expect(parsed).toHaveProperty('responseData')
  })
})

describe('createAPICallErrorData', () => {
  it('creates error data from response error', () => {
    const error = mock<AxiosError>({
      config: createConfig(),
      message: 'Request failed',
      response: createResponse({ status: 500 }),
    })
    const data = createAPICallErrorData(error)

    expect(data.errorMessage).toBe('Request failed')
    expect(data.dataType).toBe('API response')
  })

  it('creates error data from request error (no response)', () => {
    const error = mock<AxiosError>({
      config: createConfig(),
      message: 'Network Error',
    })
    const data = createAPICallErrorData(error)

    expect(data.errorMessage).toBe('Network Error')
    expect(data.dataType).toBe('API request')
  })

  it('serializes error data with errorMessage included', () => {
    const error = mock<AxiosError>({
      config: createConfig(),
      message: 'Timeout',
      response: createResponse(),
    })
    const data = createAPICallErrorData(error)
    const parsed = JSON.parse(data.toString())

    expect(parsed.errorMessage).toBe('Timeout')
  })
})
