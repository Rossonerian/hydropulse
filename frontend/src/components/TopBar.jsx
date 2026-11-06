import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  Droplets,
  CircleHelp,
  Calculator,
  Sun,
  Moon,
  Database,
  Ellipsis,
  PlayCircle,
  Upload,
  Activity,
  PencilRuler,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import { DataSourceBadge } from '../ui/DataSourceBadge.jsx';
import { useTheme } from '../ui/useTheme.js';
import '../styles/ops/import.css';
import '../styles/ops/topbar.css';

function Item({ icon: Icon, children, onClick, current, className = '' }) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className={`topbar-menu__item ${className}`.trim()}
      aria-current={current ? 'page' : undefined}
      onClick={onClick}
    >
      {Icon && <Icon size={18} aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}

/**
 * Top bar: brand, nav (Operations | Network editor), status dot, ONE "..." menu.
 * The menu holds Data, ROI calculator, Keyboard shortcuts, Replay tour and Theme.
 * Props are unchanged from before; onReplayTour is optional and new.
 */
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
  onReplayTour,
  onAiAdvisor,
  onOpenBenchmark,
}) {
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const menuId = useId();

  const items = () =>
    Array.from(listRef.current?.querySelectorAll('[role="menuitem"]') || []).filter(
      (el) => el.offsetParent !== null,
    );

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (open) items()[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!listRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const onListKey = (e) => {
    const list = items();
    const i = list.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  const onBtnKey = (e) => {
    if (e.key === 'ArrowDown' && !open) {
      e.preventDefault();
      setOpen(true);
    }
  };

  // Run an action, then close the menu. Focus goes back to the button unless the
  // action opens its own dialog (which manages focus itself).
  const act = (fn, returnFocus = false) => () => {
    setOpen(false);
    if (returnFocus) btnRef.current?.focus();
    fn?.();
  };

  const handleNavClick = (targetView) => onViewChange?.(targetView);

  return (
    <header className="topbar" style={{ height: '52px' }}>
      <div className="topbar-brand">
        <div className="brand-mark" aria-hidden="true">
          <Droplets size={16} />
        </div>
        <div className="brand-text">
          <span className="brand-title">DHARA</span>
          <span className="brand-subtitle">Smart Water Leakage & Consumption Tracker · Kengeri DMA</span>
        </div>
      </div>

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
          Network editor
        </button>
      </nav>

      <div className="topbar-right">
        <div className="topbar-status">
          <span className="topbar-counts" title="5 sentinel monitoring junctions on Kengeri DMA">
            5 sentinels · {network?.nodes?.length || 130} nodes
          </span>
          <DataSourceBadge
            mode={mode}
            networkSource={networkSource}
            health={health}
            network={network}
            compact={false}
          />
          {customData && (
            <span className="topbar-custom">
              Custom data
              <button type="button" className="topbar-custom__reset" onClick={onResetCustom}>
                Reset to demo
              </button>
            </span>
          )}
        </div>

        {onAiAdvisor && (
          <button
            type="button"
            className="topbar-ai-btn"
            onClick={onAiAdvisor}
            title="Open DHARA AI Hydraulic Advisor"
          >
            <Sparkles size={14} />
            <span>AI Advisor</span>
          </button>
        )}

        <div className="topbar-menu">
          <button
            ref={btnRef}
            type="button"
            className="topbar-menu__btn"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            aria-label="More options"
            title="More options"
            onClick={() => setOpen((o) => !o)}
            onKeyDown={onBtnKey}
          >
            <Ellipsis size={20} aria-hidden="true" />
          </button>
          {open && (
            <div
              id={menuId}
              ref={listRef}
              role="menu"
              aria-label="More options"
              className="topbar-menu__list"
              onKeyDown={onListKey}
            >
              <div className="topbar-menu__mobile-only topbar-menu__group" role="presentation">
                View
              </div>
              <Item
                icon={Activity}
                current={view === 'operations'}
                className="topbar-menu__mobile-only"
                onClick={act(() => handleNavClick('operations'))}
              >
                Operations
              </Item>
              <Item
                icon={PencilRuler}
                current={view === 'studio'}
                className="topbar-menu__mobile-only"
                onClick={act(() => handleNavClick('studio'))}
              >
                Network editor
              </Item>
              <div className="topbar-menu__sep topbar-menu__mobile-only" role="separator" />

              <div className="topbar-menu__group" role="presentation">
                Data & Analytics
              </div>
              <Item icon={Database} onClick={act(onDataSource)}>
                Use the demo
              </Item>
              <Item icon={Upload} onClick={act(onResetCustom)}>
                Import network data (EPANET / GeoJSON)
              </Item>
              {onOpenBenchmark && (
                <Item icon={BarChart3} onClick={act(onOpenBenchmark)}>
                  Accuracy & Benchmark report
                </Item>
              )}
              {customData && (
                <Item
                  icon={Database}
                  className="topbar-menu__mobile-only"
                  onClick={act(onDataSource)}
                >
                  Custom data is on. Switch back to demo
                </Item>
              )}
              <div className="topbar-menu__sep" role="separator" />
              <Item icon={Calculator} onClick={act(onRoi)}>
                ROI calculator
              </Item>
              <Item icon={CircleHelp} onClick={act(onHelp)}>
                Keyboard shortcuts
              </Item>
              {onReplayTour && (
                <Item icon={PlayCircle} onClick={act(onReplayTour)}>
                  Replay tour
                </Item>
              )}
              <Item
                icon={theme === 'night' ? Sun : Moon}
                onClick={act(toggleTheme, true)}
              >
                {theme === 'night' ? 'Switch to day theme' : 'Switch to night theme'}
              </Item>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
