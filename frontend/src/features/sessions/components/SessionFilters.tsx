/**
 * Filter sidebar for the session catalog.
 */
import { useState } from 'react'

interface Filters {
  price_min?: number
  price_max?: number
  search?: string
}

interface SessionFiltersProps {
  onFilterChange: (filters: Filters) => void
}

export function SessionFilters({ onFilterChange }: SessionFiltersProps) {
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [search, setSearch] = useState('')

  function apply() {
    onFilterChange({
      price_min: priceMin ? Number(priceMin) : undefined,
      price_max: priceMax ? Number(priceMax) : undefined,
      search: search || undefined,
    })
  }

  function reset() {
    setPriceMin('')
    setPriceMax('')
    setSearch('')
    onFilterChange({})
  }

  return (
    <aside className="space-y-5">
      <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
        Filters
      </h2>

      {/* Search */}
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="search">
          Search
        </label>
        <input
          id="search"
          type="text"
          placeholder="Title or description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Price range */}
      <div className="space-y-1">
        <span className="text-sm font-medium">Price Range ($)</span>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            value={priceMin}
            min={0}
            onChange={(e) => setPriceMin(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="number"
            placeholder="Max"
            value={priceMax}
            min={0}
            onChange={(e) => setPriceMax(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={apply}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Apply
        </button>
        <button
          onClick={reset}
          className="w-full rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          Reset
        </button>
      </div>
    </aside>
  )
}
