// Stripping the contributor comments off the landing page's templates.
//
// Two one-line regexes, in their own module for one reason: they were inside
// `gen-site.ts`, which reads `site/` at import time, so nothing could unit-test them
// without the page-source branch checked out. They shipped a bug because of that.
//
// The bug: both patterns required the comment to end with a bare `\n`. On a checkout
// where the templates carry CRLF the match fails, the comment survives, and the notes
// written for contributors get published to strangers. The kit's own `.gitattributes`
// normalises to LF and would have prevented it — but the `site-src` branch had no
// `.gitattributes` of its own, and a rule that only holds on one branch is not a rule.
// Both are fixed now: the branch normalises, and these tolerate `\r` regardless.
const OPTIONAL_CR = String.raw`\r?\n`

/** Removes the comment block that follows `<!doctype html>` in a page template. */
export function stripTemplateNote(html: string): string {
  return html.replace(new RegExp(`^<!doctype html>${OPTIONAL_CR}<!--[\\s\\S]*?-->${OPTIONAL_CR}`, 'i'), '<!doctype html>\n')
}

/** Removes the leading comment block from a partial, and its surrounding blank space. */
export function stripPartialNote(html: string): string {
  return html.replace(new RegExp(`^<!--[\\s\\S]*?-->${OPTIONAL_CR}`), '').trim()
}
