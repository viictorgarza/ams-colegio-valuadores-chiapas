import { useState } from 'react'
import { faLock, faRightToBracket, faUser } from '@fortawesome/free-solid-svg-icons'
import type { Organization, SessionUser } from '@shared/contracts'
import { api } from '@renderer/api'
import { Icon } from '@renderer/components/ui'
import { OrgLogo } from '@renderer/components/OrgLogo'
import { RecoverAccessScreen } from './RecoverAccessScreen'

const REASON_TEXT: Record<string, string> = {
  credenciales_invalidas: 'El usuario o la contraseña no son correctos.',
  usuario_inactivo: 'Esta cuenta está desactivada. Contacta al administrador.'
}

export function LoginScreen(props: {
  org: Organization | null
  onLogin: (user: SessionUser) => void
  message?: string | null
}): React.JSX.Element {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [recoveredNotice, setRecoveredNotice] = useState<string | null>(null)

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await api.auth.login({ username, password })
      if (result.ok) {
        props.onLogin(result.user)
      } else {
        setError(REASON_TEXT[result.reason] ?? 'No se pudo iniciar sesión.')
      }
    } catch {
      setError('Ocurrió un problema al iniciar sesión. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  if (recovering) {
    return (
      <RecoverAccessScreen
        onBack={() => setRecovering(false)}
        onRecovered={(recoveredUsername) => {
          setRecovering(false)
          setUsername(recoveredUsername)
          setPassword('')
          setRecoveredNotice('Contraseña restablecida. Inicia sesión con tu nueva contraseña.')
        }}
      />
    )
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-sm bg-surface border border-line rounded-2xl shadow-sm p-8 flex flex-col gap-5"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white grid place-items-center p-2.5 shadow-sm">
            <OrgLogo org={props.org} className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold leading-snug text-balance">
              {props.org?.name ?? 'AMS'}
            </h1>
            <p className="text-[13px] text-ink3 mt-1">Inicia sesión para continuar</p>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink2">Usuario</span>
          <div className="relative">
            <Icon icon={faUser} className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink3" />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              className="w-full border border-line rounded-lg pl-9 pr-3 py-2 bg-surface outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink2">Contraseña</span>
          <div className="relative">
            <Icon icon={faLock} className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink3" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full border border-line rounded-lg pl-9 pr-3 py-2 bg-surface outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </div>
        </label>

        <button
          type="button"
          onClick={() => {
            setRecoveredNotice(null)
            setRecovering(true)
          }}
          className="self-end -mt-2.5 text-[12.5px] text-accent font-semibold hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </button>

        {!error && recoveredNotice && (
          <p className="text-[13px] text-good bg-good-bg rounded-lg px-3 py-2">{recoveredNotice}</p>
        )}
        {!error && !recoveredNotice && props.message && (
          <p className="text-[13px] text-ink2 bg-inset rounded-lg px-3 py-2">{props.message}</p>
        )}
        {error && (
          <p className="text-[13px] text-bad bg-bad-bg rounded-lg px-3 py-2" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || username.length === 0 || password.length === 0}
          className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-on-accent font-semibold rounded-lg py-2.5 transition-colors"
        >
          <Icon icon={faRightToBracket} className="w-3.5 h-3.5" />
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
