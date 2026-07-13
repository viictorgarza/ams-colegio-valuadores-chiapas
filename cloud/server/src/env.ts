export type Env = {
  DB: D1Database
  ASSETS: Fetcher
}

export type SessionUser = {
  id: string
  fullName: string
  username: string
  role: 'admin' | 'secretary'
  mustChangePassword: boolean
}

export type AppContext = {
  Bindings: Env
  Variables: { user: SessionUser }
}

/** Error de negocio con status HTTP; el handler global lo convierte en JSON. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}
