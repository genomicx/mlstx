import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { About } from '../pages/About'

function renderAbout() {
  return render(<MemoryRouter><About /></MemoryRouter>)
}

describe('AboutPage', () => {
  it('renders about mlstx section', () => {
    renderAbout()
    expect(screen.getByText('About MLSTX')).toBeInTheDocument()
  })

  it('renders author name', () => {
    renderAbout()
    expect(screen.getByText('Nabil-Fareed Alikhan')).toBeInTheDocument()
  })

  it('renders author role', () => {
    renderAbout()
    expect(
      screen.getByText(/Senior Bioinformatician, Centre for Genomic Pathogen Surveillance/),
    ).toBeInTheDocument()
  })

  it('renders contact links', () => {
    renderAbout()
    expect(screen.getByText('happykhan.com')).toBeInTheDocument()
    expect(screen.getByText('nabil@happykhan.com')).toBeInTheDocument()
    expect(screen.getByText(/ORCID/)).toBeInTheDocument()
  })

  it('renders privacy statement', () => {
    renderAbout()
    expect(
      screen.getByText(/No data leaves your machine/),
    ).toBeInTheDocument()
  })

  it('has external links with noopener', () => {
    renderAbout()
    const externalLinks = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('target') === '_blank')
    for (const link of externalLinks) {
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    }
  })
})
