/*
 * Method decorator that checks session expiry before executing the
 * decorated method. If the session has expired, re-authenticates
 * automatically. Used by Home API methods that require a valid session.
 *
 * Requires `this` to have `expiry` (ISO string) and `authenticate()`.
 */
export const ensureSession = <TResult>(
  target: (...args: any[]) => Promise<TResult>,
  _context: ClassMethodDecoratorContext,
): ((...args: unknown[]) => Promise<TResult>) =>
  async function newTarget(
    this: { expiry: string; authenticate: () => Promise<boolean> },
    ...args: unknown[]
  ): Promise<TResult> {
    if (this.expiry && new Date(this.expiry) < new Date()) {
      await this.authenticate()
    }
    return target.call(this, ...args)
  }
