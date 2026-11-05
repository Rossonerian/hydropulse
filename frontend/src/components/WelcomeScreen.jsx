import { useEffect, useRef } from 'react';
import { Droplets, PlayCircle, FileUp } from 'lucide-react';
import { Button } from '../ui/index.js';
import '../styles/ops/welcome.css';

export default function WelcomeScreen({ onChoose }) {
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="welcome" aria-labelledby="welcome-title">
      <div className="welcome__inner">
        <div className="welcome__brand">
          <span className="welcome__mark" aria-hidden="true">
            <Droplets size={20} />
          </span>
          <span className="welcome__brand-name">HydroPulse</span>
        </div>
        <h1 id="welcome-title" className="welcome__title" ref={headingRef} tabIndex={-1}>
          Find water leaks from a few pressure sensors
        </h1>
        <p className="welcome__lead">Choose how you want to start. You can switch at any time from the Data source button.</p>

        <div className="welcome__cards">
          <section className="welcome__card" aria-labelledby="welcome-demo-title">
            <PlayCircle size={28} className="welcome__card-icon" aria-hidden="true" />
            <h2 id="welcome-demo-title" className="welcome__card-title">Explore the demo</h2>
            <p className="welcome__card-text">
              Kengeri synthetic network with 3 ready-made leak presets. No setup needed.
            </p>
            <p className="welcome__note">
              The network is synthetic, and the match score is a pattern-match score, not certainty.
            </p>
            <Button variant="primary" size="lg" onClick={() => onChoose('demo')}>
              Explore the demo
            </Button>
          </section>

          <section className="welcome__card" aria-labelledby="welcome-import-title">
            <FileUp size={28} className="welcome__card-icon" aria-hidden="true" />
            <h2 id="welcome-import-title" className="welcome__card-title">Use your own data</h2>
            <p className="welcome__card-text">
              Bring an EPANET .inp or GeoJSON file. It is validated first, then activated only when you confirm.
            </p>
            <p className="welcome__note">Activating needs the live backend and an admin token.</p>
            <Button variant="secondary" size="lg" onClick={() => onChoose('import')}>
              Use your own data
            </Button>
          </section>
        </div>
      </div>
    </main>
  );
}
