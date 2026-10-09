// feature-017 · 全局单写队列（自 session.ts 等价抽取）
// 新旧所有写操作共用同一队列，按入队顺序串行执行，避免并发读-改-写互相覆盖。

let writeChain: Promise<unknown> = Promise.resolve()

export function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeChain.then(task)
  // 队列本身不因单个任务失败而中断
  writeChain = run.then(() => undefined, () => undefined)
  return run
}
