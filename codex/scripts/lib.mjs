import { homedir } from 'node:os'
import { isAbsolute, relative, resolve, sep } from 'node:path'

export function globToRegExp(glob) {
  let out = ''
  let depth = 0
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i]
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        i += 1
        if (glob[i + 1] === '/') {
          i += 1
          out += '(?:.*/)?'
        } else {
          out += '.*'
        }
      } else {
        out += '[^/]*'
      }
    } else if (ch === '?') {
      out += '[^/]'
    } else if (ch === '{') {
      depth += 1
      out += '(?:'
    } else if (ch === '}' && depth > 0) {
      depth -= 1
      out += ')'
    } else if (ch === ',' && depth > 0) {
      out += '|'
    } else {
      out += ch.replace(/[.+^$()|[\]\\{}]/g, '\\$&')
    }
  }
  return new RegExp(`^${out}$`)
}

export function commandPatternToRegExp(pattern) {
  const body = pattern
    .split('*')
    .map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\s\\S]*')
  return new RegExp(`^${body}$`)
}

function toPosix(path) {
  return sep === '\\' ? path.replace(/\\/g, '/') : path
}

export function expandHome(token, home = homedir()) {
  if (token === '~') return home
  if (token.startsWith('~/')) return `${home}/${token.slice(2)}`
  if (token.startsWith('$HOME/')) return `${home}/${token.slice(6)}`
  return token
}

export function pathForms(token, cwd, home = homedir()) {
  const expanded = expandHome(token, home)
  const absolute = toPosix(isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded))
  const rel = toPosix(relative(cwd, absolute))
  const inside = rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
  return { absolute, relative: inside ? rel : absolute.replace(/^\/+/, '') }
}

export function compilePathPatterns(patterns, home = homedir()) {
  return patterns.map(pattern => {
    if (pattern.startsWith('~/')) {
      return { pattern, home: true, regex: globToRegExp(`${toPosix(home)}/${pattern.slice(2)}`) }
    }
    return { pattern, home: false, regex: globToRegExp(pattern.replace(/^\.\//, '')) }
  })
}

export function matchPath(compiled, forms) {
  for (const entry of compiled) {
    if (entry.regex.test(entry.home ? forms.absolute : forms.relative)) return entry.pattern
  }
  return null
}

export function splitSegments(command) {
  return command
    .split(/\n|&&|\|\||;|\|/)
    .map(part => part.trim())
    .filter(part => part !== '')
}

export function tokenize(segment) {
  const tokens = []
  const pattern = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g
  let match = pattern.exec(segment)
  while (match !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3])
    match = pattern.exec(segment)
  }
  return tokens
}

const WRAPPERS = new Set(['sudo', 'command', 'env', 'nohup', 'time', 'exec', 'builtin'])

export function verbOf(tokens) {
  let index = 0
  while (index < tokens.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index]) || WRAPPERS.has(tokens[index]))) {
    index += 1
  }
  const verb = tokens[index] ?? ''
  return { verb: verb.split('/').pop().toLowerCase(), rest: tokens.slice(index + 1) }
}

export const READ_VERBS = new Set([
  'cat', 'bat', 'head', 'tail', 'less', 'more', 'nl', 'tac', 'sed', 'awk', 'gawk', 'grep', 'egrep', 'fgrep',
  'rg', 'ag', 'strings', 'xxd', 'od', 'hexdump', 'cut', 'sort', 'uniq', 'jq', 'yq', 'base64', 'open', 'cp',
  'mv', 'scp', 'rsync', 'tar', 'zip', 'source', '.', 'view', 'vi', 'vim', 'nano', 'diff', 'cmp', 'paste',
  'get-content', 'gc', 'type', 'select-string', 'copy-item', 'move-item',
])

export const WRITE_VERBS = new Set(['tee', 'truncate', 'set-content', 'add-content', 'out-file'])

export function pathTokens(tokens) {
  return tokens.filter(token => token !== '' && !token.startsWith('-') && !/^[<>|&]+$/.test(token))
}

export function redirectTargets(tokens) {
  const targets = []
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    const inline = /^\d?>>?(.+)$/.exec(token)
    if (inline && !inline[1].startsWith('&')) targets.push(inline[1])
    else if (/^\d?>>?$/.test(token) && tokens[i + 1]) targets.push(tokens[i + 1])
  }
  return targets
}

export function patchPaths(patch) {
  const paths = []
  for (const line of patch.split('\n')) {
    const match = /^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/.exec(line.trimEnd())
    if (match) paths.push(match[1].trim())
  }
  return paths
}
