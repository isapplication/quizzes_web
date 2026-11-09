/**
 * LTI launches: the Quiz API sends the browser to /lti/opening#<code> (often inside the LMS's frame). The one-time
 * code lives only after "#", so it never reaches a server log or a Referer; the page that redeems it reads it here.
 */
export function codeFromHash(hash: string): string | null {
  const code = hash.startsWith("#") ? hash.slice(1) : hash;
  return /^[A-Za-z0-9_-]{16,200}$/.test(code) ? code : null;
}

/** Where the new tab signs in with the code. */
export function openPath(code: string): string {
  return "/lti/open#" + code;
}
