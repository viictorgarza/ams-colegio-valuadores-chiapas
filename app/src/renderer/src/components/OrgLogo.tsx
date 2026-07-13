import { useEffect, useState } from 'react'
import type { Organization } from '@shared/contracts'
import { api } from '@renderer/api'
import logoColegio from '@renderer/assets/logo-colegio.svg'

/** Logo de la organización si Victor lo subió (Configuración → Organización);
 * si no, el logo estático del Colegio que ya traía la app. */
export function OrgLogo(props: { org: Organization | null; className?: string }): React.JSX.Element {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!props.org?.hasLogo) {
      setDataUrl(null)
      return
    }
    void api.organization.getLogo().then((logo) => {
      setDataUrl(logo ? `data:${logo.mimeType};base64,${logo.dataBase64}` : null)
    })
  }, [props.org?.hasLogo])

  return <img src={dataUrl ?? logoColegio} alt="" className={props.className} />
}
