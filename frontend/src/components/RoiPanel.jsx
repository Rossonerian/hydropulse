import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Calculator, Droplet, IndianRupee, Truck } from 'lucide-react';
import { Modal, Button } from '../ui/index.js';
import { compactINR, number } from '../lib/format.js';
import '../styles/ops/charts_roi.css';

export default function RoiPanel({ open, onClose, lastResult }) {
  const initialLeaks = 20;
  const initialLpm = lastResult?.actual_loss_lpm || 482.1;
  const initialDays = 12;
  const initialCost = 45;

  const [leaks, setLeaks] = useState(initialLeaks);
  const [lpm, setLpm] = useState(initialLpm);
  const [days, setDays] = useState(initialDays);
  const [cost, setCost] = useState(initialCost);

  useEffect(() => {
    if (lastResult?.actual_loss_lpm != null) setLpm(lastResult.actual_loss_lpm);
  }, [lastResult?.actual_loss_lpm]);

  const validateInput = (value, min) => Math.max(Number.isFinite(value) ? value : min, min);

  const handleReset = () => {
    setLeaks(initialLeaks);
    setLpm(initialLpm);
    setDays(initialDays);
    setCost(initialCost);
  };

  // Annual volume is leak count × 12 months × daily loss × recovery days.
  const litres = useMemo(() => leaks * 12 * lpm * 1440 * days, [leaks, lpm, days]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title='Water saved. Value recovered.'
      footer={
        <div className='roi-foot'>
          <span>Model based on leak volume × 12 months × recovery days.</span>
          <Button variant='secondary' onClick={handleReset}>Reset</Button>
          <Button variant='primary' onClick={onClose}>
            Done <ArrowUpRight size={14} />
          </Button>
        </div>
      }
    >
      <div className='roi-mark'>
        <Calculator size={18} />
      </div>
      <p className='roi-intro'>
        Estimate the annual benefit of faster leak localization across this district.
      </p>
      <div className='roi-fields'>
        <label>
          Leaks detected / month
          <input
            type='number'
            min='1'
            value={leaks}
            onChange={(e) => setLeaks(validateInput(+e.target.value, 1))}
          />
        </label>
        <label>
          Average water loss <small>L/min</small>
          <input
            type='number'
            min='0'
            value={lpm}
            onChange={(e) => setLpm(validateInput(+e.target.value, 0))}
          />
        </label>
        <label>
          Days saved per leak
          <input
            type='number'
            min='1'
            value={days}
            onChange={(e) => setDays(validateInput(+e.target.value, 1))}
          />
        </label>
        <label>
          Production cost <small>₹ / kL · editable assumption</small>
          <input
            type='number'
            min='0'
            value={cost}
            onChange={(e) => setCost(validateInput(+e.target.value, 0))}
          />
        </label>
      </div>
      <div className='roi-results'>
        <div className='roi-result'>
          <span>
            <Droplet size={14} /> Water recovered per year
          </span>
          <b>
            {number(litres / 1e6, 2)} <small>ML</small>
          </b>
          <small>{number(litres, 0)} litres</small>
        </div>
        <div className='roi-result'>
          <span>
            <Truck size={14} /> Tankers saved per year
          </span>
          <b>
            {number(litres / 6000, 0)} <small>trips</small>
          </b>
          <small>6,000 L capacity</small>
        </div>
        <div className='roi-result emphasis'>
          <span>
            <IndianRupee size={14} /> Production value per year
          </span>
          <b>{compactINR((litres / 1000) * cost)}</b>
          <small>at ₹{number(cost)} per kL</small>
        </div>
      </div>
    </Modal>
  );
}
