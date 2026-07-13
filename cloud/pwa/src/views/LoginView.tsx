import { useState } from 'react'
import { api, setToken } from '../api'
import type { SessionUser } from '../types'
import { Button, ErrorBanner, Field, TextInput } from '../ui'

export function LoginView({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await api.login(username, password)
      setToken(r.token)
      onLogin(r.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={(e) => void submit(e)} className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <img src="/icons/icon-192.png" alt="Logo del Colegio" className="h-20 w-20 rounded-2xl shadow" />
          <div className="text-center">
            <h1 className="text-xl font-semibold">AMS</h1>
            <p className="text-sm text-ink3">Colegio de Especialistas en Valuación Profesional de Chiapas</p>
          </div>
        </div>
        {error && <ErrorBanner message={error} />}
        <div className="space-y-4">
          <Field label="Usuario">
            <TextInput value={username} onChange={setUsername} autoFocus />
          </Field>
          <Field label="Contraseña">
            <TextInput value={password} onChange={setPassword} type="password" />
          </Field>
          <Button type="submit" disabled={busy || !username || !password} full>
            {busy ? 'Entrando…' : 'Entrar'}
          </Button>
        </div>
      </form>
    </div>
  )
}
