import { logger } from './logger';

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      
      logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`, {
        error: lastError.message,
      });

      if (onRetry) {
        onRetry(lastError, attempt);
      }

      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Wrap a promise with a timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff for reconnection scenarios
 */
export async function reconnectWithBackoff(
  connectFn: () => Promise<void>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    onAttempt?: (attempt: number, delay: number) => void;
  } = {}
): Promise<void> {
  const {
    maxAttempts = Infinity,
    baseDelayMs = 1000,
    maxDelayMs = 60000,
    onAttempt,
  } = options;

  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      await connectFn();
      return;
    } catch (error) {
      attempt++;
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);

      logger.warn(`Connection attempt ${attempt} failed, retrying in ${delay}ms...`);

      if (onAttempt) {
        onAttempt(attempt, delay);
      }

      await sleep(delay);
    }
  }

  throw new Error(`Failed to connect after ${maxAttempts} attempts`);
}
