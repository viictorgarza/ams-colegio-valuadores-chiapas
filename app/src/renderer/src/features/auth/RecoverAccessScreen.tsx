import { useEffect, useState } from 'react'
import { faArrowLeft, faKey, faShieldHalved } from '@fortawesome/free-solid-svg-icons'
import { api } from '@renderer/api'
import { Button, Field, Icon, TextInput } from '@renderer/components/ui'

const REASON_TEXT: Record<string, string> = {
  codigo_incorrecto: 'El código de recuperación no es correcto.',
  usuario_no_encontrado: 'No existe ninguna cuenta con ese nombre de usuario.',
  bloqueado: 'Demasiados intentos incorrectos. Espera unos minutos e inténtalo de nuevo.'
}

/** Recuperación local de acceso (redesign/ui-ux-pro-max, 2026-07-13): pantalla
 * previa a sesión, para cuando el único admin olvidó su contraseña. Usa el
 * código único por instalación generado en Configuración → Seguridad — no hay
 * ninguna contraseña maestra fija en el código, cada instalación es distinta. */
export function RecoverAccessScreen(props: {
  onBack: () => void
  onRecovered: (username: string) => void
}): React.JSX.Element {
  const [hasCode, setHasCode] = useState<boolean | null>(null)
  const [code, setCode] = useState('')
  const [username, setUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void api.users.hasRecoveryCode().then(setHasCode)
  }, [])

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (busy) return
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await api.users.recoverWithCode({ code, username, newPassword })
      if (result.ok) {
        props.onRecovered(username)
      } else {
        setError(REASON_TEXT[result.reason] ?? 'No se pudo recuperar el acceso.')
      }
    } catch {
      setError('Ocurrió un problema. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm bg-surface border border-line rounded-2xl shadow-sm p-8 flex flex-col gap-5">
        <div>
          <button
            onClick={props.onBack}
            className="text-[12.5px] text-ink3 hover:text-ink flex items-center gap-1.5 mb-3"
          >
            <Icon icon={faArrowLeft} className="w-3 h-3" />
            Volver a iniciar sesión
          </button>
          <div className="flex items-center gap-2 text-accent">
            <Icon icon={faShieldHalved} className="w-4 h-4" />
            <h1 className="text-[16px] font-semibold">Recuperar acceso</h1>
          </div>
          <p className="text-[13px] text-ink3 mt-1">
            Usa el código de recuperación de esta instalación (Configuración → Seguridad) para definir una
            contraseña nueva.
          </p>
        </div>

        {hasCode === false ? (
          <p className="text-[13px] text-ink2 bg-inset rounded-lg px-3 py-2.5">
            Esta instalación todavía no tiene un código de recuperación configurado. Pide a un administrador que
            inicie sesión y lo genere desde Configuración → Seguridad.
          </p>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3.5">
            <Field label="Código de recuperación" required>
              <TextInput
                value={code}
                onChange={setCode}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                autoFocus
              />
            </Field>
            <Field label="Usuario a restablecer" required>
              <TextInput value={username} onChange={setUsername} placeholder="admin" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contraseña nueva" required>
                <TextInput value={newPassword} onChange={setNewPassword} type="password" />
              </Field>
              <Field label="Confirmar" required>
                <TextInput value={confirmPassword} onChange={setConfirmPassword} type="password" />
              </Field>
            </div>

            {error && (
              <p className="text-[13px] text-bad bg-bad-bg rounded-lg px-3 py-2" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              icon={faKey}
              disabled={busy || !code.trim() || !username.trim() || newPassword.length < 8}
            >
              {busy ? 'Restableciendo…' : 'Restablecer contraseña'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
