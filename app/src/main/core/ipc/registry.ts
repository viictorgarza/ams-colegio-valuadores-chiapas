import { ipcMain } from 'electron'
import type { z } from 'zod'
import type { Contract } from '@shared/contracts'

/**
 * Registra la implementación de un contrato IPC.
 * Valida la entrada y la salida con zod en el proceso principal;
 * el renderer valida de nuevo en su extremo (desconfianza mutua).
 */
export function handle<I extends z.ZodType, O extends z.ZodType>(
  c: Contract<I, O>,
  fn: (input: z.output<I>) => Promise<z.input<O>> | z.input<O>
): void {
  ipcMain.handle(c.channel, async (_event, raw: unknown) => {
    const input = c.input.parse(raw)
    const result = await fn(input as z.output<I>)
    return c.output.parse(result)
  })
}
