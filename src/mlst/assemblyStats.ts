import type { ParsedFasta } from './types'

export interface AssemblyStats {
  filename: string
  totalLength: number
  contigCount: number
  n50: number
  gcPercent: number
  nsPer100k: number
}

export function computeStats(fasta: ParsedFasta): AssemblyStats {
  const sequences = fasta.contigs.map((c) => c.sequence)
  const lengths = sequences.map((s) => s.length).sort((a, b) => b - a)
  const totalLength = lengths.reduce((s, l) => s + l, 0)

  // N50
  let cumulative = 0
  let n50 = 0
  for (const len of lengths) {
    cumulative += len
    if (cumulative >= totalLength * 0.5) {
      n50 = len
      break
    }
  }

  // GC and N counts
  let gcCount = 0
  let nCount = 0
  for (const seq of sequences) {
    for (const ch of seq) {
      const c = ch.toUpperCase()
      if (c === 'G' || c === 'C') gcCount++
      else if (c === 'N') nCount++
    }
  }

  const gcPercent = totalLength > 0 ? (gcCount / totalLength) * 100 : 0
  const nsPer100k = totalLength > 0 ? (nCount / totalLength) * 100000 : 0

  return {
    filename: fasta.filename,
    totalLength,
    contigCount: lengths.length,
    n50,
    gcPercent,
    nsPer100k,
  }
}
