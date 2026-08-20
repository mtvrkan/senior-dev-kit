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

/**
 * Removes every comment from a stylesheet.
 *
 * `style.css` is the one source file `gen-site.ts` copies verbatim, so its comments — art
 * direction, abandoned approaches, the reasoning behind a breakpoint — were the only
 * contributor notes still reaching visitors after the HTML templates learned to strip theirs.
 * They stay in the source and leave at build time, same as the templates'.
 *
 * Hand-written rather than a regex: `/* ... *\/` inside a quoted value (a `content:` string, a
 * data-URI `url()`) is data, not a comment, so the scan tracks whether it is inside a string
 * before it will open one. No such value exists in the stylesheet today; the point is that
 * adding one later cannot quietly corrupt the published CSS.
 */
export function stripCssComments(css: string): string {
  let out = ''
  let quote: string | null = null
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]
    if (quote) {
      out += ch
      if (ch === '\\') out += css[++i] ?? ''
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      out += ch
      continue
    }
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      i = end === -1 ? css.length : end + 1
      continue
    }
    out += ch
  }
  // Stripping a whole-line comment leaves the line's indentation and newline behind; without
  // this the published file gains a few hundred lines of trailing whitespace and blank runs.
  return out
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
}
