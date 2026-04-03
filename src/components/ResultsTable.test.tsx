import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultsTable } from './ResultsTable'
import type { MLSTResult } from '../mlst/types'

const loci = ['aroC', 'dnaN', 'hemD']

const results: MLSTResult[] = [
  {
    filename: 'genome1.fasta',
    scheme: 'salmonella',
    st: '152',
    alleles: { aroC: '1', dnaN: '2', hemD: '3' },
  },
  {
    filename: 'genome2.fasta',
    scheme: 'salmonella',
    st: 'novel',
    alleles: { aroC: '1', dnaN: 'novel', hemD: '3' },
  },
  {
    filename: 'genome3.fasta',
    scheme: 'salmonella',
    st: 'incomplete',
    alleles: { aroC: '1', dnaN: 'no_hit', hemD: '3' },
  },
]

describe('ResultsTable', () => {
  it('renders nothing when results are empty', () => {
    const { container } = render(<ResultsTable results={[]} loci={loci} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders table headers for loci', () => {
    render(<ResultsTable results={results} loci={loci} />)
    expect(screen.getByText('File')).toBeInTheDocument()
    expect(screen.getByText('ST')).toBeInTheDocument()
    expect(screen.getByText('aroC')).toBeInTheDocument()
    expect(screen.getByText('dnaN')).toBeInTheDocument()
    expect(screen.getByText('hemD')).toBeInTheDocument()
  })

  it('renders filenames and ST values', () => {
    render(<ResultsTable results={results} loci={loci} />)
    expect(screen.getByText('genome1.fasta')).toBeInTheDocument()
    expect(screen.getByText('152')).toBeInTheDocument()
    expect(screen.getAllByText('novel').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('incomplete')).toBeInTheDocument()
  })

  it('uses success variant for exact match', () => {
    render(<ResultsTable results={[results[0]]} loci={loci} />)
    const badge = screen.getByText('152')
    expect(badge.className).toContain('gx-badge--success')
  })

  it('uses warning variant for novel', () => {
    render(<ResultsTable results={[results[1]]} loci={loci} />)
    const novelCells = screen.getAllByText('novel')
    expect(novelCells[0].className).toContain('gx-badge--warning')
  })

  it('uses muted variant for incomplete/no_hit', () => {
    render(<ResultsTable results={[results[2]]} loci={loci} />)
    const badge = screen.getByText('incomplete')
    expect(badge.className).toContain('gx-badge--muted')
  })

  it('adds title attributes for accessibility', () => {
    render(<ResultsTable results={[results[0]]} loci={loci} />)
    const badge = screen.getByText('152')
    const td = badge.closest('td')!
    expect(td).toHaveAttribute('title', 'Exact match: 152')
  })

  it('shows dash for missing alleles', () => {
    const partial: MLSTResult[] = [
      {
        filename: 'test.fasta',
        scheme: 'salmonella',
        st: 'incomplete',
        alleles: { aroC: '1' },
      },
    ]
    render(<ResultsTable results={partial} loci={loci} />)
    const dashes = screen.getAllByText('-')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })
})
