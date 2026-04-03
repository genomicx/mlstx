import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResultsTable } from './ResultsTable'
import type { MLSTResult } from '../mlst/types'

const loci = ['aroC', 'dnaN', 'hemD']

function makeResult(overrides: Partial<MLSTResult> & Pick<MLSTResult, 'filename' | 'st' | 'alleles'>): MLSTResult {
  return {
    scheme: 'salmonella',
    status: 'PERFECT',
    score: 100,
    locusResults: [],
    ...overrides,
  }
}

const results: MLSTResult[] = [
  makeResult({
    filename: 'genome1.fasta',
    st: '152',
    alleles: { aroC: '1', dnaN: '2', hemD: '3' },
    status: 'PERFECT',
    score: 100,
  }),
  makeResult({
    filename: 'genome2.fasta',
    st: '~',
    alleles: { aroC: '1', dnaN: '~3', hemD: '3' },
    status: 'NOVEL',
    score: 98,
  }),
  makeResult({
    filename: 'genome3.fasta',
    st: '-',
    alleles: { aroC: '1', dnaN: '-', hemD: '3' },
    status: 'MISSING',
    score: 50,
  }),
]

describe('ResultsTable', () => {
  it('renders nothing when results are empty', () => {
    const { container } = render(<ResultsTable results={[]} loci={loci} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders table headers including Status and Score', () => {
    render(<ResultsTable results={results} loci={loci} />)
    expect(screen.getByText('File')).toBeInTheDocument()
    expect(screen.getByText('ST')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Score')).toBeInTheDocument()
    expect(screen.getByText('aroC')).toBeInTheDocument()
    expect(screen.getByText('dnaN')).toBeInTheDocument()
    expect(screen.getByText('hemD')).toBeInTheDocument()
  })

  it('renders filenames, ST, status and score values', () => {
    render(<ResultsTable results={results} loci={loci} />)
    expect(screen.getByText('genome1.fasta')).toBeInTheDocument()
    expect(screen.getByText('152')).toBeInTheDocument()
    expect(screen.getByText('PERFECT')).toBeInTheDocument()
    expect(screen.getByText('NOVEL')).toBeInTheDocument()
    expect(screen.getByText('MISSING')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('uses success variant for exact ST match', () => {
    render(<ResultsTable results={[results[0]]} loci={loci} />)
    const badge = screen.getByText('152')
    expect(badge.className).toContain('gx-badge--success')
  })

  it('uses warning variant for novel ST (~)', () => {
    render(<ResultsTable results={[results[1]]} loci={loci} />)
    const stBadge = screen.getAllByText('~')[0]
    expect(stBadge.className).toContain('gx-badge--warning')
  })

  it('uses muted variant for no hit (-)', () => {
    render(<ResultsTable results={[results[2]]} loci={loci} />)
    const badges = screen.getAllByText('-')
    expect(badges[0].className).toContain('gx-badge--muted')
  })

  it('uses success variant for PERFECT status badge', () => {
    render(<ResultsTable results={[results[0]]} loci={loci} />)
    const badge = screen.getByText('PERFECT')
    expect(badge.className).toContain('gx-badge--success')
  })

  it('uses warning variant for NOVEL status badge', () => {
    render(<ResultsTable results={[results[1]]} loci={loci} />)
    const badge = screen.getByText('NOVEL')
    expect(badge.className).toContain('gx-badge--warning')
  })

  it('uses error variant for MISSING status badge', () => {
    render(<ResultsTable results={[results[2]]} loci={loci} />)
    const badge = screen.getByText('MISSING')
    expect(badge.className).toContain('gx-badge--error')
  })

  it('adds title attributes for accessibility', () => {
    render(<ResultsTable results={[results[0]]} loci={loci} />)
    const badge = screen.getByText('152')
    const td = badge.closest('td')!
    expect(td).toHaveAttribute('title', 'Exact match: 152')
  })

  it('shows dash for missing alleles', () => {
    const partial = [makeResult({
      filename: 'test.fasta',
      st: 'incomplete',
      alleles: { aroC: '1' },
    })]
    render(<ResultsTable results={partial} loci={loci} />)
    const dashes = screen.getAllByText('-')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })

  it('calls onRemove when × button clicked', () => {
    const onRemove = vi.fn()
    render(<ResultsTable results={[results[0]]} loci={loci} onRemove={onRemove} />)
    fireEvent.click(screen.getByTitle('Remove genome1.fasta'))
    expect(onRemove).toHaveBeenCalledWith('genome1.fasta')
  })

  it('does not render remove column when onRemove not provided', () => {
    render(<ResultsTable results={[results[0]]} loci={loci} />)
    expect(screen.queryByTitle('Remove genome1.fasta')).toBeNull()
  })
})
