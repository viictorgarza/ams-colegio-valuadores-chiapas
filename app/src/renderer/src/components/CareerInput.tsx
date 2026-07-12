import { CAREERS } from '@renderer/data/careers'
import { CatalogAutocomplete } from '@renderer/components/CatalogAutocomplete'

/** Campo de carrera con autocompletado sobre un catálogo offline de carreras
 * comunes entre valuadores. Si la carrera no está en la lista, se sigue
 * pudiendo capturar libremente. */
export function CareerInput(props: { value: string; onChange: (v: string) => void; autoFocus?: boolean }): React.JSX.Element {
  return <CatalogAutocomplete {...props} options={CAREERS} placeholder="Carrera" />
}
