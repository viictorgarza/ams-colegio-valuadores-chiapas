// @types/archiver en npm describe la API de clases de archiver@8 (ZipArchive, …),
// pero el paquete real instalado (archiver@7, API estable) exporta una función
// factory clásica. Declaración mínima propia para lo que usamos aquí.
declare module 'archiver' {
  import type { Writable } from 'node:stream'

  interface ArchiverInstance extends Writable {
    pipe(destination: NodeJS.WritableStream): void
    file(filePath: string, options: { name: string }): void
    directory(dirPath: string, destPath: string): void
    finalize(): Promise<void>
    on(event: 'error', listener: (err: Error) => void): this
  }

  function archiver(format: 'zip' | 'tar', options?: { zlib?: { level: number } }): ArchiverInstance

  export default archiver
}
