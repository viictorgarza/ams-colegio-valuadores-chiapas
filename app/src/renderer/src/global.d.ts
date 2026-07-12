export {}

declare global {
  interface Window {
    ams: {
      invoke(channel: string, payload: unknown): Promise<unknown>
      getPathForFile(file: File): string
    }
  }
}
