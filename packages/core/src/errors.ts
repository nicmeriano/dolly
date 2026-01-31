export class DollyError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DollyError";
  }
}

export class StepError extends DollyError {
  constructor(
    public readonly stepIndex: number,
    public readonly stepType: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(`Step ${stepIndex} (${stepType}): ${message}`, options);
    this.name = "StepError";
  }
}

export class ActionError extends DollyError {
  constructor(
    public readonly actionId: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(`Action "${actionId}": ${message}`, options);
    this.name = "ActionError";
  }
}

export class FfmpegError extends DollyError {
  constructor(
    message: string,
    public readonly stderr?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "FfmpegError";
  }
}

export class AbortError extends DollyError {
  constructor(message = "Operation aborted") {
    super(message);
    this.name = "AbortError";
  }
}
