/** True only for a file strictly inside `dir`: no `..` segments, raw or percent-encoded.
 *  Used for URIs that arrive via route params, which any deep link can set. */
export function isInside(uri: string | undefined, dir: string): boolean {
  if (!uri || !uri.startsWith(dir)) return false;
  let decoded: string;
  try {
    decoded = decodeURIComponent(uri);
  } catch {
    return false;
  }
  return !/(^|[/\\])\.\.([/\\]|$)/.test(decoded);
}
