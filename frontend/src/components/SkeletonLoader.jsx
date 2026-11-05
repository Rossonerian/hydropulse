import { memo } from 'react';

/**
 * SkeletonLoader (Section 17 of HydroPulse Interaction Plan)
 * Provides stable placeholder structures during initial load or background refresh.
 *
 * Rules:
 * - Uses #1C2541 surface, #3A506B placeholder blocks, subtle #5BC0DE shimmer
 * - Matches final component geometry to prevent layout shift
 * - Never fabricates fake metrics, IDs, or timestamps
 * - Honors prefers-reduced-motion (disables shimmer animation)
 * - Accessible with aria-busy="true"
 */
function SkeletonLoader({
  variant = 'row', // 'row' | 'card' | 'inspector' | 'summary' | 'map-veil'
  count = 1,
  className = '',
}) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (variant === 'map-veil') {
    return (
      <div className='skeleton-map-veil' role='status' aria-busy='true' aria-label='Loading network geometry…'>
        <div className='map-veil-spinner' />
        <span>SYNCHRONIZING KENGERI TOPOLOGY…</span>
      </div>
    );
  }

  if (variant === 'inspector') {
    return (
      <div className={`skeleton-inspector-pane ${className}`} role='status' aria-busy='true' aria-label='Loading component details…'>
        <div className='skeleton-block skeleton-title' style={{ width: '60%', height: '16px' }} />
        <div className='skeleton-block skeleton-line' style={{ width: '90%', height: '12px' }} />
        <div className='skeleton-block skeleton-line' style={{ width: '75%', height: '12px' }} />
        <div className='skeleton-grid' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
          <div className='skeleton-block' style={{ height: '36px' }} />
          <div className='skeleton-block' style={{ height: '36px' }} />
          <div className='skeleton-block' style={{ height: '36px' }} />
          <div className='skeleton-block' style={{ height: '36px' }} />
        </div>
      </div>
    );
  }

  if (variant === 'summary') {
    return (
      <div className={`skeleton-summary-list ${className}`} role='status' aria-busy='true' aria-label='Loading summary…'>
        {items.map((i) => (
          <div key={i} className='skeleton-summary-row'>
            <div className='skeleton-block' style={{ width: '45%', height: '11px' }} />
            <div className='skeleton-block' style={{ width: '30%', height: '11px' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`skeleton-container ${className}`} role='status' aria-busy='true' aria-label='Loading…'>
      {items.map((i) => (
        <div key={i} className='skeleton-block' style={{ width: '100%', height: '14px', marginBottom: '6px' }} />
      ))}
    </div>
  );
}

export default memo(SkeletonLoader);
