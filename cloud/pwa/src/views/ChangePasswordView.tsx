import { useState } from 'react'
import { api } from '../api'
import type { SessionUser } from '../types'
import { Button, ErrorBanner, Field, TextInput } from '../ui'

/** Gate de contraseña obligatoria (mismo criterio que el escritorio: el admin
 * inicial trae must_change_password y no puede usar el sistema sin cambiarla). */
export function ChangePasswordView({ user, onDone }: { user: SessionUser; onDone: (u: SessionUser) => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (next !== confirm) {
      setError('La confirmación no coincide con la contraseña nueva')
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.changePassword(current, next)
      onDone({ ...user, mustChangePassword: false })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={(e) => void submit(e)} className="w-full max-w-sm">
        <h1 className="mb-2 text-xl font-semibold">Define tu contraseña</h1>
        <p className="mb-6 text-sm text-ink2">
          Por seguridad, antes de usar el sistema necesitas cambiar la contraseña inicial.
        </p>
        {error && <ErrorBanner message={error} />}
        <div className="space-y-4">
          <Field label="Contraseña actual">
            <TextInput value={current} onChange={setCurrent} type="password" autoFocus />
          </Field>
          <Field label="Contraseña nueva (mínimo 6 caracteres)">
            <TextInput value={next} onChange={setNext} type="password" />
          </Field>
          <Field label="Confirmar contraseña nueva">
            <TextInput value={confirm} onChange={setConfirm} type="password" />
          </Field>
          <Button type="submit" disabled={busy || !current || next.length < 6} full>
            {busy ? 'Guardando…' : 'Guardar y continuar'}
          </Button>
        </div>
      </form>
    </div>
  )
}
