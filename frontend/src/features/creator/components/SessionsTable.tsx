/**
 * Creator sessions table with @tanstack/react-table — sortable columns.
 */
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import { useState } from 'react'
import type { CreatorSession } from '@/lib/schemas'

interface SessionsTableProps {
  sessions: CreatorSession[]
  onEdit: (session: CreatorSession) => void
  onDelete: (id: number) => void
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-green-100 text-green-700',
  cancelled: 'bg-destructive/10 text-destructive',
  completed: 'bg-blue-100 text-blue-700',
}

const columnHelper = createColumnHelper<CreatorSession>()

export function SessionsTable({ sessions, onEdit, onDelete }: SessionsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = [
    columnHelper.accessor('title', {
      header: 'Title',
      cell: (info) => (
        <span className="font-medium text-foreground">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => {
        const s = info.getValue()
        return (
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[s] ?? 'bg-muted'}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </span>
        )
      },
    }),
    columnHelper.accessor('price', {
      header: 'Price',
      cell: (info) => `$${info.getValue()}`,
    }),
    columnHelper.accessor('scheduled_at', {
      header: 'Date',
      cell: (info) => format(new Date(info.getValue()), 'dd MMM yyyy · h:mm a'),
    }),
    columnHelper.accessor('booking_count', {
      header: 'Bookings',
      cell: (info) => {
        const count = info.getValue()
        const capacity = info.row.original.capacity
        return `${count} / ${capacity}`
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => (
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(info.row.original)}
            className="text-xs text-primary hover:underline"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(info.row.original.id)}
            className="text-xs text-destructive hover:underline"
          >
            Delete
          </button>
        </div>
      ),
    }),
  ]

  const table = useReactTable({
    data: sessions,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-left font-medium text-muted-foreground cursor-pointer select-none"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <span className="flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' && ' ↑'}
                    {header.column.getIsSorted() === 'desc' && ' ↓'}
                  </span>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-t border-border hover:bg-muted/30 transition-colors">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
