/** Reads JSON that is still being written: closes the open string, array and object and drops a dangling key. Null when nothing can be read yet */
export const parsePartialJson = (source: string): unknown => {
  const closers: string[] = [];
  let inString = false;
  let escaped = false;
  // Where the text can be cut to stay valid once the open brackets are closed
  let safeEnd = 0;
  let safeDepth = 0;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') {
        inString = false;
        safeEnd = i + 1;
        safeDepth = closers.length;
      }
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{' || char === '[') {
      closers.push(char === '{' ? '}' : ']');
      safeEnd = i + 1;
      safeDepth = closers.length;
    } else if (char === '}' || char === ']') {
      closers.pop();
      safeEnd = i + 1;
      safeDepth = closers.length;
    } else if (/[\d\w.+-]/.test(char)) {
      // A number or literal only counts once something follows it
      if (i + 1 < source.length && !/[\d\w.+-]/.test(source[i + 1])) {
        safeEnd = i + 1;
        safeDepth = closers.length;
      }
    }
  }

  const close = (text: string, depth: number) => `${text}${closers.slice(0, depth).reverse().join('')}`;
  const attempts: string[] = [];
  // Keep a string cut off inside its value
  if (inString && !escaped) attempts.push(close(`${source}"`, closers.length));
  const kept = source.slice(0, safeEnd);
  attempts.push(close(kept, safeDepth));
  // `"key"` or `"key":` with no value yet
  attempts.push(close(kept.replace(/,?\s*"(?:[^"\\]|\\.)*"\s*:?\s*$/, ''), safeDepth));

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // Try the next, shorter reading
    }
  }
  return null;
};
