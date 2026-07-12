import { useEffect, useState } from 'react'
import { faDownload, faEye, faIdCard, faImage, faUpload, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { DocumentVersion, MemberDetail } from '@shared/contracts'
import { api } from '@renderer/api'
import { Button, Icon } from '@renderer/components/ui'

type Side = { documentTypeId: string; version: DocumentVersion | null }

export function CredentialViewer(props: { member: MemberDetail; onClose: () => void }): React.JSX.Element {
  const [front, setFront] = useState<Side | null>(null)
  const [back, setBack] = useState<Side | null>(null)
  const [busySide, setBusySide] = useState<'front' | 'back' | null>(null)

  function reload(): void {
    void api.documents.getCredential({ memberId: props.member.id }).then((r) => {
      setFront(r.front)
      setBack(r.back)
    })
  }
  useEffect(reload, [props.member.id])

  async function upload(side: 'front' | 'back', documentTypeId: string): Promise<void> {
    setBusySide(side)
    try {
      await api.documents.upload({ memberId: props.member.id, documentTypeId })
      reload()
    } finally {
      setBusySide(null)
    }
  }

  async function uploadFromPath(side: 'front' | 'back', documentTypeId: string, filePath: string): Promise<void> {
    setBusySide(side)
    try {
      await api.documents.uploadFromPath({ memberId: props.member.id, documentTypeId, filePath })
      reload()
    } finally {
      setBusySide(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-6 z-50" onKeyDown={(e) => e.key === 'Escape' && props.onClose()}>
      <div className="w-full max-w-3xl bg-surface border border-line rounded-2xl shadow-xl p-6">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <Icon icon={faIdCard} className="w-4 h-4 text-accent" />
            <div>
              <h2 className="text-base font-semibold">Credencial</h2>
              <p className="text-xs text-ink3 mt-0.5">
                {props.member.fullName} · {props.member.memberNumber}
              </p>
            </div>
          </div>
          <button onClick={props.onClose} className="flex items-center gap-1.5 text-ink3 hover:text-ink text-sm">
            <Icon icon={faXmark} className="w-3.5 h-3.5" />
            Cerrar
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <CredentialSide
            label="Anverso"
            side={front}
            busy={busySide === 'front'}
            onUpload={() => front && void upload('front', front.documentTypeId)}
            onDropFile={(path) => front && void uploadFromPath('front', front.documentTypeId, path)}
          />
          <CredentialSide
            label="Reverso"
            side={back}
            busy={busySide === 'back'}
            onUpload={() => back && void upload('back', back.documentTypeId)}
            onDropFile={(path) => back && void uploadFromPath('back', back.documentTypeId, path)}
          />
        </div>

        <p className="text-xs text-ink3 mt-4">
          El diseño de la credencial lo hace Victor en Illustrator; aquí solo se carga la imagen o PDF final
          de cada lado.
        </p>
      </div>
    </div>
  )
}

function CredentialSide(props: {
  label: string
  side: Side | null
  busy: boolean
  onUpload: () => void
  onDropFile: (filePath: string) => void
}): React.JSX.Element {
  const version = props.side?.version ?? null
  const [preview, setPreview] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    setPreview(null)
    if (!version || !version.mimeType.startsWith('image/')) return
    void api.documents.getVersionData({ versionId: version.id }).then((r) => {
      setPreview(`data:${r.mimeType};base64,${r.dataBase64}`)
    })
  }, [version?.id])

  function onDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    props.onDropFile(window.ams.getPathForFile(file))
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`border rounded-xl overflow-hidden bg-inset flex flex-col transition-colors ${
        dragOver ? 'border-accent outline-dashed outline-2 outline-accent -outline-offset-4' : 'border-line'
      }`}
    >
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink3 border-b border-line bg-surface">
        {props.label}
      </div>
      <div className="flex-1 grid place-items-center min-h-[220px] p-3">
        {!version ? (
          <div className="flex flex-col items-center gap-2 text-ink3">
            <Icon icon={faImage} className="w-7 h-7" />
            <p className="text-[13px] text-center px-4">Aún no se ha cargado</p>
            <p className="text-[11px] text-center px-4">Arrastra el archivo aquí o usa "Cargar"</p>
          </div>
        ) : preview ? (
          <img src={preview} alt={props.label} className="max-h-[260px] max-w-full rounded-lg object-contain" />
        ) : (
          <p className="text-[13px] text-ink3 text-center px-4">{version.originalName}</p>
        )}
      </div>
      <div className="p-3 border-t border-line bg-surface flex items-center gap-2 justify-center flex-wrap">
        {version && (
          <>
            <Button icon={faEye} onClick={() => void api.documents.openVersion({ versionId: version.id })}>
              Ver
            </Button>
            <Button icon={faDownload} onClick={() => void api.documents.downloadVersion({ versionId: version.id })}>
              Descargar
            </Button>
          </>
        )}
        <Button variant="primary" icon={faUpload} disabled={props.busy} onClick={props.onUpload}>
          {version ? 'Reemplazar' : 'Cargar'}
        </Button>
      </div>
    </div>
  )
}
