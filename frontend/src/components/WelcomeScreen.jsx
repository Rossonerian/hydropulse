import { useEffect, useRef } from 'react';
import { Droplets, MousePointerClick, Activity, MapPin } from 'lucide-react';
import { Button } from '../ui/index.js';
import '../styles/ops/welcome.css';

const STEPS = [
  { icon: MousePointerClick, title: 'Pick a problem', text: 'Choose a ready-made leak, or any spot on the map.' },
  { icon: Activity, title: 'Run the test', text: 'See 5 sensors notice the pressure drop.' },
  { icon: MapPin, title: 'Get the answer', text: 'Where the leak is, how much water is lost, and which valves to shut.' },
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
          HydroPulse finds where a pipe has burst, estimates how much water is lost, and tells you which valves to shut. You see it all in DHARA, the HydroPulse dashboard and its built-in AI.
        </p>

        <div className="welcome__cta">
          <div className="welcome__choice">
            <Button variant="primary" size="lg" onClick={() => onChoose('demo')}>
              Explore the demo
            </Button>
            <p className="welcome__hint">Uses a sample network of Kengeri. Nothing to set up.</p>
          </div>
          <div className="welcome__choice">
            <Button variant="secondary" size="lg" onClick={() => onChoose('import')}>
              Use your own data
            </Button>
            <p className="welcome__hint">
              Needs the live server and an admin token. The &ldquo;how well it fits&rdquo; figure shows how closely
              the sensor pattern matches a spot. It is not a guarantee.
            </p>
          </div>
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

      </div>
    </main>
  );
}
