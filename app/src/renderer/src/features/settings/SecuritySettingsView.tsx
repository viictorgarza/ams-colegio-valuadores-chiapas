import { useEffect, useState } from 'react'
import { faCircleCheck, faCopy, faKey, faLock, faShieldHalved, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { api } from '@renderer/api'
import { Button, Field, Icon, TextInput } from '@renderer/components/ui'
import { useToast } from '@renderer/components/Toast'

/** Configuración → Seguridad (M4/E-08): auto-bloqueo por inactividad —
 * cierra la sesión sola tras N minutos sin actividad (mouse/teclado).
 * 0 = desactivado. El temporizador real vive en App.tsx.
 *
 * También el código de recuperación local (redesign/ui-ux-pro-max, 2026-07-13):
 * la salida de emergencia para cuando el único admin olvida su contraseña.
 * Deliberadamente NO es una contraseña maestra fija — se genera aquí, único
 * por instalación, y solo se muestra una vez al crearse. */
export function SecuritySettingsView(): React.JSX.Element {
  const [minutes, setMinutes] = useState('')
  const [busy, setBusy] = useState(false)
  const [hasRecoveryCode, setHasRecoveryCode] = useState<boolean | null>(null)
  const [newCode, setNewCode] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const notify = useToast()

  function reload(): void {
    void api.system.getAutoLockMinutes().then((m) => setMinutes(String(m)))
    void api.users.hasRecoveryCode().then(setHasRecoveryCode)
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

  async function generateRecoveryCode(): Promise<void> {
    setGenerating(true)
    try {
      const result = await api.users.generateRecoveryCode()
      setNewCode(result.code)
      setHasRecoveryCode(true)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-[13px] text-ink3 mt-0.5">Seguridad</p>
      </div>

      <div className="flex flex-col gap-5 max-w-md">
        <div className="border border-line rounded-xl bg-surface p-5 flex flex-col gap-4">
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

        <div className="border border-line rounded-xl bg-surface p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Icon icon={faShieldHalved} className="w-4 h-4 text-accent" />
            <h2 className="text-[14px] font-semibold">Código de recuperación</h2>
          </div>
          <p className="text-[13px] text-ink3">
            Si el único administrador olvida su contraseña, este código (único de esta instalación) permite
            restablecerla desde la pantalla de inicio de sesión, con el enlace "¿Olvidaste tu contraseña?".
            Guárdalo en un lugar seguro, fuera de esta laptop — no se puede volver a mostrar.
          </p>

          {newCode ? (
            <div className="border border-accent/40 bg-accent-soft rounded-lg p-3.5 flex flex-col gap-2.5">
              <p className="text-[12.5px] font-semibold text-accent flex items-center gap-1.5">
                <Icon icon={faTriangleExclamation} className="w-3.5 h-3.5" />
                Cópialo ahora — no volverá a mostrarse
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[15px] font-semibold tracking-wide tabular-nums bg-surface border border-line rounded-lg px-3 py-2 select-all">
                  {newCode}
                </code>
                <Button
                  icon={faCopy}
                  onClick={() => {
                    void navigator.clipboard.writeText(newCode)
                    notify('Código copiado al portapapeles.')
                  }}
                >
                  Copiar
                </Button>
              </div>
              <Button onClick={() => setNewCode(null)}>Ya lo guardé</Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                icon={faKey}
                disabled={generating}
                onClick={() => void generateRecoveryCode()}
              >
                {hasRecoveryCode ? 'Regenerar código' : 'Generar código de recuperación'}
              </Button>
              {hasRecoveryCode === true && (
                <span className="text-[12.5px] text-good flex items-center gap-1.5">
                  <Icon icon={faCircleCheck} className="w-3.5 h-3.5" />
                  Configurado
                </span>
              )}
            </div>
          )}
          {hasRecoveryCode && !newCode && (
            <p className="text-[12px] text-ink3">
              Regenerarlo invalida el código anterior de inmediato.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
