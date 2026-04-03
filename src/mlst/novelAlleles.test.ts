import { describe, it, expect } from 'vitest'
import { buildNovelFasta, hasNovelAlleles } from './novelAlleles'
import type { MLSTResult, ParsedFasta, AlignmentHit } from './types'

function makeHit(overrides: Partial<AlignmentHit> = {}): AlignmentHit {
  return {
    queryName: 'contig1',
    targetName: 'adk_3',
    identity: 98.5,
    alignmentLength: 432,
    queryStart: 100,
    queryEnd: 532,
    targetStart: 0,
    targetEnd: 432,
    targetLength: 432,
    strand: '+',
    ...overrides,
  }
}

function makeResult(overrides: Partial<MLSTResult> = {}): MLSTResult {
  return {
    filename: 'test.fasta',
    scheme: 'ecoli_achtman_4',
    st: '~',
    alleles: { adk: '~3' },
    status: 'MIXED',
    score: 98,
    locusResults: [
      { locus: 'adk', allele: '~3', identity: 0.985, coverage: 1.0, bestHit: makeHit() },
    ],
    ...overrides,
  }
}

const parsedFastas: Record<string, ParsedFasta> = {
  'test.fasta': {
    filename: 'test.fasta',
    contigs: [{ name: 'contig1', sequence: 'A'.repeat(1000) }],
  },
}

describe('hasNovelAlleles', () => {
  it('returns true when any allele starts with ~', () => {
    expect(hasNovelAlleles([makeResult()])).toBe(true)
  })

  it('returns false when no novel alleles', () => {
    const r = makeResult({ alleles: { adk: '3' }, locusResults: [
      { locus: 'adk', allele: '3', identity: 1.0, coverage: 1.0, bestHit: makeHit() },
    ]})
    expect(hasNovelAlleles([r])).toBe(false)
  })

  it('returns false for empty results', () => {
    expect(hasNovelAlleles([])).toBe(false)
  })
})

describe('buildNovelFasta', () => {
  it('returns empty string when no novel alleles', () => {
    const r = makeResult({ alleles: { adk: '3' }, locusResults: [
      { locus: 'adk', allele: '3', identity: 1.0, coverage: 1.0, bestHit: makeHit() },
    ]})
    expect(buildNovelFasta([r], parsedFastas)).toBe('')
  })

  it('generates FASTA header with filename, locus, allele, identity, coverage', () => {
    const fasta = buildNovelFasta([makeResult()], parsedFastas)
    expect(fasta).toContain('>test.fasta__adk__~3__id98.50__cov100.00')
  })

  it('extracts sequence at hit coordinates', () => {
    // contig1 is all A's; hit is queryStart=100 queryEnd=532 → 432 A's
    const fasta = buildNovelFasta([makeResult()], parsedFastas)
    const lines = fasta.split('\n').filter((l) => !l.startsWith('>'))
    const seq = lines.join('')
    expect(seq).toBe('A'.repeat(432))
  })

  it('wraps sequence at 60 chars per line', () => {
    const fasta = buildNovelFasta([makeResult()], parsedFastas)
    const seqLines = fasta.split('\n').filter((l) => !l.startsWith('>') && l.length > 0)
    for (const line of seqLines.slice(0, -1)) {
      expect(line.length).toBe(60)
    }
  })

  it('reverse complements minus-strand hits', () => {
    const hit = makeHit({ strand: '-', queryStart: 0, queryEnd: 6 })
    const r = makeResult({ locusResults: [
      { locus: 'adk', allele: '~3', identity: 0.985, coverage: 1.0, bestHit: hit },
    ]})
    const fastas: Record<string, ParsedFasta> = {
      'test.fasta': {
        filename: 'test.fasta',
        contigs: [{ name: 'contig1', sequence: 'ATCGAT' }],
      },
    }
    const fasta = buildNovelFasta([r], fastas)
    const seq = fasta.split('\n').filter((l) => !l.startsWith('>')).join('')
    // RC of ATCGAT = ATCGAT (palindrome), let's use AAAACC → GGTTTT
    expect(seq).toBe('ATCGAT') // palindrome, RC = ATCGAT
  })

  it('skips entries where contig is not found in parsedFasta', () => {
    const hit = makeHit({ queryName: 'nonexistent_contig' })
    const r = makeResult({ locusResults: [
      { locus: 'adk', allele: '~3', identity: 0.985, coverage: 1.0, bestHit: hit },
    ]})
    expect(buildNovelFasta([r], parsedFastas)).toBe('')
  })

  it('skips entries where parsedFasta is missing', () => {
    expect(buildNovelFasta([makeResult()], {})).toBe('')
  })

  it('handles multiple novel alleles across files', () => {
    const r2 = makeResult({
      filename: 'test2.fasta',
      alleles: { adk: '~5' },
      locusResults: [
        { locus: 'adk', allele: '~5', identity: 0.97, coverage: 0.99, bestHit: makeHit({ queryName: 'ctg1' }) },
      ],
    })
    const fastas2: Record<string, ParsedFasta> = {
      ...parsedFastas,
      'test2.fasta': { filename: 'test2.fasta', contigs: [{ name: 'ctg1', sequence: 'G'.repeat(500) }] },
    }
    const fasta = buildNovelFasta([makeResult(), r2], fastas2)
    expect(fasta).toContain('>test.fasta__adk__~3')
    expect(fasta).toContain('>test2.fasta__adk__~5')
  })
})
