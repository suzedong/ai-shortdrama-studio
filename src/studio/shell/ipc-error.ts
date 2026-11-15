/** Electron invoke 抛错会被包一层 'Error invoking remote method …'，剥壳取主进程原文。 */
export function ipcErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const match = /^Error invoking remote method '[^']+': Error: ([\s\S]*)$/.exec(message)
  return match ? match[1] : message
}
