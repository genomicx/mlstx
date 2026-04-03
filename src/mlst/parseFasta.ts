import { parseSequenceFile as gxParseSequenceFile, parseGenbankString as gxParseGenbankString } from '@genomicx/ui'
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

/** Re-export for tests that import from here */
export { gxParseGenbankString as parseGenbankString }

/**
 * Read a File object as a FASTA or GenBank (optionally gzipped) and return parsed contigs.
 * Delegates to @genomicx/ui parseSequenceFile for format detection and gz decompression.
 */
export async function parseFastaFile(file: File): Promise<ParsedFasta> {
  const contigs = await gxParseSequenceFile(file)
  const displayName = file.name.replace(/\.gz$/, '')
  return { filename: displayName, contigs }
}
