#!/usr/bin/env node
/**
 * build-detect-db.mjs
 *
 * Builds a combined BLAST detection database from the tseemann/mlst
 * pubmlst scheme allele files. Used by mlstx to auto-detect MLST scheme.
 *
 * Strategy: take first N alleles per locus per scheme, encode scheme name
 * in FASTA header: >scheme~~~locus~~~alleleId
 *
 * Usage:
 *   UPLOAD_TOKEN=<token> node scripts/build-detect-db.mjs [--alleles 5]
 *
 * Requires:
 *   UPLOAD_TOKEN env var (Cloudflare R2 write token)
 *   tseemann/mlst repo cloned or available at MLST_DB_DIR env var
 *     Default: /tmp/tseemann-mlst/db/pubmlst
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { gzipSync } from 'zlib'

const UPLOAD_TOKEN = process.env.UPLOAD_TOKEN
if (!UPLOAD_TOKEN) { console.error('Set UPLOAD_TOKEN'); process.exit(1) }

const MLST_DB_DIR = process.env.MLST_DB_DIR || '/tmp/tseemann-mlst/db/pubmlst'
const MAX_ALLELES = parseInt(process.argv.find(a => a.startsWith('--alleles='))?.split('=')[1] ?? '5')
const ACCOUNT_ID = '3bd272de7abb5a9f328fbfa9afafd2a3'
const WASM_BASE = 'https://static.genomicx.org/wasm'
const TMP = '/tmp/mlstx-detect-build'

mkdirSync(TMP, { recursive: true })

// ── Ensure tseemann/mlst is cloned ────────────────────────────────────────────

if (!existsSync(MLST_DB_DIR)) {
  console.log('Cloning tseemann/mlst...')
  execSync('git clone --depth 1 https://github.com/tseemann/mlst /tmp/tseemann-mlst', { stdio: 'inherit' })
}

// ── Build combined FASTA ──────────────────────────────────────────────────────

const schemes = readdirSync(MLST_DB_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)

console.log(`Found ${schemes.length} schemes`)

let totalSeqs = 0
const fastaLines = []
const schemesInfo = []

for (const scheme of schemes) {
  const schemeDir = join(MLST_DB_DIR, scheme)
  const tfaFiles = readdirSync(schemeDir).filter(f => f.endsWith('.tfa'))
  if (tfaFiles.length === 0) continue

  const loci = []
  for (const tfa of tfaFiles) {
    const locus = tfa.replace('.tfa', '')
    loci.push(locus)
    const text = readFileSync(join(schemeDir, tfa), 'utf8')
    let count = 0
    let inSeq = false
    let curId = ''
    let curSeq = ''

    for (const line of text.split('\n')) {
      if (line.startsWith('>')) {
        if (inSeq && count <= MAX_ALLELES) {
          fastaLines.push(`>${ scheme }~~~${ locus }~~~${ curId }`)
          fastaLines.push(curSeq)
          totalSeqs++
        }
        if (count >= MAX_ALLELES) break
        curId = line.slice(1).trim()
        curSeq = ''
        inSeq = true
        count++
      } else if (inSeq) {
        curSeq += line.trim()
      }
    }
    // flush last
    if (inSeq && count <= MAX_ALLELES) {
      fastaLines.push(`>${scheme}~~~${locus}~~~${curId}`)
      fastaLines.push(curSeq)
      totalSeqs++
    }
  }

  schemesInfo.push({ scheme, loci })
}

console.log(`Total sequences: ${totalSeqs} across ${schemesInfo.length} schemes`)

const fastaText = fastaLines.join('\n') + '\n'
writeFileSync(join(TMP, 'detect.fa'), fastaText)
console.log(`FASTA size: ${(fastaText.length / 1024 / 1024).toFixed(1)} MB`)

// ── Load and run formatdb.wasm ────────────────────────────────────────────────

async function fetchBuf(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`)
  return Buffer.from(await r.arrayBuffer())
}

async function fetchText(url) {
  return (await fetchBuf(url)).toString('utf8')
}

console.log('Loading formatdb.wasm...')
const [jsText, wasmBuf] = await Promise.all([
  fetchText(`${WASM_BASE}/formatdb.js`),
  fetchBuf(`${WASM_BASE}/formatdb.wasm`),
])
const factory = new Function('Module', jsText + '; return Module;')({})

const stdout = [], stderr = []
const mod = await factory({
  wasmBinary: wasmBuf.buffer.slice(wasmBuf.byteOffset, wasmBuf.byteOffset + wasmBuf.byteLength),
  print: t => stdout.push(t),
  printErr: t => stderr.push(t),
  noInitialRun: true,
})

mod.FS.writeFile('/detect.fa', fastaText)
try { mod.FS.mkdir('/db') } catch {}
const args = ['-i', '/detect.fa', '-n', '/db/detect', '-p', 'F', '-o', 'T']
console.log(`$ formatdb ${args.join(' ')}`)
try { mod.callMain(args) } catch {}

const errs = stderr.join('')
if (errs.includes('ERROR') || errs.includes('FATAL')) {
  throw new Error(`formatdb failed: ${errs}`)
}

const nhr = Buffer.from(mod.FS.readFile('/db/detect.nhr'))
const nin = Buffer.from(mod.FS.readFile('/db/detect.nin'))
const nsq = Buffer.from(mod.FS.readFile('/db/detect.nsq'))
console.log(`BLAST db: nhr=${nhr.length} nin=${nin.length} nsq=${nsq.length} bytes`)

// ── Build tar.gz ──────────────────────────────────────────────────────────────

function addTarFile(name, data, blocks) {
  const nameBytes = Buffer.alloc(100); nameBytes.write(name)
  const sizeOctal = data.length.toString(8).padStart(11, '0')
  const header = Buffer.alloc(512)
  nameBytes.copy(header, 0)
  header.write('0000755\0', 100)
  header.write('0000000\0', 108)
  header.write('0000000\0', 116)
  header.write(sizeOctal + '\0', 124)
  header.write(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0', 136)
  header.write('0', 156)
  header.write('ustar  \0', 257)
  header.write('        ', 148)
  let ck = 0; for (let i = 0; i < 512; i++) ck += header[i]
  header.write(ck.toString(8).padStart(6, '0') + '\0\0', 148)
  blocks.push(header, data)
  const pad = (512 - (data.length % 512)) % 512
  if (pad) blocks.push(Buffer.alloc(pad))
}

const blocks = []
addTarFile('detect.nhr', nhr, blocks)
addTarFile('detect.nin', nin, blocks)
addTarFile('detect.nsq', nsq, blocks)
blocks.push(Buffer.alloc(1024))
const tarGz = gzipSync(Buffer.concat(blocks))
console.log(`tar.gz size: ${(tarGz.length / 1024 / 1024).toFixed(1)} MB`)

// ── Build schemes index ───────────────────────────────────────────────────────

const schemesJson = JSON.stringify(
  schemesInfo.reduce((acc, { scheme, loci }) => { acc[scheme] = loci; return acc }, {}),
  null, 2
)

// ── Upload to R2 ──────────────────────────────────────────────────────────────

async function upload(path, data, ct) {
  console.log(`Uploading → ${path} (${(data.length / 1024).toFixed(0)} KB)`)
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/static/objects/${path}`,
    { method: 'PUT', headers: { Authorization: `Bearer ${UPLOAD_TOKEN}`, 'Content-Type': ct }, body: data }
  )
  if (!r.ok) throw new Error(`Upload failed (${r.status}): ${await r.text()}`)
  console.log(`✓ ${path}`)
}

await upload('db/mlstx/detect.tar.gz', tarGz, 'application/gzip')
await upload('db/mlstx/schemes.json', Buffer.from(schemesJson), 'application/json')

console.log('\n✓ Detection database built and uploaded.')
console.log(`  ${schemesInfo.length} schemes, ${totalSeqs} sequences`)
console.log('  static.genomicx.org/db/mlstx/detect.tar.gz')
console.log('  static.genomicx.org/db/mlstx/schemes.json')
