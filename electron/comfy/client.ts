// feature-017 · ComfyClient 接口 + 占位 holder（真实实现由 023 注入）

export interface ComfyClient {
  queue(req: {
    instanceId: string
    workflow: Record<string, unknown>
    inputs?: Record<string, unknown>
  }): Promise<{ jobId: string }>
  status(req: {
    instanceId: string
    jobId: string
  }): Promise<{ state: string; outputs?: { path: string; kind: string }[] }>
}

let holder: ComfyClient | null = null

export function setComfyClient(c: ComfyClient | null): void {
  holder = c
}

export function getComfyClient(): ComfyClient | null {
  return holder
}
