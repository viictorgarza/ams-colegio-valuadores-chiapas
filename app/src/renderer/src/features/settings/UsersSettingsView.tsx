import { useEffect, useState } from 'react'
import { faKey, faPencil, faPlus, faUserCheck, faUserSlash } from '@fortawesome/free-solid-svg-icons'
import type { SessionUser, User } from '@shared/contracts'
import { api } from '@renderer/api'
import { Button, Chip, Field, Modal, TextInput } from '@renderer/components/ui'
import { useToast } from '@renderer/components/Toast'

/** Configuración → Usuarios (pedido de Victor, 2026-07-13): antes solo se
 * podían crear usuarios y activar/desactivar (desde el asistente de primera
 * ejecución). Aquí se agrega editar nombre/usuario y restablecer contraseña
 * de cualquier cuenta, incluida la propia — resuelve además el saludo
 * "Hola, Administrador" del dashboard, que toma el fullName de la sesión. */
export function UsersSettingsView(props: {
  user: SessionUser
  onUserChanged: (u: SessionUser) => void
}): React.JSX.Element {
  const [users, setUsers] = useState<User[]>([])
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [resetting, setResetting] = useState<User | null>(null)
  const notify = useToast()

  function reload(): void {
    void api.users.list().then(setUsers)
  }
  useEffect(reload, [])

  async function toggleActive(u: User): Promise<void> {
    const result = await api.users.setActive({ id: u.id, isActive: !u.isActive })
    if (!result.ok) {
      notify('No se puede desactivar: debe quedar al menos un administrador activo.', 'bad')
      return
    }
    notify(u.isActive ? 'Usuario desactivado.' : 'Usuario activado.')
    reload()
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Configuración</h1>
          <p className="text-[13px] text-ink3 mt-0.5">Usuarios</p>
        </div>
        <Button variant="primary" icon={faPlus} onClick={() => setShowNew(true)}>
          Agregar usuario
        </Button>
      </div>

      <div className="border border-line rounded-xl bg-surface divide-y divide-line max-w-3xl">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-3 flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[13.5px]">{u.fullName}</span>
                {!u.isActive && <Chip tone="muted">Inactivo</Chip>}
                {u.id === props.user.id && <Chip tone="accent">Tú</Chip>}
              </div>
              <p className="text-[12.5px] text-ink3">
                @{u.username} · {u.role === 'admin' ? 'Administrador' : 'Secretaria'}
              </p>
            </div>
            <Button icon={faPencil} onClick={() => setEditing(u)}>
              Editar
            </Button>
            <Button icon={faKey} onClick={() => setResetting(u)}>
              Restablecer contraseña
            </Button>
            <Button
              variant={u.isActive ? 'danger' : 'ghost'}
              icon={u.isActive ? faUserSlash : faUserCheck}
              onClick={() => void toggleActive(u)}
            >
              {u.isActive ? 'Desactivar' : 'Activar'}
            </Button>
          </div>
        ))}
      </div>

      {showNew && (
        <NewUserModal
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false)
            notify('Usuario creado.')
            reload()
          }}
        />
      )}
      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setEditing(null)
            notify('Usuario actualizado.')
            if (updated.id === props.user.id) {
              props.onUserChanged({
                id: updated.id,
                username: updated.username,
                fullName: updated.fullName,
                role: updated.role,
                mustChangePassword: props.user.mustChangePassword
              })
            }
            reload()
          }}
        />
      )}
      {resetting && (
        <ResetPasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
          onDone={() => {
            setResetting(null)
            notify('Contraseña restablecida. Se pedirá cambiarla en el siguiente inicio de sesión.')
          }}
        />
      )}
    </div>
  )
}

function NewUserModal(props: { onClose: () => void; onCreated: () => void }): React.JSX.Element {
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
    <Modal
      title="Agregar usuario"
      onClose={props.onClose}
      footer={
        <>
          <Button onClick={props.onClose}>Cancelar</Button>
          <Button variant="primary" disabled={busy} onClick={() => void save()}>
            Crear
          </Button>
        </>
      }
    >
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
    </Modal>
  )
}

function EditUserModal(props: { user: User; onClose: () => void; onSaved: (u: User) => void }): React.JSX.Element {
  const [fullName, setFullName] = useState(props.user.fullName)
  const [username, setUsername] = useState(props.user.username)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(): Promise<void> {
    if (!fullName.trim() || username.trim().length < 3) {
      setError('Revisa nombre y usuario (mín. 3 caracteres).')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await api.users.update({ id: props.user.id, fullName: fullName.trim(), username: username.trim() })
      if (!result.ok) {
        setError('Ese nombre de usuario ya existe.')
        return
      }
      props.onSaved(result.user)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Editar usuario"
      onClose={props.onClose}
      footer={
        <>
          <Button onClick={props.onClose}>Cancelar</Button>
          <Button variant="primary" disabled={busy} onClick={() => void save()}>
            Guardar
          </Button>
        </>
      }
    >
      <Field label="Nombre completo">
        <TextInput value={fullName} onChange={setFullName} autoFocus />
      </Field>
      <Field label="Usuario">
        <TextInput value={username} onChange={setUsername} />
      </Field>
      {error && <p className="text-[13px] text-bad bg-bad-bg rounded-lg px-3 py-2">{error}</p>}
    </Modal>
  )
}

function ResetPasswordModal(props: { user: User; onClose: () => void; onDone: () => void }): React.JSX.Element {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(): Promise<void> {
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.users.resetPassword({ id: props.user.id, newPassword })
      props.onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`Restablecer contraseña de ${props.user.fullName}`}
      subtitle="Se le pedirá definir una contraseña nueva en su siguiente inicio de sesión."
      onClose={props.onClose}
      footer={
        <>
          <Button onClick={props.onClose}>Cancelar</Button>
          <Button variant="primary" disabled={busy} onClick={() => void save()}>
            Restablecer
          </Button>
        </>
      }
    >
      <Field label="Contraseña nueva">
        <TextInput value={newPassword} onChange={setNewPassword} type="password" autoFocus />
      </Field>
      <Field label="Confirmar contraseña nueva">
        <TextInput value={confirmPassword} onChange={setConfirmPassword} type="password" />
      </Field>
      {error && <p className="text-[13px] text-bad bg-bad-bg rounded-lg px-3 py-2">{error}</p>}
    </Modal>
  )
}
