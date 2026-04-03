/** A single contig from a parsed FASTA file */
export interface Contig {
  name: string
  sequence: string
}

/** A parsed FASTA file with its contigs */
export interface ParsedFasta {
  filename: string
  contigs: Contig[]
}

/** Alignment hit from LASTZ output */
export interface AlignmentHit {
  queryName: string
  targetName: string
  identity: number
  alignmentLength: number
  queryStart: number
  queryEnd: number
  targetStart: number
  targetEnd: number
  targetLength: number
  strand?: '+' | '-'
}

/** Best hit result for a single locus */
export interface LocusResult {
  locus: string
  allele: string   // allele number, "~N" (novel), or "-" (no hit)
  identity: number // 0–1
  coverage: number // 0–1
  bestHit: AlignmentHit | null
}

export type MLSTStatus = 'PERFECT' | 'NOVEL' | 'NONE' | 'MISSING' | 'MIXED' | 'BAD' | 'OK'

/** MLST result for a single input file */
export interface MLSTResult {
  filename: string
  scheme: string
  st: string
  alleles: Record<string, string>
  status: MLSTStatus
  score: number  // 0–100
  locusResults: LocusResult[]
}

/** User-configurable MLST thresholds */
export interface MLSTOptions {
  minid: number    // min DNA identity % (default 95)
  mincov: number   // min coverage % (default 10)
  minscore: number // min score to report (default 50)
}

/** An MLST scheme definition */
export interface MLSTScheme {
  name: string
  loci: string[]
}

/** Profile entry mapping allele combination to ST */
export interface STProfile {
  st: string
  alleles: Record<string, string>
}

/** Scheme data stored in public/db/<scheme>/ */
export interface SchemeData {
  scheme: MLSTScheme
  profiles: STProfile[]
  /** Map from locus name to FASTA content (all alleles for that locus) */
  alleleFastas: Record<string, string>
}

