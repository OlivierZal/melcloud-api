import { MelCloudError } from './base.ts'

/**
 * A transient HTTP 5xx error (502 / 503 / 504) the retry budget
 * couldn't recover from.
 */
export class TransientServerError extends MelCloudError {
  public override readonly name = 'TransientServerError'
}
