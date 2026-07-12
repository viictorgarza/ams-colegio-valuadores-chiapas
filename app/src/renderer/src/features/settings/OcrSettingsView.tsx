import { useEffect, useState } from 'react'
import { faCheckCircle, faKey, faTrashCan } from '@fortawesome/free-solid-svg-icons'
import { api } from '@renderer/api'
import { Button, Field, Icon, TextInput } from '@renderer/components/ui'

/** Configuración → OCR (detección de vigencia por IA, autorizado por Victor
 * 2026-07-12 — el aviso de privacidad del Colegio ya cubre el envío de
 * documentos a terceros para procesamiento). Best-effort: solo funciona con
 * internet, igual que la búsqueda de CP. La API key se guarda local, nunca
 * se vuelve a mostrar una vez guardada. */
export function OcrSettingsView(): React.JSX.Element {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  function reload(): void {
    void api.documents.getOcrStatus().then((s) => setConfigured(s.configured))
  }
  useEffect(reload, [])

  async function save(): Promise<void> {
    await api.documents.setOcrApiKey({ apiKey: apiKey.trim() || null })
    setApiKey('')
    setMessage('Guardado.')
    reload()
  }

  async function clear(): Promise<void> {
    await api.documents.setOcrApiKey({ apiKey: null })
    setMessage('API key eliminada.')
    reload()
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-[13px] text-ink3 mt-0.5">OCR — detección de vigencia por IA</p>
      </div>

      <div className="border border-line rounded-xl bg-surface p-5 flex flex-col gap-4 max-w-xl">
        <div>
          <h2 className="text-[14px] font-semibold">Google Cloud Vision</h2>
          <p className="text-[13px] text-ink3 mt-1">
            Al capturar la vigencia de un documento, el botón "Detectar con IA" lee la fecha de la foto
            automáticamente (solo con internet). Necesitas una API key de Google Cloud Vision.
          </p>
        </div>

        {configured !== null && (
          <p className={`text-[13px] flex items-center gap-1.5 ${configured ? 'text-good' : 'text-ink3'}`}>
            {configured && <Icon icon={faCheckCircle} className="w-3.5 h-3.5" />}
            {configured ? 'API key configurada.' : 'Sin configurar todavía.'}
          </p>
        )}

        <Field label="API key" hint="Se guarda local; no se vuelve a mostrar una vez guardada">
          <TextInput value={apiKey} onChange={setApiKey} placeholder="AIza…" type="password" />
        </Field>
        <div className="flex gap-2">
          <Button variant="primary" icon={faKey} disabled={!apiKey.trim()} onClick={() => void save()}>
            Guardar API key
          </Button>
          {configured && (
            <Button variant="danger" icon={faTrashCan} onClick={() => void clear()}>
              Quitar
            </Button>
          )}
        </div>

        {message && <p className="text-[13px] text-good bg-good-bg rounded-lg px-3 py-2">{message}</p>}
      </div>
    </div>
  )
}
