/**
 * HydroPulse DataTable Component
 * API: DataTable({columns, rows, rowKey, onRowClick, caption})
 */

export function DataTable({ columns, rows, rowKey = 'id', onRowClick, caption }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} style={{ textAlign: col.align || 'left' }}>
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row[rowKey]}
            onClick={() => onRowClick?.(row)}
            className={onRowClick ? 'data-table__row--clickable' : ''}
          >
            {columns.map((col) => (
              <td
                key={col.key}
                className={
                  col.align === 'right'
                    ? 'data-table__cell--numeric'
                    : col.render
                    ? 'data-table__cell--mono'
                    : ''
                }
                style={{ textAlign: col.align || 'left' }}
              >
                {col.render ? col.render(row[col.key], row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {caption && <caption className="data-table__caption">{caption}</caption>}
    </table>
  );
}
