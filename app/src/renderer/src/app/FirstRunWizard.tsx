import { useEffect, useState } from 'react'
import {
  faArrowRight,
  faBuilding,
  faCheckCircle,
  faKey,
  faPrint,
  faShieldHalved,
  faUserPlus,
  faUsers
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { CloudConfigStatus, Organization, SessionUser, User } from '@shared/contracts'
import { api } from '@renderer/api'
import { Button, Field, Icon, TextInput } from '@renderer/components/ui'

type StepKey = 'organizacion' | 'usuarios' | 'kit' | 'miembros'
const STEPS: Array<{ key: StepKey; label: string }> = [
  { key: 'organizacion', label: 'Organización' },
  { key: 'usuarios', label: 'Usuarios' },
  { key: 'kit', label: 'Respaldo' },
  { key: 'miembros', label: 'Miembros' }
]

/**
 * Asistente de primera ejecución (M5/E-10): se muestra una sola vez, gateado
 * en App.tsx por system:first-run-pending (ver docs/05). Reemplaza el paso de
 * "importar" del roadmap original (E-03 se canceló a favor de alta manual,
 * 2026-07-11) por una bienvenida al alta de miembros.
 */
export function FirstRunWizard(props: {
  user: SessionUser
  org: Organization | null
  onFinish: (user: SessionUser) => void
}): React.JSX.Element {
  const [stepIndex, setStepIndex] = useState(0)
  const [user, setUser] = useState(props.user)
  const step = STEPS[stepIndex]!

  function next(): void {
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1)
  }
  function back(): void {
    if (stepIndex > 0) setStepIndex(stepIndex - 1)
  }
  async function finish(): Promise<void> {
    await api.system.completeFirstRun()
    props.onFinish(user)
  }

  return (
    <div className="h-screen overflow-y-auto bg-app flex flex-col items-center py-10 px-6">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2 flex-1">
              <div
                className={
                  i <= stepIndex
                    ? 'w-6 h-6 rounded-full bg-accent text-on-accent grid place-items-center text-[11px] font-semibold shrink-0'
                    : 'w-6 h-6 rounded-full bg-inset text-ink3 grid place-items-center text-[11px] font-semibold shrink-0'
                }
              >
                {i + 1}
              </div>
              <span className={`text-[12px] ${i === stepIndex ? 'text-ink font-semibold' : 'text-ink3'}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-line" />}
            </div>
          ))}
        </div>

        <div className="border border-line rounded-2xl bg-surface p-7">
          {step.key === 'organizacion' && <OrganizationStep org={props.org} onNext={next} />}
          {step.key === 'usuarios' && (
            <UsersStep user={user} onUserChanged={setUser} onNext={next} onBack={back} />
          )}
          {step.key === 'kit' && <RecoveryKitStep onNext={next} onBack={back} />}
          {step.key === 'miembros' && <WelcomeMembersStep onFinish={() => void finish()} onBack={back} />}
        </div>
      </div>
    </div>
  )
}

function StepHeader(props: { icon: IconDefinition; title: string; subtitle: string }): React.JSX.Element {
  return (
    <div className="mb-5">
      <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent grid place-items-center mb-3">
        <Icon icon={props.icon} className="w-4 h-4" />
      </div>
      <h1 className="text-lg font-semibold tracking-tight">{props.title}</h1>
      <p className="text-[13px] text-ink3 mt-0.5">{props.subtitle}</p>
    </div>
  )
}

function OrganizationStep(props: { org: Organization | null; onNext: () => void }): React.JSX.Element {
  const [name, setName] = useState(props.org?.name ?? '')
  const [shortName, setShortName] = useState(props.org?.shortName ?? '')
  const [rfc, setRfc] = useState(props.org?.rfc ?? '')
  const [street, setStreet] = useState(props.org?.street ?? '')
  const [city, setCity] = useState(props.org?.city ?? '')
  const [state, setState] = useState(props.org?.state ?? '')
  const [zip, setZip] = useState(props.org?.zip ?? '')
  const [phone, setPhone] = useState(props.org?.phone ?? '')
  const [email, setEmail] = useState(props.org?.email ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(): Promise<void> {
    if (!name.trim()) {
      setError('El nombre de la organización es obligatorio.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.organization.update({
        name: name.trim(),
        shortName: shortName.trim() || null,
        rfc: rfc.trim() || null,
        street: street.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        zip: zip.trim() || null,
        country: props.org?.country ?? null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        website: props.org?.website ?? null
      })
      props.onNext()
    } catch {
      setError('No se pudo guardar. Verifica el correo electrónico.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <StepHeader
        icon={faBuilding}
        title="Datos de la organización"
        subtitle="Aparecen en recibos, listas de asistencia y en la barra lateral."
      />
      <div className="flex flex-col gap-3">
        <Field label="Nombre completo">
          <TextInput value={name} onChange={setName} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre corto">
            <TextInput value={shortName} onChange={setShortName} />
          </Field>
          <Field label="RFC">
            <TextInput value={rfc} onChange={setRfc} />
          </Field>
        </div>
        <Field label="Domicilio">
          <TextInput value={street} onChange={setStreet} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Ciudad">
            <TextInput value={city} onChange={setCity} />
          </Field>
          <Field label="Estado">
            <TextInput value={state} onChange={setState} />
          </Field>
          <Field label="C.P.">
            <TextInput value={zip} onChange={setZip} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Teléfono">
            <TextInput value={phone} onChange={setPhone} />
          </Field>
          <Field label="Correo">
            <TextInput value={email} onChange={setEmail} type="email" />
          </Field>
        </div>
        {error && <p className="text-[13px] text-bad bg-bad-bg rounded-lg px-3 py-2">{error}</p>}
      </div>
      <div className="mt-6 flex justify-end">
        <Button variant="primary" icon={faArrowRight} disabled={busy} onClick={() => void save()}>
          Continuar
        </Button>
      </div>
    </div>
  )
}

function UsersStep(props: {
  user: SessionUser
  onUserChanged: (u: SessionUser) => void
  onNext: () => void
  onBack: () => void
}): React.JSX.Element {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwBusy, setPwBusy] = useState(false)

  const [others, setOthers] = useState<User[]>([])
  const [showNewUser, setShowNewUser] = useState(false)

  function reload(): void {
    void api.users.list().then((rows) => setOthers(rows.filter((r) => r.id !== props.user.id)))
  }
  useEffect(reload, [])

  async function changePassword(): Promise<void> {
    if (newPassword.length < 8) {
      setPwError('La contraseña nueva debe tener al menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Las contraseñas no coinciden.')
      return
    }
    setPwBusy(true)
    setPwError(null)
    try {
      const result = await api.auth.changePassword({ currentPassword, newPassword })
      if (!result.ok) {
        setPwError('La contraseña actual no es correcta.')
        return
      }
      props.onUserChanged(result.user)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <div>
      <StepHeader
        icon={faUsers}
        title="Usuarios y accesos"
        subtitle="Define tu contraseña real y, si quieres, da de alta a la secretaria."
      />

      <div className="border border-line rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon icon={faKey} className="w-3.5 h-3.5 text-accent" />
          <h2 className="text-[13.5px] font-semibold">Tu contraseña</h2>
          {!props.user.mustChangePassword && <Icon icon={faCheckCircle} className="w-3.5 h-3.5 text-good ml-auto" />}
        </div>
        {props.user.mustChangePassword ? (
          <div className="flex flex-col gap-2.5">
            <p className="text-[12.5px] text-ink3">
              Sigues usando la contraseña inicial de desarrollo. Define una contraseña real antes de continuar.
            </p>
            <Field label="Contraseña actual">
              <TextInput value={currentPassword} onChange={setCurrentPassword} type="password" />
            </Field>
            <Field label="Nueva contraseña">
              <TextInput value={newPassword} onChange={setNewPassword} type="password" />
            </Field>
            <Field label="Confirmar nueva contraseña">
              <TextInput value={confirmPassword} onChange={setConfirmPassword} type="password" />
            </Field>
            {pwError && <p className="text-[13px] text-bad bg-bad-bg rounded-lg px-3 py-2">{pwError}</p>}
            <Button
              variant="primary"
              icon={faCheckCircle}
              disabled={pwBusy || !currentPassword || !newPassword}
              onClick={() => void changePassword()}
            >
              Guardar contraseña
            </Button>
          </div>
        ) : (
          <p className="text-[12.5px] text-good">Contraseña definida.</p>
        )}
      </div>

      <div className="border border-line rounded-xl p-4 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon icon={faUserPlus} className="w-3.5 h-3.5 text-accent" />
          <h2 className="text-[13.5px] font-semibold">Otros usuarios</h2>
          <Button onClick={() => setShowNewUser(true)}>Agregar</Button>
        </div>
        {others.length === 0 ? (
          <p className="text-[12.5px] text-ink3">
            Sin otros usuarios todavía. Puedes agregar a la secretaria ahora o después desde Configuración.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {others.map((u) => (
              <li key={u.id} className="text-[13px] flex items-center gap-2">
                <span className="font-medium">{u.fullName}</span>
                <span className="text-ink3">@{u.username}</span>
                <span className="text-ink3">· {u.role === 'admin' ? 'Administrador' : 'Secretaria'}</span>
              </li>
            ))}
          </ul>
        )}
        {showNewUser && (
          <NewUserInline
            onClose={() => setShowNewUser(false)}
            onCreated={() => {
              setShowNewUser(false)
              reload()
            }}
          />
        )}
      </div>

      <div className="mt-6 flex justify-between">
        <Button onClick={props.onBack}>Atrás</Button>
        <Button
          variant="primary"
          icon={faArrowRight}
          disabled={props.user.mustChangePassword}
          title={props.user.mustChangePassword ? 'Primero define tu contraseña real' : undefined}
          onClick={props.onNext}
        >
          Continuar
        </Button>
      </div>
    </div>
  )
}

function NewUserInline(props: { onClose: () => void; onCreated: () => void }): React.JSX.Element {
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'secretary'>('secretary')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(): Promise<void> {
    if (!fullName.trim() || username.trim().length < 3 || password.length < 8) {
      setError('Revisa nombre, usuario (mín. 3 caracteres) y contraseña (mín. 8 caracteres).')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await api.users.create({ fullName: fullName.trim(), username: username.trim(), password, role })
      if (!result.ok) {
        setError('Ese nombre de usuario ya existe.')
        return
      }
      props.onCreated()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-line flex flex-col gap-2.5">
      <Field label="Nombre completo">
        <TextInput value={fullName} onChange={setFullName} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Usuario">
          <TextInput value={username} onChange={setUsername} placeholder="ej. secretaria" />
        </Field>
        <Field label="Contraseña">
          <TextInput value={password} onChange={setPassword} type="password" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={role === 'admin'}
          onChange={(e) => setRole(e.target.checked ? 'admin' : 'secretary')}
          className="w-4 h-4 accent-[#163eab]"
        />
        Dar permisos de administrador
      </label>
      {error && <p className="text-[13px] text-bad bg-bad-bg rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button variant="primary" icon={faCheckCircle} disabled={busy} onClick={() => void save()}>
          Crear usuario
        </Button>
      </div>
    </div>
  )
}

function RecoveryKitStep(props: { onNext: () => void; onBack: () => void }): React.JSX.Element {
  const [cloud, setCloud] = useState<CloudConfigStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    void api.backups.getCloudConfig().then(setCloud)
  }, [])

  async function generate(): Promise<void> {
    setBusy(true)
    setSaved(null)
    try {
      const result = await api.backups.generateRecoveryKit()
      if (result.saved && result.path) setSaved(result.path)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <StepHeader
        icon={faShieldHalved}
        title="Kit de recuperación"
        subtitle="Una hoja para imprimir y guardar fuera de la laptop, con los pasos para restaurar un respaldo."
      />
      <p className="text-[13px]">
        {cloud?.configured
          ? `Respaldo en la nube configurado (bucket "${cloud.bucket}").`
          : 'Respaldo en la nube sin configurar todavía — puedes hacerlo después en Configuración → Respaldos.'}
      </p>
      <Button variant="primary" icon={faPrint} disabled={busy} onClick={() => void generate()}>
        Generar kit de recuperación (PDF)
      </Button>
      {saved && (
        <p className="mt-3 text-[13px] text-good bg-good-bg rounded-lg px-3 py-2">Guardado en {saved}</p>
      )}
      <div className="mt-6 flex justify-between">
        <Button onClick={props.onBack}>Atrás</Button>
        <Button variant="primary" icon={faArrowRight} onClick={props.onNext}>
          Continuar
        </Button>
      </div>
    </div>
  )
}

function WelcomeMembersStep(props: { onFinish: () => void; onBack: () => void }): React.JSX.Element {
  return (
    <div>
      <StepHeader
        icon={faUsers}
        title="Listo para dar de alta miembros"
        subtitle="No hay importador de Excel: el alta es manual, uno por uno."
      />
      <p className="text-[13px] text-ink3">
        Desde Miembros, usa el botón <strong>+ Nuevo → Miembro</strong> (o Cmd/Ctrl+N) para capturar nombre y datos
        básicos; el resto del expediente se completa después, desde la ficha de cada persona.
      </p>
      <div className="mt-6 flex justify-between">
        <Button onClick={props.onBack}>Atrás</Button>
        <Button variant="primary" icon={faCheckCircle} onClick={props.onFinish}>
          Ir a Miembros
        </Button>
      </div>
    </div>
  )
}
