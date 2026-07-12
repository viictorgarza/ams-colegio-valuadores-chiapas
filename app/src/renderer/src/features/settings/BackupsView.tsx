import { useState } from 'react'
import { faFloppyDisk, faRotateLeft, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { api } from '@renderer/api'
import { Button, Modal } from '@renderer/components/ui'

/** Configuración → Respaldos (M4/E-07, primera rebanada): respaldo y restauración
 * manual a un archivo local. Sin cifrado (decisión de Victor, 2026-07-12).
 * R2/USB/rotación GFS llegan en una siguiente rebanada de M4. */
export function BackupsView(): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [confirmingRestore, setConfirmingRestore] = useState(false)

  async function handleBackup(): Promise<void> {
    setBusy(true)
    setMessage(null)
    try {
      const result = await api.backups.create()
      setMessage(
        result.saved && result.path
          ? { tone: 'good', text: `Respaldo creado en ${result.path}` }
          : { tone: 'bad', text: 'Se canceló la creación del respaldo.' }
      )
    } catch {
      setMessage({ tone: 'bad', text: 'No se pudo crear el respaldo.' })
    } finally {
      setBusy(false)
    }
  }

  async function handleRestore(): Promise<void> {
    setConfirmingRestore(false)
    setBusy(true)
    setMessage(null)
    try {
      const result = await api.backups.restore()
      if (result.status === 'canceled') {
        setMessage({ tone: 'bad', text: 'Se canceló la restauración.' })
      } else if (result.status !== 'restored') {
        setMessage({ tone: 'bad', text: result.message ?? 'No se pudo restaurar el respaldo.' })
      }
      // status 'restored': la app se reinicia sola, no hay nada más que mostrar aquí.
    } catch {
      setMessage({ tone: 'bad', text: 'No se pudo restaurar el respaldo.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-[13px] text-ink3 mt-0.5">Respaldos</p>
      </div>

      <div className="border border-line rounded-xl bg-surface p-5 flex flex-col gap-4 max-w-xl">
        <div>
          <h2 className="text-[14px] font-semibold">Crear respaldo local</h2>
          <p className="text-[13px] text-ink3 mt-1">
            Guarda una copia completa de la base de datos en un archivo que tú eliges (USB, carpeta local, etc.).
          </p>
        </div>
        <Button variant="primary" icon={faFloppyDisk} disabled={busy} onClick={() => void handleBackup()}>
          Respaldar ahora
        </Button>

        <div className="border-t border-line pt-4">
          <h2 className="text-[14px] font-semibold">Restaurar desde respaldo</h2>
          <p className="text-[13px] text-ink3 mt-1">
            Reemplaza todos los datos actuales por los de un archivo de respaldo. La app se reinicia sola al terminar.
          </p>
        </div>
        <Button variant="danger" icon={faRotateLeft} disabled={busy} onClick={() => setConfirmingRestore(true)}>
          Restaurar desde archivo…
        </Button>

        {message && (
          <p className={`text-[13px] rounded-lg px-3 py-2 ${message.tone === 'good' ? 'text-good bg-good-bg' : 'text-bad bg-bad-bg'}`}>
            {message.text}
          </p>
        )}
      </div>

      {confirmingRestore && (
        <Modal
          title="Restaurar desde respaldo"
          subtitle="Esta acción no se puede deshacer."
          onClose={() => setConfirmingRestore(false)}
          footer={
            <>
              <Button onClick={() => setConfirmingRestore(false)}>Cancelar</Button>
              <Button variant="danger" icon={faTriangleExclamation} onClick={() => void handleRestore()}>
                Sí, reemplazar todo
              </Button>
            </>
          }
        >
          <p className="text-[13.5px]">
            Todos los miembros, pagos y expedientes actuales se reemplazarán por los del archivo que elijas a
            continuación. Si no tienes un respaldo reciente de los datos actuales, crea uno primero.
          </p>
        </Modal>
      )}
    </div>
  )
}
