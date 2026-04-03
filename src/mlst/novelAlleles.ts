import type { MLSTResult, ParsedFasta } from './types'

function reverseComplement(seq: string): string {
  const comp: Record<string, string> = {
    A: 'T', T: 'A', G: 'C', C: 'G',
    N: 'N', R: 'Y', Y: 'R', S: 'S',
    W: 'W', K: 'M', M: 'K', B: 'V',
    V: 'B', D: 'H', H: 'D',
  }
  return seq.split('').reverse().map((b) => comp[b] ?? 'N').join('')
}

/**
 * Build a FASTA string of novel allele sequences (alleles with ~N notation).
 * Extracts the genome sequence at the BLAST hit coordinates.
 *
 * Header: >filename__locus__closestAllele__id{pct}__cov{pct}
 */
export function buildNovelFasta(
  results: MLSTResult[],
  parsedFastas: Record<string, ParsedFasta>,
): string {
  const lines: string[] = []

  for (const r of results) {
    const pf = parsedFastas[r.filename]
    if (!pf) continue
    const contigMap = Object.fromEntries(pf.contigs.map((c) => [c.name, c.sequence]))

    for (const lr of r.locusResults) {
      if (!lr.allele.startsWith('~')) continue
      const hit = lr.bestHit
      if (!hit) continue
      const contig = contigMap[hit.queryName]
      if (!contig) continue

      let seq = contig.slice(hit.queryStart, hit.queryEnd)
      if (hit.strand === '-') seq = reverseComplement(seq)
      if (!seq) continue

      const pctId = (lr.identity * 100).toFixed(2)
      const pctCov = (lr.coverage * 100).toFixed(2)
      lines.push(`>${r.filename}__${lr.locus}__${lr.allele}__id${pctId}__cov${pctCov}`)
      for (let i = 0; i < seq.length; i += 60) lines.push(seq.slice(i, i + 60))
    }
  }

  return lines.join('\n')
}

export function hasNovelAlleles(results: MLSTResult[]): boolean {
  return results.some((r) => r.locusResults.some((lr) => lr.allele.startsWith('~')))
}
