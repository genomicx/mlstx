import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SchemeSelector } from './SchemeSelector'

describe('SchemeSelector', () => {
  it('renders scheme options', () => {
    render(
      <SchemeSelector
        schemes={['salmonella', 'ecoli']}
        selected=""
        onSelect={() => {}}
        disabled={false}
        loading={false}
      />,
    )
    expect(screen.getByText('salmonella')).toBeInTheDocument()
    expect(screen.getByText('ecoli')).toBeInTheDocument()
  })

  it('shows loading text when loading', () => {
    render(
      <SchemeSelector
        schemes={[]}
        selected=""
        onSelect={() => {}}
        disabled={false}
        loading={true}
      />,
    )
    expect(screen.getByText('Loading schemes...')).toBeInTheDocument()
  })

  it('shows default placeholder when not loading', () => {
    render(
      <SchemeSelector
        schemes={['salmonella']}
        selected=""
        onSelect={() => {}}
        disabled={false}
        loading={false}
      />,
    )
    expect(screen.getByText('Auto-detect (per file)')).toBeInTheDocument()
  })

  it('calls onSelect when value changes', () => {
    const onSelect = vi.fn()
    render(
      <SchemeSelector
        schemes={['salmonella', 'ecoli']}
        selected=""
        onSelect={onSelect}
        disabled={false}
        loading={false}
      />,
    )
    fireEvent.change(screen.getByLabelText('MLST Scheme:'), {
      target: { value: 'salmonella' },
    })
    expect(onSelect).toHaveBeenCalledWith('salmonella')
  })

  it('disables select when disabled prop is true', () => {
    render(
      <SchemeSelector
        schemes={['salmonella']}
        selected=""
        onSelect={() => {}}
        disabled={true}
        loading={false}
      />,
    )
    expect(screen.getByLabelText('MLST Scheme:')).toBeDisabled()
  })
})
