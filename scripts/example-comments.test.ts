import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findExampleComments, proseVerdict } from './lib/example-comments.ts'

const fenced = (lang: string, body: string) => `intro\n\n\`\`\`${lang}\n${body}\n\`\`\`\n`
const lines = (md: string) => findExampleComments(md).map(c => c.text)

test('flags full-line and trailing comments in slash languages', () => {
  const md = fenced('typescript', ['// explain', 'const a = 1 // why', '/* block */', ' * jsdoc line', 'const b = 2'].join('\n'))
  assert.deepEqual(lines(md), ['// explain', 'const a = 1 // why', '/* block */', '* jsdoc line'])
})

test('does not mistake URLs, strings or division for comments', () => {
  const md = fenced('ts', ["fetch('https://api.example.com/v1')", 'const s = "a // b"', 'const r = x / y', 'const u = `//cdn.example.com`'].join('\n'))
  assert.deepEqual(lines(md), [])
})

test('flags hash comments in shell, yaml and python, not colours or shebangs', () => {
  assert.deepEqual(lines(fenced('bash', ['#!/usr/bin/env bash', '# install', 'npm ci  # clean install', 'echo "#fff"'].join('\n'))), ['# install', 'npm ci  # clean install'])
  assert.deepEqual(lines(fenced('yaml', ['on: push', '# trigger'].join('\n'))), ['# trigger'])
  assert.deepEqual(lines(fenced('graphql', ['# depth limit', 'type Query { user(id: ID!): User }'].join('\n'))), ['# depth limit'])
})

test('flags SQL, markup and JSX comments', () => {
  assert.deepEqual(lines(fenced('sql', ['-- note', 'SELECT 1; -- why'].join('\n'))), ['-- note', 'SELECT 1; -- why'])
  assert.deepEqual(lines(fenced('html', '<!-- banner -->\n<p>x</p>')), ['<!-- banner -->'])
  assert.deepEqual(lines(fenced('tsx', '<div>{/* only if */}</div>')), ['<div>{/* only if */}</div>'])
})

test('reads a leading universal selector as CSS, not a block-comment continuation', () => {
  const css = fenced('css', ['* { @apply border-border; }', '*, *::before { box-sizing: border-box; }', '/* note */', ' * continued'].join('\n'))
  assert.deepEqual(lines(css), ['/* note */', '* continued'])
})

test('allows language directives and the Rust SAFETY note', () => {
  const rust = fenced('rust', ['// SAFETY: the pointer is valid for the lifetime of the borrow', '#[derive(Debug)]', 'unsafe { f() }'].join('\n'))
  assert.deepEqual(lines(rust), [])
  assert.deepEqual(lines(fenced('ts', '// @ts-expect-error legacy type\nfoo()')), [])
  assert.deepEqual(lines(fenced('dockerfile', '# syntax=docker/dockerfile:1\nFROM node:24')), [])
})

test('skips diff and json fences, and treats unlabelled and text fences conservatively', () => {
  assert.deepEqual(lines(fenced('diff', '# not code\n// arrow')), [])
  assert.deepEqual(lines(fenced('json', '{ "a": "// b" }')), [])
  assert.deepEqual(lines(fenced('', '// a comment\nnpm run check --flag\n--help')), ['// a comment'])
  assert.deepEqual(lines(fenced('text', 'allow read: if true;  // why\nGET /health -> 200')), ['allow read: if true;  // why'])
})

test('reports 1-based line numbers of the markdown file on CRLF input', () => {
  const md = 'a\r\n```js\r\nx()\r\n// y\r\n```\r\n'
  assert.deepEqual(findExampleComments(md), [{ line: 4, text: '// y' }])
})

test('reads a WRONG/RIGHT verdict from the prose line before a fence', () => {
  assert.equal(proseVerdict('WRONG — sequential:'), 'negative')
  assert.equal(proseVerdict('**RIGHT:** parallel'), 'positive')
  assert.equal(proseVerdict('- Insecure example'), 'negative')
  assert.equal(proseVerdict('Use this pattern:'), null)
})
