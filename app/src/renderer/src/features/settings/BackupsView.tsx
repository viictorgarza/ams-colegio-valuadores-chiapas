import { useEffect, useState } from 'react'
import {
  faCheckCircle,
  faCloudArrowUp,
  faFloppyDisk,
  faPlugCircleBolt,
  faRotateLeft,
  faTrashCan,
  faTriangleExclamation
} from '@fortawesome/free-solid-svg-icons'
import type { CloudConfigStatus } from '@shared/contracts'
import { api } from '@renderer/api'
import { Button, Field, Icon, Modal, TextInput } from '@renderer/components/ui'

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

      <div className="mt-6">
        <CloudBackupSection />
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

function formatLastCloud(finishedAt: string | null | undefined): string {
  if (!finishedAt) return 'Sin respaldos en la nube todavía.'
  return `Último respaldo en la nube: ${new Date(finishedAt).toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })}`
}

/** Configuración → Respaldos → sección de nube (Cloudflare R2, S3-compatible).
 * Credenciales guardadas en settings, nunca se vuelven a mostrar una vez
 * guardadas — mismo patrón que la API key de OCR. Además del botón manual,
 * hay un chequeo automático y silencioso al abrir la app (ver backups.service.ts). */
function CloudBackupSection(): React.JSX.Element {
  const [status, setStatus] = useState<CloudConfigStatus | null>(null)
  const [lastCloud, setLastCloud] = useState<string | null>(null)
  const [accountId, setAccountId] = useState('')
  const [accessKeyId, setAccessKeyId] = useState('')
  const [secretAccessKey, setSecretAccessKey] = useState('')
  const [bucket, setBucket] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)

  function reload(): void {
    void api.backups.getCloudConfig().then(setStatus)
    void api.backups.getLastCloudBackup().then((r) => setLastCloud(r?.finishedAt ?? null))
  }
  useEffect(reload, [])

  async function save(): Promise<void> {
    setBusy(true)
    setMessage(null)
    try {
      await api.backups.setCloudConfig({
        accountId: accountId.trim() || null,
        accessKeyId: accessKeyId.trim() || null,
        secretAccessKey: secretAccessKey.trim() || null,
        bucket: bucket.trim() || null
      })
      setAccountId('')
      setAccessKeyId('')
      setSecretAccessKey('')
      setBucket('')
      setMessage({ tone: 'good', text: 'Configuración guardada.' })
      reload()
    } finally {
      setBusy(false)
    }
  }

  async function clear(): Promise<void> {
    setBusy(true)
    setMessage(null)
    try {
      await api.backups.setCloudConfig({ accountId: null, accessKeyId: null, secretAccessKey: null, bucket: null })
      setMessage({ tone: 'good', text: 'Configuración de la nube eliminada.' })
      reload()
    } finally {
      setBusy(false)
    }
  }

  async function testConnection(): Promise<void> {
    setBusy(true)
    setMessage(null)
    try {
      const result = await api.backups.testCloudConnection()
      setMessage({ tone: result.ok ? 'good' : 'bad', text: result.message })
    } finally {
      setBusy(false)
    }
  }

  async function backupNow(): Promise<void> {
    setBusy(true)
    setMessage(null)
    try {
      const result = await api.backups.createCloudBackup()
      setMessage({ tone: result.ok ? 'good' : 'bad', text: result.message })
      reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-line rounded-xl bg-surface p-5 flex flex-col gap-4 max-w-xl">
      <div>
        <h2 className="text-[14px] font-semibold">Respaldo en la nube (Cloudflare R2)</h2>
        <p className="text-[13px] text-ink3 mt-1">
          Sube un paquete completo (base de datos + expedientes + recibos) a tu cuenta de Cloudflare R2. Se intenta
          en silencio cada vez que se abre la app, si ya pasó un día desde el último y hay internet — en la
          oficina, sin conexión, simplemente no pasa nada.
        </p>
      </div>

      {status && (
        <p className={`text-[13px] flex items-center gap-1.5 ${status.configured ? 'text-good' : 'text-ink3'}`}>
          {status.configured && <Icon icon={faCheckCircle} className="w-3.5 h-3.5" />}
          {status.configured ? `Configurado — bucket "${status.bucket}"` : 'Sin configurar todavía.'}
        </p>
      )}
      <p className="text-[13px] text-ink3">{formatLastCloud(lastCloud)}</p>

      {!status?.configured && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Account ID">
            <TextInput value={accountId} onChange={setAccountId} placeholder="0f1e2d…" />
          </Field>
          <Field label="Bucket">
            <TextInput value={bucket} onChange={setBucket} placeholder="ams-respaldos" />
          </Field>
          <Field label="Access Key ID">
            <TextInput value={accessKeyId} onChange={setAccessKeyId} />
          </Field>
          <Field label="Secret Access Key" hint="Se guarda local; no se vuelve a mostrar">
            <TextInput value={secretAccessKey} onChange={setSecretAccessKey} type="password" />
          </Field>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {!status?.configured ? (
          <Button
            variant="primary"
            icon={faFloppyDisk}
            disabled={busy || !accountId.trim() || !accessKeyId.trim() || !secretAccessKey.trim() || !bucket.trim()}
            onClick={() => void save()}
          >
            Guardar configuración
          </Button>
        ) : (
          <>
            <Button variant="primary" icon={faCloudArrowUp} disabled={busy} onClick={() => void backupNow()}>
              Respaldar a la nube ahora
            </Button>
            <Button icon={faPlugCircleBolt} disabled={busy} onClick={() => void testConnection()}>
              Probar conexión
            </Button>
            <Button variant="danger" icon={faTrashCan} disabled={busy} onClick={() => void clear()}>
              Quitar configuración
            </Button>
          </>
        )}
      </div>

      {message && (
        <p className={`text-[13px] rounded-lg px-3 py-2 ${message.tone === 'good' ? 'text-good bg-good-bg' : 'text-bad bg-bad-bg'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
