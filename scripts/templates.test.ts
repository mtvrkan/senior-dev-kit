import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripTemplateNote, stripPartialNote, stripCssComments } from './lib/templates.ts'

// Regression: both helpers required a bare `\n` after the comment. On a CRLF checkout
// the match silently failed and the contributor notes — including one explaining why an
// SVG diagram had been abandoned — were published into the live page. Caught by
// diffing a Windows-built render against the one CI produced on Linux.
for (const [name, eol] of [['LF', '\n'], ['CRLF', '\r\n']] as const) {
  test(`stripTemplateNote removes the note on ${name} input`, () => {
    const html = `<!doctype html>${eol}<!-- note for contributors${eol}   second line -->${eol}<html lang="en">`
    assert.equal(stripTemplateNote(html), '<!doctype html>\n<html lang="en">')
  })

  test(`stripPartialNote removes the note on ${name} input`, () => {
    const html = `<!-- note for contributors${eol}   second line -->${eol}<ol class="pipe">`
    assert.equal(stripPartialNote(html), '<ol class="pipe">')
  })
}

test('a template without a note is left alone', () => {
  const html = '<!doctype html>\n<html lang="en">'
  assert.equal(stripTemplateNote(html), html)
  assert.equal(stripPartialNote('<ol class="pipe">'), '<ol class="pipe">')
})

test('only the leading comment goes — later ones are content', () => {
  const html = '<!-- lead -->\n<div>\n<!-- kept -->\n</div>'
  assert.equal(stripPartialNote(html), '<div>\n<!-- kept -->\n</div>')
})

// The stylesheet is the only source file the build copies rather than renders, so until this
// existed every art-direction note in it was published to visitors — the exact leak the two
// helpers above were written to stop, one file over.
test('stripCssComments removes comments and the blank lines they leave', () => {
  const css = '@charset "UTF-8";\n/* banner\n   second line */\n\n.a { color: red; } /* trailing */\n'
  assert.equal(stripCssComments(css), '@charset "UTF-8";\n\n.a { color: red; }\n')
})

test('stripCssComments leaves comment markers inside quoted values alone', () => {
  const css = `.a::before { content: "/* not a comment */"; }\n.b { background: url('a/*b*/c.png'); }\n`
  assert.equal(stripCssComments(css), css)
})

test('stripCssComments survives an escaped quote and an unterminated comment', () => {
  assert.equal(stripCssComments('.a { content: "he said \\" /* x */"; }'), '.a { content: "he said \\" /* x */"; }')
  assert.equal(stripCssComments('.a { color: red; }\n/* never closed'), '.a { color: red; }\n')
})
