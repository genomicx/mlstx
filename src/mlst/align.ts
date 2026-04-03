import type {
  ParsedFasta,
  SchemeData,
  MLSTResult,
  AlignmentHit,
  MLSTOptions,
} from './types'
import { parseFastaString } from './parseFasta'
import { callAllele, DEFAULT_MINID, DEFAULT_MINCOV } from './callAllele'
import { callST } from './callST'
import { loadWasmModule, createModuleInstance } from '@genomicx/ui'

type ProgressCallback = (message: string, pct: number) => void

/**
 * Merge all contigs into a single sequence (joined with 100 N's as spacers).
 */
function mergeContigsToFasta(
  filename: string,
  contigs: { name: string; sequence: string }[],
): string {
  const merged = contigs.map((c) => c.sequence).join('N'.repeat(100))
  return `>${filename}\n${merged}\n`
}

/**
 * Parse minimap2 PAF output into AlignmentHit format.
 * Kept for backward compatibility with existing tests.
 *
 * PAF columns (0-indexed):
 *   0: qName  1: qLen  2: qStart  3: qEnd  4: strand
 *   5: tName  6: tLen  7: tStart  8: tEnd
 *   9: nMatch  10: blockLen  11: mapQ
 *
 * Query = alleles, Target = genome (our convention).
 */
export function parsePAF(pafText: string): AlignmentHit[] {
  const hits: AlignmentHit[] = []
  const lines = pafText.trim().split('\n')

  for (const line of lines) {
    if (!line) continue
    const fields = line.split('\t')
    if (fields.length < 12) continue

    const qName = fields[0]
    const qLen = parseInt(fields[1], 10)
    const qStart = parseInt(fields[2], 10)
    const qEnd = parseInt(fields[3], 10)
    const tName = fields[5]
    const tStart = parseInt(fields[7], 10)
    const tEnd = parseInt(fields[8], 10)
    const nMatch = parseInt(fields[9], 10)
    const blockLen = parseInt(fields[10], 10)

    if (isNaN(nMatch) || isNaN(blockLen) || blockLen === 0) continue

    const identity = (nMatch / blockLen) * 100

    hits.push({
      targetName: qName,
      queryName: tName,
      identity,
      alignmentLength: qEnd - qStart,
      targetStart: qStart,
      targetEnd: qEnd,
      queryStart: tStart,
      queryEnd: tEnd,
      targetLength: qLen,
    })
  }

  return hits
}

/**
 * Parse BLAST tabular output (-m 8) into AlignmentHit format.
 *
 * BLAST tabular columns (0-indexed):
 *   0: qseqid  1: sseqid  2: pident  3: length
 *   4: mismatch  5: gapopen  6: qstart  7: qend
 *   8: sstart  9: send  10: evalue  11: bitscore
 *
 * Query = alleles (qseqid), Subject = genome contig (sseqid).
 * Positions are 1-based in BLAST output.
 */
export function parseBlast(blastText: string): AlignmentHit[] {
  const hits: AlignmentHit[] = []
  const lines = blastText.trim().split('\n')

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue
    const fields = line.split('\t')
    if (fields.length < 12) continue

    const qseqid = fields[0]   // allele name e.g. "adk_1"
    const sseqid = fields[1]   // genome contig name
    const pident = parseFloat(fields[2])  // percent identity
    const length = parseInt(fields[3], 10)  // alignment length
    const qstart = parseInt(fields[6], 10)  // 1-based
    const qend = parseInt(fields[7], 10)
    const sstart = parseInt(fields[8], 10)
    const send = parseInt(fields[9], 10)

    if (isNaN(pident) || isNaN(length) || length === 0) continue

    hits.push({
      targetName: qseqid,           // allele name
      queryName: sseqid,            // contig name
      identity: pident,             // already as percentage
      alignmentLength: qend - qstart + 1,
      targetStart: qstart - 1,      // convert to 0-based
      targetEnd: qend,
      queryStart: Math.min(sstart, send) - 1,
      queryEnd: Math.max(sstart, send),
      targetLength: 0,              // looked up from alleleLengths map
      strand: sstart <= send ? '+' : '-',
    })
  }

  return hits
}

/**
 * Format a genome FASTA as a BLAST nucleotide database using formatdb.
 * Returns the three database files as Uint8Arrays.
 */
async function formatGenomeDb(
  genomeFasta: string,
): Promise<{ nhr: Uint8Array; nin: Uint8Array; nsq: Uint8Array }> {
  const mod = await createModuleInstance('formatdb')
  mod.FS.writeFile('/genome.fasta', genomeFasta)
  mod.callMain(['-i', '/genome.fasta', '-p', 'F', '-n', '/genome'])
  return {
    nhr: mod.FS.readFile('/genome.nhr'),
    nin: mod.FS.readFile('/genome.nin'),
    nsq: mod.FS.readFile('/genome.nsq'),
  }
}

/**
 * Run blastn (via blastall) — alleles as query, genome DB as subject.
 * Uses parameters matching tseemann/mlst defaults:
 *   e-value: 1e-20, ungapped (-g F), no dust filter (-F F), word size 11
 */
async function runBlastn(
  allelesFasta: string,
  dbFiles: { nhr: Uint8Array; nin: Uint8Array; nsq: Uint8Array },
): Promise<string> {
  const mod = await createModuleInstance('blastall')
  mod.FS.writeFile('/db.nhr', dbFiles.nhr)
  mod.FS.writeFile('/db.nin', dbFiles.nin)
  mod.FS.writeFile('/db.nsq', dbFiles.nsq)
  mod.FS.writeFile('/alleles.fasta', allelesFasta)
  mod.callMain([
    '-p', 'blastn',
    '-i', '/alleles.fasta',
    '-d', '/db',
    '-e', '1E-20',
    '-v', '10000',
    '-b', '10000',
    '-m', '8',
    '-g', 'F',
    '-F', 'F',
    '-W', '11',
  ])
  return mod._stdout.join('\n')
}

/**
 * Run MLST analysis for a single FASTA file against a scheme using BLAST.
 */
async function analyzeFile(
  fasta: ParsedFasta,
  schemeData: SchemeData,
  allelesFasta: string,
  alleleLengths: Record<string, number>,
  onProgress: ProgressCallback,
  options: MLSTOptions,
): Promise<MLSTResult> {
  const loci = schemeData.scheme.loci

  onProgress(`${fasta.filename}: formatting genome database...`, 10)
  const genomeFasta = mergeContigsToFasta(fasta.filename, fasta.contigs)
  const dbFiles = await formatGenomeDb(genomeFasta)

  onProgress(`${fasta.filename}: aligning alleles...`, 30)
  const blastOutput = await runBlastn(allelesFasta, dbFiles)

  const allHits = parseBlast(blastOutput)

  const locusResults = loci.map((locus, li) => {
    onProgress(
      `${fasta.filename}: ${locus} (${li + 1}/${loci.length})`,
      30 + ((li + 1) / loci.length) * 70,
    )
    const locusPrefix = locus + '_'
    const locusHits = allHits.filter((h) => h.targetName.startsWith(locusPrefix))
    return callAllele(locus, locusHits, alleleLengths, options.minid, options.mincov)
  })

  onProgress(`${fasta.filename}: calling ST`, 100)
  return callST(
    fasta.filename,
    schemeData.scheme.name,
    locusResults,
    schemeData.profiles,
    options.minscore,
  )
}

/**
 * Main entry point: run MLST analysis on multiple files.
 * Uses BLAST (blastall + formatdb via WebAssembly) — same approach as tseemann/mlst.
 */
export async function runMLST(
  files: ParsedFasta[],
  schemeData: SchemeData,
  onProgress: ProgressCallback,
  options: MLSTOptions = { minid: DEFAULT_MINID, mincov: DEFAULT_MINCOV, minscore: 50 },
): Promise<MLSTResult[]> {
  onProgress('Loading BLAST...', 0)

  // Preload both WASM modules in parallel
  await Promise.all([
    loadWasmModule('blastall'),
    loadWasmModule('formatdb'),
  ])

  // Concatenate all allele FASTAs and build length map
  const alleleFastaChunks: string[] = []
  const alleleLengths: Record<string, number> = {}

  for (const locus of schemeData.scheme.loci) {
    const locusFasta = schemeData.alleleFastas[locus]
    if (!locusFasta) continue
    alleleFastaChunks.push(locusFasta)
    const contigs = parseFastaString(locusFasta)
    for (const c of contigs) {
      alleleLengths[c.name] = c.sequence.length
    }
  }

  const allelesFasta = alleleFastaChunks.join('\n')

  const results: MLSTResult[] = []

  for (let i = 0; i < files.length; i++) {
    const fasta = files[i]
    const fileProgress = (msg: string, pct: number) => {
      const overallPct = ((i + pct / 100) / files.length) * 100
      onProgress(msg, overallPct)
    }

    const result = await analyzeFile(
      fasta,
      schemeData,
      allelesFasta,
      alleleLengths,
      fileProgress,
      options,
    )
    results.push(result)
  }

  onProgress('Complete', 100)
  return results
}
