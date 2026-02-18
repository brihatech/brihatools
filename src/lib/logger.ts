type LogLevel = "info" | "error";

type LogFields = Record<string, unknown>;

function serializeError(error: unknown): LogFields | undefined {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { value: error };
}

function emit(level: LogLevel, event: string, fields?: LogFields): void {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...fields,
  };

  if (level === "error") {
    console.error(payload);
    return;
  }

  console.info(payload);
}

export function logInfo(event: string, fields?: LogFields): void {
  emit("info", event, fields);
}

export function logError(
  event: string,
  error?: unknown,
  fields?: LogFields,
): void {
  emit("error", event, {
    ...fields,
    error: serializeError(error),
  });
}
