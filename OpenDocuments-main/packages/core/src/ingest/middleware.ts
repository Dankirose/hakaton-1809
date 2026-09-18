import type { MiddlewarePlugin, PipelineStage } from '../plugin/interfaces.js'

export class MiddlewareRunner {
  private hooks = new Map<PipelineStage, Array<(data: unknown) => Promise<unknown>>>()

  registerPlugin(plugin: MiddlewarePlugin): void {
    for (const hook of plugin.hooks) {
      const existing = this.hooks.get(hook.stage) || []
      existing.push(hook.handler)
      this.hooks.set(hook.stage, existing)
    }
  }

  async run<T>(stage: PipelineStage, data: T): Promise<T> {
    const handlers = this.hooks.get(stage)
    if (!handlers || handlers.length === 0) return data
    let result: unknown = data
    for (const handler of handlers) {
      result = await handler(result)
    }
    return result as T
  }
}
