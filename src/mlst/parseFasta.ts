import type { Contig, ParsedFasta } from './types'

/**
 * Parse a FASTA-formatted string into contigs.
 */
export function parseFastaString(text: string): Contig[] {
  const contigs: Contig[] = []
  let currentName = ''
  let currentSeq: string[] = []

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('>')) {
      if (currentName) {
        contigs.push({ name: currentName, sequence: currentSeq.join('') })
      }
      currentName = trimmed.slice(1).split(/\s+/)[0]
      currentSeq = []
    } else if (trimmed && currentName) {
      currentSeq.push(trimmed.toUpperCase())
    }
  }

  if (currentName) {
    contigs.push({ name: currentName, sequence: currentSeq.join('') })
  }

  return contigs
}

/**
 * Parse a GenBank flat-file (single or multi-record) into contigs.
 * Mirrors the approach used in BRIGx: split on LOCUS lines,
 * extract sequence from ORIGIN section.
 */
export function parseGenbankString(text: string): Contig[] {
  const contigs: Contig[] = []
  // Split into records on LOCUS boundaries (multi-record files)
  const records = text.split(/^LOCUS/m).filter((r) => r.trim().length > 0)
  for (let record of records) {
    if (!record.startsWith('LOCUS')) record = 'LOCUS' + record
    const locusMatch = record.match(/^LOCUS\s+(\S+)/m)
    const name = locusMatch ? locusMatch[1] : `record_${contigs.length + 1}`
    const originMatch = record.match(/ORIGIN([\s\S]*?)(\/\/|$)/)
    if (!originMatch) continue
    const sequence = originMatch[1].replace(/[^a-zA-Z]/g, '').toUpperCase()
    if (sequence.length > 0) {
      contigs.push({ name, sequence })
    }
  }
  return contigs
}

function isGenbank(name: string): boolean {
  return /\.(gb|gbk|genbank)(\.gz)?$/.test(name)
}

/**
 * Read a File object as a FASTA or GenBank (optionally gzipped) and return parsed contigs.
 */
export async function parseFastaFile(file: File): Promise<ParsedFasta> {
  let text: string
  if (file.name.endsWith('.gz')) {
    const ds = new DecompressionStream('gzip')
    const decompressed = file.stream().pipeThrough(ds)
    text = await new Response(decompressed).text()
  } else {
    text = await file.text()
  }
  const contigs = isGenbank(file.name) ? parseGenbankString(text) : parseFastaString(text)
  // Strip .gz from filename for display
  const displayName = file.name.replace(/\.gz$/, '')
  return { filename: displayName, contigs }
}
