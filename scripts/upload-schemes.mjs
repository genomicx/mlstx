#!/usr/bin/env node
/**
 * upload-schemes.mjs
 *
 * Builds and uploads all 162 MLST scheme files to Cloudflare R2 (static bucket).
 *
 * What gets uploaded per scheme (at db/mlstx/<scheme>/):
 *   profiles.json   — [{st, alleles}]
 *   <locus>.fasta   — allele FASTA for each locus
 *
 * Loci come from schemes.json (built + uploaded by build-detect-db.mjs).
 * scheme.json is NOT uploaded — loadScheme.ts reads loci from schemes.json.
 *
 * Usage:
 *   node scripts/upload-schemes.mjs                  # all schemes
 *   node scripts/upload-schemes.mjs ecoli            # single scheme
 *   DRY_RUN=1 node scripts/upload-schemes.mjs        # preview only
 *
 * Env:
 *   MLST_DB_DIR   — path to tseemann/mlst db/pubmlst (default: /tmp/tseemann-mlst/db/pubmlst)
 *   DRY_RUN=1     — print paths without uploading
 *
 * Uses wrangler (must be authenticated: wrangler login).
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { execSync, exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const DRY_RUN = process.env.DRY_RUN === '1'
const MLST_DB_DIR = process.env.MLST_DB_DIR || '/tmp/tseemann-mlst/db/pubmlst'
const FILTER = process.argv[2]
const CONCURRENCY = 3
const TMP = '/tmp/mlstx-upload'

mkdirSync(TMP, { recursive: true })

// ── Clone repo if needed ──────────────────────────────────────────────────────

if (!existsSync(MLST_DB_DIR)) {
  console.log('Cloning tseemann/mlst...')
  execSync('git clone --depth 1 https://github.com/tseemann/mlst /tmp/tseemann-mlst', {
    stdio: 'inherit',
  })
}

// ── Parse profiles TSV ────────────────────────────────────────────────────────

function parseProfiles(profilePath, loci) {
  const text = readFileSync(profilePath, 'utf-8')
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const header = lines[0].split('\t')
  const lociIndices = {}
  for (const locus of loci) {
    const idx = header.indexOf(locus)
    if (idx >= 0) lociIndices[locus] = idx
  }

  const profiles = []
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split('\t')
    if (!fields[0]) continue
    const alleles = {}
    for (const locus of loci) {
      const idx = lociIndices[locus]
      alleles[locus] = idx !== undefined ? fields[idx] : ''
    }
    profiles.push({ st: fields[0], alleles })
  }
  return profiles
}

// ── Upload via wrangler ───────────────────────────────────────────────────────

let uploadCount = 0

async function upload(r2Path, localPath, contentType, retries = 3) {
  if (DRY_RUN) {
    console.log(`  [DRY] ${r2Path}`)
    uploadCount++
    return
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await execAsync(
        `wrangler r2 object put static/${r2Path} --file "${localPath}" --content-type "${contentType}" --remote`,
        { stdio: 'pipe' },
      )
      uploadCount++
      return
    } catch (err) {
      if (attempt === retries) throw err
      await new Promise((r) => setTimeout(r, attempt * 1000))
    }
  }
}

// ── Process schemes in parallel batches ──────────────────────────────────────

async function buildUploadTasks(schemeName) {
  const schemeDir = join(MLST_DB_DIR, schemeName)
  const files = readdirSync(schemeDir)

  const tfaFiles = files.filter((f) => f.endsWith('.tfa') || f.endsWith('.fasta'))
  const profileFile = files.find(
    (f) => f.endsWith('.tsv') || f === `${schemeName}.txt`,
  )

  if (tfaFiles.length === 0) return []

  const loci = tfaFiles.map((f) => f.replace(/\.(tfa|fasta)$/, ''))
  const tasks = []

  // Allele FASTA files — read from tfa, write as .fasta to tmp
  for (const tfa of tfaFiles) {
    const locus = tfa.replace(/\.(tfa|fasta)$/, '')
    const srcPath = join(schemeDir, tfa)
    const tmpPath = join(TMP, `${schemeName}_${locus}.fasta`)
    // Copy to tmp with .fasta extension (source may be .tfa)
    writeFileSync(tmpPath, readFileSync(srcPath))
    tasks.push({
      r2Path: `db/mlstx/${schemeName}/${locus}.fasta`,
      localPath: tmpPath,
      contentType: 'text/plain',
    })
  }

  // Profiles JSON
  const profiles = profileFile
    ? parseProfiles(join(schemeDir, profileFile), loci)
    : []
  const profilesTmpPath = join(TMP, `${schemeName}_profiles.json`)
  writeFileSync(profilesTmpPath, JSON.stringify(profiles))
  tasks.push({
    r2Path: `db/mlstx/${schemeName}/profiles.json`,
    localPath: profilesTmpPath,
    contentType: 'application/json',
  })

  return tasks
}

// ── Main ──────────────────────────────────────────────────────────────────────

const schemes = readdirSync(MLST_DB_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((n) => !FILTER || n === FILTER)
  .sort()

console.log(
  `Processing ${schemes.length} schemes${FILTER ? ` (filter: ${FILTER})` : ''}${DRY_RUN ? ' [DRY RUN]' : ''}`,
)

// Build all tasks first (generates tmp files)
console.log('Building task list...')
const allTasks = []
for (const scheme of schemes) {
  const tasks = await buildUploadTasks(scheme)
  if (tasks.length === 0) {
    console.log(`  Skipping ${scheme}: no allele files`)
    continue
  }
  allTasks.push(...tasks)
  process.stdout.write(`  Queued ${scheme} (${tasks.length} files)\r`)
}

console.log(`\nUploading ${allTasks.length} files (${CONCURRENCY} concurrent)...`)

const startTime = Date.now()
let done = 0

for (let i = 0; i < allTasks.length; i += CONCURRENCY) {
  const batch = allTasks.slice(i, i + CONCURRENCY)
  await Promise.all(
    batch.map(({ r2Path, localPath, contentType }) =>
      upload(r2Path, localPath, contentType),
    ),
  )
  done += batch.length
  const pct = ((done / allTasks.length) * 100).toFixed(1)
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
  process.stdout.write(`  ${pct}% (${done}/${allTasks.length}) ${elapsed}s\r`)
}

console.log(`\nDone. ${uploadCount} files uploaded in ${((Date.now() - startTime) / 1000).toFixed(0)}s`)
if (!DRY_RUN) {
  console.log('CDN: https://static.genomicx.org/db/mlstx/<scheme>/profiles.json')
}
