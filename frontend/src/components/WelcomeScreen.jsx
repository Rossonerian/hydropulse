import { useEffect, useRef } from 'react';
import { Droplets, MousePointerClick, Activity, MapPin } from 'lucide-react';
import { Button } from '../ui/index.js';
import '../styles/ops/welcome.css';

const STEPS = [
  { icon: MousePointerClick, title: 'Pick a leak', text: 'Choose a ready-made burst or any junction.' },
  { icon: Activity, title: 'Watch 5 sensors react', text: 'Pressure drops at the sentinel junctions.' },
  { icon: MapPin, title: 'Get the location + valves to close', text: 'See the likely spot, the loss and the isolation plan.' },
];

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
          Find a burst pipe from just 5 pressure sensors
        </h1>
        <p className="welcome__lead">
          HydroPulse detects a pipe burst, pinpoints where it is, and estimates the loss in L/min and tankers per day.
        </p>

        <div className="welcome__cta">
          <Button variant="primary" size="lg" onClick={() => onChoose('demo')}>
            Explore the demo
          </Button>
          <Button variant="secondary" size="lg" onClick={() => onChoose('import')}>
            Use your own data
          </Button>
        </div>

        <section className="welcome__how" aria-labelledby="welcome-how-title">
          <h2 id="welcome-how-title" className="welcome__how-title">
            How it works
          </h2>
          <ol className="welcome__steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="welcome__step">
                <span className="welcome__step-num" aria-hidden="true">
                  {i + 1}
                </span>
                <s.icon size={20} className="welcome__step-icon" aria-hidden="true" />
                <h3 className="welcome__step-title">{s.title}</h3>
                <p className="welcome__step-text">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <p className="welcome__note">
          The demo uses a synthetic Kengeri network. The match score is a pattern-match score, not certainty.
          Using your own data needs the live backend and an admin token.
        </p>
      </div>
    </main>
  );
}
