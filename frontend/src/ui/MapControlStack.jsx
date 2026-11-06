/**
 * HydroPulse MapControlStack Component
 * API: MapControlStack({children})
 */

export function MapControlStack({ children }) {
  return (
    <div
      className="map-control-stack"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
