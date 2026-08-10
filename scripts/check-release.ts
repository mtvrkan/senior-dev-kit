#!/usr/bin/env node
/**
 * Verifies that the install path this repo documents actually works for a
 * stranger — the one class of claim the offline gate cannot reach.
 *
 * `npm run check` proves the tree is internally consistent: the counts match
 * disk, the flags match the parser, the manifests match the components. It
 * cannot prove the thing every one of those claims is ultimately about, which
 * is that `/plugin marketplace add <slug>` resolves for somebody who is not the
 * maintainer. That failed silently once already: the repository was private
 * while README.md, LICENSE, CONTRIBUTING.md, the issue templates and a
 * vulnerability-disclosure policy all described a public project, so every
 * documented install command 404'd for everyone but the owner.
 *
 * Deliberately NOT part of `npm run check`: it needs the network and it asserts
 * a property of the published repository rather than of the working tree, so a
 * fork or an offline contributor would fail it for no fault of their own. Run
 * it before announcing a release.
 *
 * Usage: node --experimental-strip-types scripts/check-release.ts
 */
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = process.env.RELEASE_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const errors: string[] = []
const notes: string[] = []

const pkg = JSON.parse(read('package.json'))
const slug: string | undefined = String(pkg.repository?.url ?? '').match(
  /github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?$/
)?.[1]

if (!slug) {
  console.error('✗ package.json repository.url is not a parseable github.com URL — nothing to verify')
  process.exit(1)
}

async function main(): Promise<void> {
  const api = `https://api.github.com/repos/${slug}`
  const res = await fetch(api, { headers: { accept: 'application/vnd.github+json' } })

  if (res.status === 404) {
    errors.push(
      `${api} returns 404 to an unauthenticated request. GitHub answers 404 (not 403) for a private ` +
        `repository, so either ${slug} is private or the slug is wrong. Until it is public, ` +
        `\`/plugin marketplace add ${slug}\` fails for every user, the README's clone URL fails, ` +
        `and the LICENSE/CONTRIBUTING/SECURITY policies describe a project nobody can reach.`
    )
  } else if (!res.ok) {
    errors.push(`${api} returned HTTP ${res.status} — cannot verify the published install path`)
  } else {
    const repo = (await res.json()) as { private?: boolean; default_branch?: string; has_discussions?: boolean }
    if (repo.private) errors.push(`${slug} is marked private — every documented install command fails for users`)
    notes.push(`${slug} is public (default branch: ${repo.default_branch})`)

    // The issue-template config links Discussions; with the tab disabled that
    // link is a 404 for the first person who tries to ask a question.
    const configPath = '.github/ISSUE_TEMPLATE/config.yml'
    if (existsSync(join(ROOT, configPath)) && read(configPath).includes('/discussions')) {
      if (repo.has_discussions === false) {
        errors.push(
          `${configPath} links to GitHub Discussions but the Discussions tab is disabled on ${slug} — ` +
            `enable it in repository settings or drop the link`
        )
      } else {
        notes.push('Discussions is enabled and the issue-template link resolves')
      }
    }

    // What `/plugin marketplace add` actually fetches.
    const branch = repo.default_branch ?? 'main'
    const rawUrl = `https://raw.githubusercontent.com/${slug}/${branch}/.claude-plugin/marketplace.json`
    const rawRes = await fetch(rawUrl)
    if (!rawRes.ok) {
      errors.push(`${rawUrl} returned HTTP ${rawRes.status} — the marketplace manifest is not reachable at the published path`)
    } else {
      const published = JSON.parse(await rawRes.text()) as { name?: string; plugins?: { name?: string; version?: string }[] }
      const local = JSON.parse(read('.claude-plugin/marketplace.json')) as { name?: string }
      if (published.name !== local.name) {
        errors.push(`published marketplace name "${published.name}" != local "${local.name}" — push the manifest`)
      }
      const publishedVersion = published.plugins?.[0]?.version
      if (publishedVersion && publishedVersion !== pkg.version) {
        errors.push(
          `the published marketplace advertises version ${publishedVersion} but package.json is ${pkg.version} — ` +
            `users would install an older build than this tree`
        )
      }
      notes.push(`marketplace manifest reachable at the published path (version ${publishedVersion ?? 'unset'})`)
    }
  }

  if (errors.length > 0) {
    console.error(`\n✗ ${errors.length} release-readiness issue(s):\n`)
    for (const e of errors) console.error(`  ✗ ${e}`)
    console.error('')
    process.exit(1)
  }
  for (const n of notes) console.log(`✓ ${n}.`)
  console.log(`✓ \`/plugin marketplace add ${slug}\` resolves for an anonymous user.`)
}

main().catch(err => {
  console.error(`✗ release check failed to run: ${(err as Error).message}`)
  process.exit(1)
})
