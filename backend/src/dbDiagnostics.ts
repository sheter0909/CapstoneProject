type ErrorDetails = {
  code: string;
  message: string;
  stack?: string;
};

function errorRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  return value as Record<string, unknown>;
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, '[redacted database URL]')
    .replace(
      /(\b(?:password|passwd|token|secret)\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1[redacted]',
    );
}

export function getErrorDetails(error: unknown): ErrorDetails {
  let current: unknown = error;
  const messages: string[] = [];
  let stack: string | undefined;
  let code: string | undefined;

  for (let depth = 0; current !== undefined && depth < 4; depth += 1) {
    const record = errorRecord(current);
    if (!record) break;

    if (typeof record.message === 'string' && !messages.includes(record.message)) {
      messages.push(record.message);
    }
    if (!stack && typeof record.stack === 'string') stack = record.stack;
    const meta = errorRecord(record.meta);
    if (meta && typeof meta.driverAdapterError === 'object' && meta.driverAdapterError !== null) {
      const adapterErr = meta.driverAdapterError as Record<string, unknown>;
      if (typeof adapterErr.message === 'string' && !messages.includes(adapterErr.message)) {
        messages.push(adapterErr.message);
      }
      const adapterCause = errorRecord(adapterErr.cause);
      if (adapterCause) {
        const adapterCode = adapterCause.originalCode ?? adapterCause.code ?? adapterCause.errorCode ?? adapterCause.kind;
        if (typeof adapterCode === 'string' || typeof adapterCode === 'number') {
          code = String(adapterCode);
        }
        const causeMsg = adapterCause.originalMessage ?? adapterCause.message;
        if (typeof causeMsg === 'string' && !messages.includes(causeMsg)) {
          messages.push(causeMsg);
        }
      }
    }

    if (!code || code === 'P2010') {
      const errorCode = record.code ?? record.errorCode;
      if (typeof errorCode === 'string' || typeof errorCode === 'number') {
        code = String(errorCode);
      }
    }

    current = record.cause;
  }

  return {
    code: code ?? 'unknown',
    message: redactSensitiveText(messages.join(' | caused by: ') || String(error)),
    ...(stack ? { stack: redactSensitiveText(stack) } : {}),
  };
}

export function databaseErrorReason(error: unknown): 'auth_failed' | 'timeout' | 'unreachable' {
  const { code, message } = getErrorDetails(error);
  const normalizedCode = code.toUpperCase();
  const normalizedMessage = message.toLowerCase();

  if (
    ['28P01', '28000', 'P1000', 'P1010'].includes(normalizedCode) ||
    /password authentication failed|authentication failed|access denied/.test(normalizedMessage)
  ) {
    return 'auth_failed';
  }
  if (
    ['P1002', 'ETIMEDOUT', '57014'].includes(normalizedCode) ||
    /timed?\s*out|timeout/.test(normalizedMessage)
  ) {
    return 'timeout';
  }
  return 'unreachable';
}

export function logDatabaseError(context: string, error: unknown): void {
  const details = getErrorDetails(error);
  console.error(`[database] ${context}`, {
    code: details.code,
    message: details.message,
    ...(details.stack ? { stack: details.stack } : {}),
  });
}
