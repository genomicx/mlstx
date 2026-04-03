/**
 * autoDetect.ts
 *
 * Detects the most likely MLST scheme for a set of FASTA files by
 * mapping them against a combined allele database using minimap2.
 *
 * The detect database (detect.fa.gz) is pre-built from tseemann/mlst
 * pubmlst data (5 alleles per locus per scheme, 162 schemes).
 * Headers are encoded as: >scheme~~~locus~~~alleleId
 */

// Aioli is loaded globally via CDN script tag in index.html
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Aioli: any

const DETECT_DB_URL = 'https://static.genomicx.org/db/mlstx/detect.fa.gz'

/**
 * Schemes excluded from auto-detection (mirrors tseemann/mlst $EXCLUDE).
 * These are alias/ambiguous schemes — users can still select them manually.
 * ecoli → ecoli_achtman_4 (preferred), abaumannii → abaumannii_2 (preferred), etc.
 */
const AUTODETECT_EXCLUDE = new Set([
  'ecoli',
  'abaumannii',
  'vcholerae_2',
  'senterica_achtman_2',
])

let cachedDetectFasta: string | null = null

async function loadDetectFasta(): Promise<string> {
  if (cachedDetectFasta) return cachedDetectFasta

  const res = await fetch(DETECT_DB_URL)
  if (!res.ok) throw new Error(`Failed to fetch detect database: ${res.status}`)

  // Decompress gzip using DecompressionStream (available in modern browsers + Node 18+)
  const compressed = await res.arrayBuffer()
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  const reader = ds.readable.getReader()

  writer.write(new Uint8Array(compressed))
  writer.close()

  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }

  const totalLen = chunks.reduce((n, c) => n + c.length, 0)
  const merged = new Uint8Array(totalLen)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }

  cachedDetectFasta = new TextDecoder().decode(merged)
  return cachedDetectFasta
}

export interface DetectResult {
  scheme: string
  hits: number
  lociHit: Set<string>
}

/**
 * Detect the most likely MLST scheme for the given FASTA content.
 * Returns schemes sorted by number of allele hits (descending).
 */
export async function detectScheme(
  fastaContent: string,
  onProgress?: (msg: string) => void,
): Promise<DetectResult[]> {
  onProgress?.('Loading detection database...')
  const detectFasta = await loadDetectFasta()

  onProgress?.('Initialising minimap2...')
  const cli = await new Aioli(['minimap2/2.22'])

  await cli.mount({ name: 'detect.fasta', data: detectFasta })
  await cli.mount({ name: 'query.fasta', data: fastaContent })

  onProgress?.('Mapping against scheme database...')
  const paf: string = await cli.exec('minimap2 -c detect.fasta query.fasta')

  // Count hits per scheme and per locus
  const schemeCounts = new Map<string, DetectResult>()

  for (const line of paf.split('\n')) {
    if (!line.trim()) continue
    // PAF: qname qlen qstart qend strand tname tlen tstart tend nmatch alen mapq
    const parts = line.split('\t')
    if (parts.length < 12) continue

    const targetName = parts[5] // e.g. "ecoli~~~dinB~~~dinB_1"
    const [scheme, locus] = targetName.split('~~~')
    if (!scheme || !locus) continue

    const nmatch = parseInt(parts[9])
    const alen = parseInt(parts[10])
    if (alen === 0 || nmatch / alen < 0.8) continue // require 80% identity

    if (!schemeCounts.has(scheme)) {
      schemeCounts.set(scheme, { scheme, hits: 0, lociHit: new Set() })
    }
    const entry = schemeCounts.get(scheme)!
    entry.hits++
    entry.lociHit.add(locus)
  }

  // Sort by number of distinct loci hit (primary), then total hits (secondary)
  const sorted = Array.from(schemeCounts.values())
    .filter((r) => !AUTODETECT_EXCLUDE.has(r.scheme))
    .sort((a, b) => {
      const lociDiff = b.lociHit.size - a.lociHit.size
      if (lociDiff !== 0) return lociDiff
      return b.hits - a.hits
    })

  return sorted
}
