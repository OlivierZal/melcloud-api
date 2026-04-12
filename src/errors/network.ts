import { APIError } from './base.ts'

/**
 * A network-level error: the request never received an HTTP response.
 */
export class NetworkError extends APIError {
  public override readonly name = 'NetworkError'
}
