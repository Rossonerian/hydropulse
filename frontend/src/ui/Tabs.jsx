/**
 * HydroPulse Tabs Component
 * API: Tabs({tabs, value, onChange})
 */

import { useEffect, useRef } from 'react';

export function Tabs({ tabs, value, onChange }) {
  const tabRefs = useRef([]);

  useEffect(() => {
    const currentIndex = tabs.findIndex((t) => t.id === value);
    tabRefs.current[currentIndex]?.focus();
  }, [value, tabs]);

  const handleKeyDown = (e, index) => {
    let newIndex = index;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      newIndex = (index + 1) % tabs.length;
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      newIndex = (index - 1 + tabs.length) % tabs.length;
      e.preventDefault();
    } else if (e.key === 'Home') {
      newIndex = 0;
      e.preventDefault();
    } else if (e.key === 'End') {
      newIndex = tabs.length - 1;
      e.preventDefault();
    }

    if (newIndex !== index) {
      onChange?.(tabs[newIndex].id);
      tabRefs.current[newIndex]?.focus();
    }
  };

  return (
    <div className="tabs">
      <div className="tabs__list" role="tablist">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => (tabRefs.current[index] = el)}
            className="tabs__tab"
            role="tab"
            aria-selected={value === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => onChange?.(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`panel-${tab.id}`}
          className="tabs__panel"
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          hidden={value !== tab.id}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
