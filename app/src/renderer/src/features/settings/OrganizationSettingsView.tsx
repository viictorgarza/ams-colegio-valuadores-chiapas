import { useEffect, useState } from 'react'
import { faCheckCircle, faImage, faTrashCan } from '@fortawesome/free-solid-svg-icons'
import type { Organization } from '@shared/contracts'
import { api } from '@renderer/api'
import { Button, Field, Icon, TextInput } from '@renderer/components/ui'

/** Configuración → Organización (M5): antes del wizard, estos datos solo se
 * podían capturar una vez, en la primera ejecución — sin forma de editarlos
 * después. Reutiliza organization:update (ya construido para el wizard). */
export function OrganizationSettingsView(): React.JSX.Element {
  const [org, setOrg] = useState<Organization | null>(null)
  const [name, setName] = useState('')
  const [shortName, setShortName] = useState('')
  const [rfc, setRfc] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)

  function reload(): void {
    void api.organization.get().then((o) => {
      if (!o) return
      setOrg(o)
      setName(o.name)
      setShortName(o.shortName ?? '')
      setRfc(o.rfc ?? '')
      setStreet(o.street ?? '')
      setCity(o.city ?? '')
      setState(o.state ?? '')
      setZip(o.zip ?? '')
      setPhone(o.phone ?? '')
      setEmail(o.email ?? '')
      setWebsite(o.website ?? '')
    })
  }
  useEffect(reload, [])

  async function save(): Promise<void> {
    if (!name.trim()) {
      setMessage({ tone: 'bad', text: 'El nombre de la organización es obligatorio.' })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const updated = await api.organization.update({
        name: name.trim(),
        shortName: shortName.trim() || null,
        rfc: rfc.trim() || null,
        street: street.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        zip: zip.trim() || null,
        country: org?.country ?? null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        website: website.trim() || null
      })
      setOrg(updated)
      setMessage({ tone: 'good', text: 'Datos guardados.' })
    } catch {
      setMessage({ tone: 'bad', text: 'No se pudo guardar. Verifica el correo electrónico.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-[13px] text-ink3 mt-0.5">Organización</p>
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-6 max-w-3xl">
        <LogoSection />

        <div className="border border-line rounded-xl bg-surface p-5 flex flex-col gap-3">
          <Field label="Nombre completo">
            <TextInput value={name} onChange={setName} />
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
          <Field label="Sitio web" hint="Opcional">
            <TextInput value={website} onChange={setWebsite} />
          </Field>

          {message && (
            <p
              className={`text-[13px] rounded-lg px-3 py-2 ${message.tone === 'good' ? 'text-good bg-good-bg' : 'text-bad bg-bad-bg'}`}
            >
              {message.text}
            </p>
          )}

          <div>
            <Button variant="primary" icon={faCheckCircle} disabled={busy} onClick={() => void save()}>
              Guardar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function LogoSection(): React.JSX.Element {
  const [org, setOrg] = useState<Organization | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function reload(): void {
    void api.organization.get().then(setOrg)
    void api.organization.getLogo().then((logo) => {
      setLogoUrl(logo ? `data:${logo.mimeType};base64,${logo.dataBase64}` : null)
    })
  }
  useEffect(reload, [])

  async function upload(): Promise<void> {
    setBusy(true)
    try {
      const updated = await api.organization.uploadLogo()
      if (updated) reload()
    } finally {
      setBusy(false)
    }
  }

  async function remove(): Promise<void> {
    setBusy(true)
    try {
      await api.organization.removeLogo()
      reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-line rounded-xl bg-surface p-5 flex flex-col items-center gap-3 h-fit">
      <div className="w-full aspect-square rounded-lg border border-dashed border-line grid place-items-center bg-inset overflow-hidden">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
        ) : (
          <Icon icon={faImage} className="w-6 h-6 text-ink3" />
        )}
      </div>
      <Button icon={faImage} disabled={busy} onClick={() => void upload()}>
        {org?.hasLogo ? 'Cambiar logo' : 'Subir logo'}
      </Button>
      {org?.hasLogo && (
        <Button variant="danger" icon={faTrashCan} disabled={busy} onClick={() => void remove()}>
          Quitar
        </Button>
      )}
    </div>
  )
}
