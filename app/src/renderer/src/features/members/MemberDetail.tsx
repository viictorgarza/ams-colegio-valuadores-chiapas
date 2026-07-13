import { useEffect, useState } from 'react'
import {
  faArrowLeft,
  faCheck,
  faClockRotateLeft,
  faFileLines,
  faFloppyDisk,
  faIdBadge,
  faIdCard,
  faReceipt,
  faTrashCan,
  faUserPen
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { MemberDetail as Detail, UpdateMemberInput } from '@shared/contracts'
import { api } from '@renderer/api'
import { Button, Chip, Field, Icon, Modal, TextInput, statusTone } from '@renderer/components/ui'
import { EmailInput } from '@renderer/components/EmailInput'
import { UniversityInput } from '@renderer/components/UniversityInput'
import { CareerInput } from '@renderer/components/CareerInput'
import { TitleSelect } from '@renderer/components/TitleSelect'
import { useToast } from '@renderer/components/Toast'
import { toTitleCase } from '@renderer/lib/textCase'
import { PaymentsTab } from './PaymentsTab'
import { DocumentsTab } from './DocumentsTab'
import { CredentialViewer } from './CredentialViewer'

type Tab = 'informacion' | 'documentos' | 'pagos' | 'historial'

const TAB_ICON: Record<Tab, IconDefinition> = {
  informacion: faUserPen,
  documentos: faFileLines,
  pagos: faReceipt,
  historial: faClockRotateLeft
}

export function MemberDetailView(props: { id: string; onBack: () => void }): React.JSX.Element {
  const [member, setMember] = useState<Detail | null>(null)
  const [tab, setTab] = useState<Tab>('informacion')
  const [showStatus, setShowStatus] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showCredential, setShowCredential] = useState(false)

  useEffect(() => {
    void api.members.get({ id: props.id }).then(setMember)
  }, [props.id])

  if (!member) return <div className="p-8 text-ink3 text-[13px]">Cargando…</div>

  const initials = member.givenNames.slice(0, 1) + (member.paternalSurname?.slice(0, 1) ?? '')

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <button onClick={props.onBack} className="flex items-center gap-1.5 text-[12.5px] text-ink3 hover:text-ink mb-4">
        <Icon icon={faArrowLeft} className="w-3 h-3" />
        Miembros
      </button>

      <div className="flex items-center gap-4 flex-wrap mb-5">
        <div className="w-14 h-14 rounded-2xl bg-accent-soft text-accent grid place-items-center text-lg font-bold">
          {initials.toUpperCase()}
        </div>
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-semibold tracking-tight">{member.fullName}</h1>
            <Chip>{member.memberNumber}</Chip>
            <Chip tone={statusTone(member.statusCode)} dot>
              {member.statusName}
            </Chip>
            {member.isPerito && (
              <Chip tone="accent" icon={faIdBadge}>
                Perito{member.peritoNumber ? ` · ${member.peritoNumber}` : ''}
              </Chip>
            )}
          </div>
          <p className="text-[12.5px] text-ink3 mt-1">
            {[member.phone, member.email, member.joinedAt && `Ingresó ${member.joinedAt}`]
              .filter(Boolean)
              .join(' · ') || 'Sin datos de contacto todavía'}
          </p>
        </div>
        <Button icon={faIdCard} onClick={() => setShowCredential(true)}>
          Ver credencial
        </Button>
        <Button icon={faUserPen} onClick={() => setShowStatus(true)}>
          Cambiar estado
        </Button>
        <Button variant="danger" icon={faTrashCan} onClick={() => setShowDelete(true)}>
          Enviar a papelera
        </Button>
      </div>

      <div className="flex gap-1 border-b border-line mb-5">
        {(
          [
            ['informacion', 'Información'],
            ['documentos', 'Documentos'],
            ['pagos', 'Pagos'],
            ['historial', 'Historial']
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={
              tab === key
                ? 'flex items-center gap-1.5 px-3.5 py-2 text-[13.5px] text-accent font-semibold border-b-2 border-accent -mb-px'
                : 'flex items-center gap-1.5 px-3.5 py-2 text-[13.5px] text-ink3 hover:text-ink'
            }
          >
            <Icon icon={TAB_ICON[key]} className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'informacion' && <InfoForm member={member} onSaved={setMember} />}
      {tab === 'documentos' && <DocumentsTab member={member} />}
      {tab === 'pagos' && <PaymentsTab member={member} />}
      {tab === 'historial' && <History member={member} />}

      {showCredential && <CredentialViewer member={member} onClose={() => setShowCredential(false)} />}

      {showStatus && (
        <StatusModal
          member={member}
          onClose={() => setShowStatus(false)}
          onChanged={(m) => {
            setMember(m)
            setShowStatus(false)
          }}
        />
      )}
      {showDelete && (
        <Modal
          title="¿Enviar a la papelera?"
          subtitle={`${member.fullName} dejará de aparecer en las listas. Nada se borra definitivamente; se podrá restaurar desde Configuración → Papelera.`}
          onClose={() => setShowDelete(false)}
          footer={
            <>
              <Button onClick={() => setShowDelete(false)}>Cancelar</Button>
              <Button
                variant="danger"
                icon={faTrashCan}
                onClick={() => {
                  void api.members.remove({ id: member.id }).then(props.onBack)
                }}
              >
                Enviar a papelera
              </Button>
            </>
          }
        >
          <span />
        </Modal>
      )}
    </div>
  )
}

// ── Pestaña Información ─────────────────────────────────────────────────────

type Draft = Record<string, string>

/** RFC de persona física: los primeros 10 caracteres son siempre los mismos
 * 10 primeros de la CURP (4 letras + 6 dígitos de fecha). Solo la homoclave
 * (3 caracteres, calculada por el SAT) se captura a mano. */
function rfcPrefixFromCurp(curp: string): string {
  const c = curp.trim().toUpperCase()
  return c.length >= 10 ? c.slice(0, 10) : ''
}

function toDraft(m: Detail): Draft {
  const curp = m.curp ?? ''
  const prefix = rfcPrefixFromCurp(curp)
  const rfc = m.rfc ?? ''
  const homoclave = prefix && rfc.toUpperCase().startsWith(prefix) ? rfc.slice(prefix.length) : rfc.slice(-3)
  return {
    title: m.title ?? '',
    givenNames: m.givenNames,
    paternalSurname: m.paternalSurname ?? '',
    maternalSurname: m.maternalSurname ?? '',
    curp,
    rfcHomoclave: homoclave,
    email: m.email ?? '',
    phone: m.phone ?? '',
    phoneHome: m.phoneHome ?? '',
    street: m.street ?? '',
    city: m.city ?? '',
    state: m.state ?? '',
    zip: m.zip ?? '',
    university: m.university ?? '',
    degree: m.degree ?? '',
    specialty: m.specialty ?? '',
    masters: m.masters ?? '',
    doctorate: m.doctorate ?? '',
    company: m.company ?? '',
    position: m.position ?? '',
    peritoNumber: m.peritoNumber ?? '',
    joinedAt: m.joinedAt ?? '',
    observations: m.observations ?? ''
  }
}

function InfoForm(props: { member: Detail; onSaved: (m: Detail) => void }): React.JSX.Element {
  const [draft, setDraft] = useState<Draft>(() => toDraft(props.member))
  const [isPerito, setIsPerito] = useState(props.member.isPerito)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const notify = useToast()

  const set = (key: string) => (v: string) => {
    setDraft((d) => ({ ...d, [key]: v }))
    setSaved(false)
  }

  const applyTitleCase = (key: string) => () => {
    setDraft((d) => ({ ...d, [key]: toTitleCase(d[key] ?? '') }))
  }

  // Autocompleta ciudad/estado al capturar un CP de 5 dígitos (si hay internet;
  // en la oficina sin conexión simplemente no pasa nada y se captura a mano).
  useEffect(() => {
    const zip = draft['zip'] ?? ''
    if (!/^\d{5}$/.test(zip)) return
    let cancelled = false
    const t = setTimeout(() => {
      void api.catalogs.lookupZip({ zip }).then((r) => {
        if (cancelled || !r) return
        setDraft((d) => ({
          ...d,
          city: r.city ?? d['city'] ?? '',
          state: r.state ?? d['state'] ?? ''
        }))
      })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft['zip']])

  async function save(): Promise<void> {
    setError(null)
    const patch: UpdateMemberInput = {}
    const nullable = (v: string): string | null => (v.trim() === '' ? null : v.trim())
    for (const [key, value] of Object.entries(draft)) {
      if (key === 'rfcHomoclave') continue
      if (key === 'givenNames') patch.givenNames = value.trim()
      else (patch as Record<string, unknown>)[key] = nullable(value)
    }
    const rfcPrefix = rfcPrefixFromCurp(draft['curp'] ?? '')
    const homoclave = (draft['rfcHomoclave'] ?? '').trim().toUpperCase()
    patch.rfc = rfcPrefix ? rfcPrefix + homoclave : nullable(homoclave)
    patch.isPerito = isPerito
    try {
      const updated = await api.members.update({ id: props.member.id, patch })
      props.onSaved(updated)
      setDraft(toDraft(updated))
      setSaved(true)
      notify('Guardado.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('CURP')) setError('La CURP no tiene el formato correcto (18 caracteres).')
      else if (msg.includes('RFC')) setError('El RFC no tiene el formato correcto (12 o 13 caracteres).')
      else if (msg.toLowerCase().includes('correo') || msg.includes('email'))
        setError('El correo no parece válido.')
      else setError('No se pudieron guardar los cambios. Revisa los campos marcados.')
    }
  }

  const section = 'text-[11px] font-semibold uppercase tracking-wide text-ink3 mt-2'
  const grid = 'grid grid-cols-2 lg:grid-cols-3 gap-3'

  return (
    <div className="max-w-4xl flex flex-col gap-3">
      <div className={section}>Identidad</div>
      <div className={grid}>
        <Field label="Título">
          <TitleSelect value={draft['title'] ?? ''} onChange={set('title')} />
        </Field>
        <Field label="Nombre(s)">
          <TextInput
            value={draft['givenNames'] ?? ''}
            onChange={set('givenNames')}
            onBlur={applyTitleCase('givenNames')}
          />
        </Field>
        <Field label="Fecha de ingreso">
          <TextInput type="date" value={draft['joinedAt'] ?? ''} onChange={set('joinedAt')} />
        </Field>
        <Field label="Apellido paterno">
          <TextInput
            value={draft['paternalSurname'] ?? ''}
            onChange={set('paternalSurname')}
            onBlur={applyTitleCase('paternalSurname')}
          />
        </Field>
        <Field label="Apellido materno">
          <TextInput
            value={draft['maternalSurname'] ?? ''}
            onChange={set('maternalSurname')}
            onBlur={applyTitleCase('maternalSurname')}
          />
        </Field>
        <Field label="CURP">
          <TextInput value={draft['curp'] ?? ''} onChange={set('curp')} />
        </Field>
        <Field label="RFC" hint="Los primeros 10 caracteres salen de la CURP">
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-1.5 rounded-lg border border-line bg-inset text-ink3 text-[13px] font-mono tracking-wide">
              {rfcPrefixFromCurp(draft['curp'] ?? '') || '—'}
            </span>
            <TextInput
              value={draft['rfcHomoclave'] ?? ''}
              onChange={(v) => set('rfcHomoclave')(v.slice(0, 3))}
              placeholder="Homoclave"
              className="w-24 font-mono uppercase"
            />
          </div>
        </Field>
      </div>

      <div className={section}>Contacto y domicilio</div>
      <div className={grid}>
        <Field label="Celular">
          <TextInput value={draft['phone'] ?? ''} onChange={set('phone')} />
        </Field>
        <Field label="Teléfono de casa">
          <TextInput value={draft['phoneHome'] ?? ''} onChange={set('phoneHome')} />
        </Field>
        <Field label="Correo">
          <EmailInput value={draft['email'] ?? ''} onChange={set('email')} />
        </Field>
        <Field label="Calle y número">
          <TextInput value={draft['street'] ?? ''} onChange={set('street')} onBlur={applyTitleCase('street')} />
        </Field>
        <Field label="C.P." hint="Autocompleta ciudad y estado si hay internet">
          <TextInput value={draft['zip'] ?? ''} onChange={set('zip')} />
        </Field>
        <Field label="Ciudad">
          <TextInput value={draft['city'] ?? ''} onChange={set('city')} onBlur={applyTitleCase('city')} />
        </Field>
        <Field label="Estado">
          <TextInput value={draft['state'] ?? ''} onChange={set('state')} onBlur={applyTitleCase('state')} />
        </Field>
      </div>

      <div className={section}>Formación y ejercicio profesional</div>
      <div className={grid}>
        <Field label="Universidad">
          <UniversityInput value={draft['university'] ?? ''} onChange={set('university')} />
        </Field>
        <Field label="Carrera">
          <CareerInput value={draft['degree'] ?? ''} onChange={set('degree')} />
        </Field>
        <Field label="Especialidad">
          <TextInput
            value={draft['specialty'] ?? ''}
            onChange={set('specialty')}
            onBlur={applyTitleCase('specialty')}
          />
        </Field>
        <Field label="Maestría">
          <TextInput value={draft['masters'] ?? ''} onChange={set('masters')} onBlur={applyTitleCase('masters')} />
        </Field>
        <Field label="Doctorado">
          <TextInput
            value={draft['doctorate'] ?? ''}
            onChange={set('doctorate')}
            onBlur={applyTitleCase('doctorate')}
          />
        </Field>
        <Field label="Empresa">
          <TextInput value={draft['company'] ?? ''} onChange={set('company')} onBlur={applyTitleCase('company')} />
        </Field>
        <Field label="Cargo">
          <TextInput value={draft['position'] ?? ''} onChange={set('position')} onBlur={applyTitleCase('position')} />
        </Field>
        <Field label="No. de registro como perito">
          <TextInput value={draft['peritoNumber'] ?? ''} onChange={set('peritoNumber')} />
        </Field>
        <label className="flex items-center gap-2 mt-5 text-[13.5px]">
          <input
            type="checkbox"
            checked={isPerito}
            onChange={(e) => {
              setIsPerito(e.target.checked)
              setSaved(false)
            }}
            className="w-4 h-4 accent-[#163eab]"
          />
          Es perito valuador
        </label>
      </div>

      <div className={section}>Observaciones</div>
      <textarea
        value={draft['observations'] ?? ''}
        onChange={(e) => set('observations')(e.target.value)}
        rows={3}
        className="border border-line rounded-lg px-3 py-2 bg-surface text-[13.5px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
      />

      {error && <p className="text-[13px] text-bad bg-bad-bg rounded-lg px-3 py-2">{error}</p>}

      <div className="flex items-center gap-3 mt-2">
        <Button variant="primary" icon={faFloppyDisk} onClick={() => void save()}>
          Guardar cambios
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-[13px] text-good">
            <Icon icon={faCheck} className="w-3.5 h-3.5" />
            Guardado
          </span>
        )}
      </div>
    </div>
  )
}

// ── Pestaña Historial ───────────────────────────────────────────────────────

function History(props: { member: Detail }): React.JSX.Element {
  if (props.member.history.length === 0) {
    return <p className="text-[13px] text-ink3">Sin movimientos de estado todavía.</p>
  }
  return (
    <div className="max-w-2xl border border-line rounded-xl bg-surface divide-y divide-line">
      {props.member.history.map((h, i) => (
        <div key={i} className="px-4 py-3 flex items-center gap-3 text-[13.5px]">
          <Chip tone={statusTone(h.statusCode)} dot>
            {h.statusName}
          </Chip>
          <span className="text-ink2 flex-1">{h.reason ?? '—'}</span>
          <span className="text-ink3 text-xs tabular-nums">
            {h.changedAt.slice(0, 10)}
            {h.changedByName ? ` · ${h.changedByName}` : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Modal de cambio de estado ───────────────────────────────────────────────

function StatusModal(props: {
  member: Detail
  onClose: () => void
  onChanged: (m: Detail) => void
}): React.JSX.Element {
  const [statuses, setStatuses] = useState<Array<{ code: string; name: string }>>([])
  const [code, setCode] = useState(props.member.statusCode)
  const [reason, setReason] = useState('')

  useEffect(() => {
    void api.catalogs.memberStatuses().then(setStatuses)
  }, [])

  async function apply(): Promise<void> {
    const updated = await api.members.changeStatus({
      id: props.member.id,
      statusCode: code,
      reason: reason.trim() || null
    })
    props.onChanged(updated)
  }

  return (
    <Modal
      title="Cambiar estado"
      subtitle={`${props.member.fullName} · actualmente ${props.member.statusName}`}
      onClose={props.onClose}
      footer={
        <>
          <Button onClick={props.onClose}>Cancelar</Button>
          <Button
            variant="primary"
            icon={faCheck}
            onClick={() => void apply()}
            disabled={code === props.member.statusCode}
          >
            Aplicar
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        {statuses.map((st) => (
          <button
            key={st.code}
            onClick={() => setCode(st.code)}
            className={
              st.code === code
                ? 'px-3.5 py-1.5 rounded-lg bg-accent-soft border border-accent text-accent text-[13px] font-semibold'
                : 'px-3.5 py-1.5 rounded-lg border border-line text-ink2 text-[13px] hover:bg-inset'
            }
          >
            {st.name}
          </button>
        ))}
      </div>
      <Field label="Motivo" hint="Queda en el historial y en la auditoría">
        <TextInput value={reason} onChange={setReason} placeholder="Por ejemplo: falta de pago 2025" />
      </Field>
    </Modal>
  )
}
