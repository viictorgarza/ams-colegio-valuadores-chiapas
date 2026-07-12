import { UNIVERSITIES } from '@renderer/data/universities'
import { CatalogAutocomplete } from '@renderer/components/CatalogAutocomplete'

/** Campo de universidad con autocompletado sobre un catálogo offline
 * (docs/05 — sin internet en la oficina). Si la institución no está en la
 * lista, se sigue pudiendo capturar libremente. */
export function UniversityInput(props: { value: string; onChange: (v: string) => void; autoFocus?: boolean }): React.JSX.Element {
  return <CatalogAutocomplete {...props} options={UNIVERSITIES} placeholder="Universidad" />
}
