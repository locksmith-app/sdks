/**
 * Writes static/openapi.json for Docusaurus.
 *
 * - Monorepo: if ../../frontend/package.json exists (from apps/docs), runs `npm run export-openapi` there.
 * - Standalone docs repo: fetches from OPENAPI_URL (default https://getlocksmith.dev/api/openapi).
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const staticDir = join(root, 'static')
const outFile = join(staticDir, 'openapi.json')
const monorepoFrontendDir = join(root, '..', '..', 'frontend')
const monorepoFrontendPkg = join(monorepoFrontendDir, 'package.json')

function runMonorepoExport() {
  execSync('npm run export-openapi', {
    cwd: monorepoFrontendDir,
    stdio: 'inherit',
    shell: true,
  })
}

async function fetchSpec() {
  const url =
    process.env.OPENAPI_URL ?? 'https://getlocksmith.dev/api/openapi'
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`OpenAPI fetch failed (${res.status}): ${url}`)
  }
  const text = await res.text()
  writeFileSync(outFile, text)
  console.log('Wrote', outFile, 'from', url)
}

async function main() {
  mkdirSync(staticDir, { recursive: true })
  if (existsSync(monorepoFrontendPkg)) {
    runMonorepoExport()
    return
  }
  await fetchSpec()
}

await main()
