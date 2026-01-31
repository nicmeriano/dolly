import { EventEmitter } from "node:events";

export interface RunEvents {
  "run:start": { planName: string; totalActions: number };
  "run:complete": { planName: string; durationMs: number };
  "run:error": { error: Error };

  "action:start": { actionId: string; index: number; total: number };
  "action:complete": { actionId: string; retriesUsed: number };

  "step:start": { actionId: string; stepIndex: number; stepType: string; totalSteps: number };
  "step:complete": { actionId: string; stepIndex: number; stepType: string };
  "step:retry": { actionId: string; stepIndex: number; attempt: number; error: Error };

  "convert:start": { inputPath: string };
  "convert:complete": { outputPath: string };
}

export type RunEventName = keyof RunEvents;

export class TypedEmitter extends EventEmitter {
  emit<K extends RunEventName>(event: K, data: RunEvents[K]): boolean {
    return super.emit(event, data);
  }

  on<K extends RunEventName>(event: K, listener: (data: RunEvents[K]) => void): this {
    return super.on(event, listener);
  }

  once<K extends RunEventName>(event: K, listener: (data: RunEvents[K]) => void): this {
    return super.once(event, listener);
  }
}
