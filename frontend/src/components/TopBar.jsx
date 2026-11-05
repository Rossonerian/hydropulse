import { useState } from 'react';
import {
  Droplets,
  CircleHelp,
  Calculator,
  Sun,
  Moon,
  Menu,
  X,
  Database,
} from 'lucide-react';
import { DataSourceBadge } from '../ui/DataSourceBadge.jsx';
import { useTheme } from '../ui/useTheme.js';
import '../styles/ops/import.css';

export default function TopBar({
  view = 'operations',
  onViewChange,
  mode = 'mock',
  networkSource = 'recorded',
  health,
  network,
  onHelp,
  onRoi,
  customData = false,
  onDataSource,
  onResetCustom,
}) {
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const numJunctions =
    health?.num_junctions ??
    network?.nodes?.filter((n) => !n.type || n.type === 'junction')?.length ??
    80;
  const numPipes = health?.num_pipes ?? network?.pipes?.length ?? 143;
  const numSensors =
    health?.sensor_ids?.length ??
    network?.sensors?.length ??
    5;

  const handleNavClick = (targetView) => {
    onViewChange?.(targetView);
    setMobileMenuOpen(false);
  };

  return (
    <header className="topbar" style={{ height: '52px' }}>
      {/* Brand */}
      <div className="topbar-brand">
        <div className="brand-mark" aria-hidden="true">
          <Droplets size={16} />
        </div>
        <div className="brand-text">
          <span className="brand-title">HydroPulse</span>
          <span className="brand-subtitle">Kengeri DMA</span>
        </div>
      </div>

      {/* Navigation (Desktop & Tablet) */}
      <nav className="topbar-nav" aria-label="Main navigation">
        <button
          type="button"
          className={`topbar-nav-btn ${view === 'operations' ? 'topbar-nav-btn--active' : ''}`}
          aria-current={view === 'operations' ? 'page' : undefined}
          onClick={() => handleNavClick('operations')}
        >
          Operations
        </button>
        <button
          type="button"
          className={`topbar-nav-btn ${view === 'studio' ? 'topbar-nav-btn--active' : ''}`}
          aria-current={view === 'studio' ? 'page' : undefined}
          onClick={() => handleNavClick('studio')}
        >
          Network Studio
        </button>
      </nav>

      {/* Data Source Badge (Desktop & Tablet) */}
      <div className="topbar-badge-wrap">
        <DataSourceBadge
          mode={mode}
          networkSource={networkSource}
          health={health}
          network={network}
        />
      </div>

      {/* Health Summary (Desktop & Tablet) */}
      <div className="topbar-health-summary" aria-label="Network health summary">
        <span className="health-stat">
          <b>{numJunctions}</b> junctions
        </span>
        <span className="health-sep" aria-hidden="true">·</span>
        <span className="health-stat">
          <b>{numPipes}</b> pipes
        </span>
        <span className="health-sep" aria-hidden="true">·</span>
        <span className="health-stat">
          <b>{String(numSensors).padStart(2, '0')}</b> sensors
        </span>
      </div>

      {/* Actions (Desktop & Tablet) */}
      <div className="topbar-actions">
        {customData && (
          <span className="topbar-custom">
            Custom data
            <button type="button" className="topbar-custom__reset" onClick={onResetCustom}>
              Reset to demo
            </button>
          </span>
        )}
        <button
          type="button"
          className="topbar-btn topbar-source-btn"
          onClick={onDataSource}
          title="Change data source"
        >
          <Database size={15} />
          <span>Data source</span>
        </button>
        <button
          type="button"
          className="topbar-btn"
          onClick={onHelp}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          <CircleHelp size={15} />
          <span>Help</span>
        </button>
        <button
          type="button"
          className="topbar-btn"
          onClick={onRoi}
          aria-label="Open ROI calculator"
          title="ROI Calculator"
        >
          <Calculator size={15} />
          <span>ROI</span>
        </button>
        <button
          type="button"
          className="topbar-btn topbar-btn--theme"
          onClick={toggleTheme}
          aria-label={`Toggle theme (current: ${theme})`}
          title={`Toggle theme (current: ${theme})`}
        >
          {theme === 'night' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>

      {/* Mobile Controls (<768px) */}
      <div className="topbar-mobile-controls">
        <DataSourceBadge
          mode={mode}
          networkSource={networkSource}
          health={health}
          network={network}
          compact
        />
        <button
          type="button"
          className="topbar-menu-btn"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div
          className="topbar-mobile-menu"
          role="dialog"
          aria-modal="false"
          aria-label="Mobile navigation and settings"
        >
          <nav className="mobile-menu-nav" aria-label="Mobile views">
            <button
              type="button"
              className={`mobile-menu-link ${view === 'operations' ? 'active' : ''}`}
              aria-current={view === 'operations' ? 'page' : undefined}
              onClick={() => handleNavClick('operations')}
            >
              Operations
            </button>
            <button
              type="button"
              className={`mobile-menu-link ${view === 'studio' ? 'active' : ''}`}
              aria-current={view === 'studio' ? 'page' : undefined}
              onClick={() => handleNavClick('studio')}
            >
              Network Studio
            </button>
          </nav>

          <div className="mobile-menu-health" aria-label="Network health summary">
            <span><b>{numJunctions}</b> junctions</span>
            <span aria-hidden="true">·</span>
            <span><b>{numPipes}</b> pipes</span>
            <span aria-hidden="true">·</span>
            <span><b>{String(numSensors).padStart(2, '0')}</b> sensors</span>
          </div>

          {customData && (
            <p className="topbar-custom" style={{ margin: 'var(--space-3) var(--space-4)' }}>
              Custom data
              <button
                type="button"
                className="topbar-custom__reset"
                onClick={() => {
                  onResetCustom?.();
                  setMobileMenuOpen(false);
                }}
              >
                Reset to demo
              </button>
            </p>
          )}

          <div className="mobile-menu-actions">
            <button
              type="button"
              className="mobile-action-btn"
              onClick={() => {
                onDataSource?.();
                setMobileMenuOpen(false);
              }}
            >
              <Database size={18} />
              <span>Data source</span>
            </button>
            <button
              type="button"
              className="mobile-action-btn"
              onClick={() => {
                onHelp?.();
                setMobileMenuOpen(false);
              }}
              aria-label="Keyboard shortcuts"
            >
              <CircleHelp size={18} />
              <span>Help</span>
            </button>
            <button
              type="button"
              className="mobile-action-btn"
              onClick={() => {
                onRoi?.();
                setMobileMenuOpen(false);
              }}
              aria-label="Open ROI calculator"
            >
              <Calculator size={18} />
              <span>ROI</span>
            </button>
            <button
              type="button"
              className="mobile-action-btn"
              onClick={() => {
                toggleTheme();
              }}
              aria-label={`Toggle theme (current: ${theme})`}
            >
              {theme === 'night' ? <Sun size={18} /> : <Moon size={18} />}
              <span>Theme</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
