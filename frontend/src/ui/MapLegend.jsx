/**
 * HydroPulse MapLegend Component
 * API: MapLegend({items})
 */

export function MapLegend({ items }) {
  return (
    <div className="map-legend">
      {items.map((item) => (
        <div key={item.key} className="map-legend__item">
          <span className={`map-legend__swatch map-legend__swatch--${item.swatch}`} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
