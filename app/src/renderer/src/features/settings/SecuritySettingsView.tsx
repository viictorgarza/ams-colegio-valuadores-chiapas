import { useEffect, useState } from 'react'
import { faLock } from '@fortawesome/free-solid-svg-icons'
import { api } from '@renderer/api'
import { Button, Field, TextInput } from '@renderer/components/ui'
import { useToast } from '@renderer/components/Toast'

/** Configuración → Seguridad (M4/E-08): auto-bloqueo por inactividad —
 * cierra la sesión sola tras N minutos sin actividad (mouse/teclado).
 * 0 = desactivado. El temporizador real vive en App.tsx. */
export function SecuritySettingsView(): React.JSX.Element {
  const [minutes, setMinutes] = useState('')
  const [busy, setBusy] = useState(false)
  const notify = useToast()

  function reload(): void {
    void api.system.getAutoLockMinutes().then((m) => setMinutes(String(m)))
  }
  useEffect(reload, [])

  async function save(): Promise<void> {
    const parsed = parseInt(minutes, 10)
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 240) return
    setBusy(true)
    try {
      await api.system.setAutoLockMinutes({ minutes: parsed })
      notify('Guardado. El cambio aplica de inmediato.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-[13px] text-ink3 mt-0.5">Seguridad</p>
      </div>

      <div className="border border-line rounded-xl bg-surface p-5 flex flex-col gap-4 max-w-md">
        <div>
          <h2 className="text-[14px] font-semibold">Auto-bloqueo por inactividad</h2>
          <p className="text-[13px] text-ink3 mt-1">
            Cierra la sesión sola después de estar inactiva (sin mouse ni teclado) por este tiempo. Útil en una
            laptop compartida. Escribe 0 para desactivarlo.
          </p>
        </div>
        <Field label="Minutos de inactividad">
          <TextInput type="number" value={minutes} onChange={setMinutes} className="max-w-[120px]" />
        </Field>
        <div>
          <Button variant="primary" icon={faLock} disabled={busy} onClick={() => void save()}>
            Guardar
          </Button>
        </div>
      </div>
    </div>
  )
}
