import { MelCloudError } from './base.ts'

/**
 * A network-level error: the request never received an HTTP response.
 */
export class NetworkError extends MelCloudError {
  public override readonly name = 'NetworkError'
}
