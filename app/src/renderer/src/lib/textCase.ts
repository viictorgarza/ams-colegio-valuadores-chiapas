const LOWERCASE_PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do', 'von', 'van'])

/** Title Case por palabra, con partículas comunes en minúsculas salvo al inicio.
 * Usado en nombres, apellidos, domicilio y datos profesionales — donde texto
 * capturado en minúsculas o mayúsculas sostenidas se ve mal en impresos/PDFs. */
export function toTitleCase(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, ' ')
  if (!trimmed) return trimmed
  const words = trimmed.split(' ')
  return words
    .map((word, index) => {
      const lower = word.toLocaleLowerCase('es-MX')
      if (index > 0 && LOWERCASE_PARTICLES.has(lower)) return lower
      return lower.charAt(0).toLocaleUpperCase('es-MX') + lower.slice(1)
    })
    .join(' ')
}
