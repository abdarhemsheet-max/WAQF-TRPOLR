export async function withRetry(fn, { maxRetries = 3, baseDelay = 200 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && isRetryable(err)) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

function isRetryable(err) {
  if (!err) return false;
  const msg = (err.message || err.code || '').toLowerCase();
  return msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('40') ||
    msg.includes('deadlock') ||
    msg.includes('too many clients') ||
    msg.includes('concurrent') ||
    msg.includes('connection') ||
    msg.includes('etimedout') ||
    msg.includes('econnreset');
}
