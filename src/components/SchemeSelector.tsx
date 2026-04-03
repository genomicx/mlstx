interface SchemeSelectorProps {
  schemes: string[]
  selected: string
  onSelect: (scheme: string) => void
  disabled: boolean
  loading: boolean
  label?: string
}

export function SchemeSelector({
  schemes,
  selected,
  onSelect,
  disabled,
  loading,
  label = 'MLST Scheme:',
}: SchemeSelectorProps) {
  return (
    <div className="scheme-selector">
      <label htmlFor="scheme-select">{label}</label>
      <select
        id="scheme-select"
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        disabled={disabled || loading}
      >
        <option value="">
          {loading ? 'Loading schemes...' : 'Auto-detect (per file)'}
        </option>
        {schemes.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  )
}
