// Writes every brand output from src/tokens.ts and the masters in svg/, where the apps read them:
//
//   pnpm --filter @renewvan/brand generate           write what changed
//   pnpm --filter @renewvan/brand generate --check   write nothing; fail if anything is stale
//
// Text (CSS, TypeScript, favicon.svg, the colours in the manifests) must match byte for byte.
// Images match by their pixels within `CHANNEL_TOLERANCE`: resvg's antialiasing may differ by a
// step between CPUs, so an icon rendered on a Mac is not rewritten on Linux (or the reverse) unless
// it really changed. Runs on Node's type stripping (Node 22.18+), no TypeScript runner needed.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildOutputs, type Output } from './outputs.ts'
import { decodeIco, decodePng, samePixels } from './lib/png.ts'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const check = process.argv.includes('--check')

function upToDate(output: Output, committed: Buffer): boolean {
  if (output.kind === 'text') return committed.equals(output.data)
  try {
    if (output.kind === 'png') return samePixels(decodePng(committed), decodePng(output.data))
    const fresh = decodeIco(output.data)
    const old = decodeIco(committed)
    return old.length === fresh.length && old.every((image, i) => samePixels(image, fresh[i]))
  } catch {
    return false
  }
}

const stale: string[] = []
for (const output of buildOutputs(repoRoot)) {
  const file = join(repoRoot, output.path)
  if (existsSync(file) && upToDate(output, readFileSync(file))) continue
  stale.push(output.path)
  if (!check) writeFileSync(file, output.data)
}

if (check && stale.length) {
  console.error(
    `Brand outputs out of date (run \`pnpm --filter @renewvan/brand generate\`):\n  ${stale.join('\n  ')}`,
  )
  process.exit(1)
}
console.log(stale.length ? `Wrote:\n  ${stale.join('\n  ')}` : 'Brand outputs up to date.')
