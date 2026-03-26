export interface MELCloudHomeClaim {
  readonly type: string
  readonly value: string
  readonly valueType: string
}

export interface MELCloudHomeUser {
  readonly email: string
  readonly firstName: string
  readonly lastName: string
  readonly sub: string
}
