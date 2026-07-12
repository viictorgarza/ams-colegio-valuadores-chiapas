import type { z } from 'zod'

/**
 * Un contrato IPC: canal + schema de entrada + schema de salida.
 * El main lo implementa con validación automática en ambos extremos;
 * el renderer obtiene un cliente tipado a partir del mismo objeto.
 */
export interface Contract<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> {
  channel: string
  input: I
  output: O
}

export function contract<I extends z.ZodType, O extends z.ZodType>(
  channel: string,
  input: I,
  output: O
): Contract<I, O> {
  return { channel, input, output }
}

export type ContractInput<C> = C extends Contract<infer I, z.ZodType> ? z.input<I> : never
export type ContractOutput<C> = C extends Contract<z.ZodType, infer O> ? z.output<O> : never
