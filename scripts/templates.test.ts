import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripTemplateNote, stripPartialNote } from './lib/templates.ts'

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
