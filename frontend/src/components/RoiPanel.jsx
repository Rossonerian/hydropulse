import { useMemo, useState } from 'react';
import { ArrowUpRight, Calculator, Droplet, IndianRupee, Truck } from 'lucide-react';
import { Modal, Button } from '../ui/index.js';
import '../styles/ops/charts_roi.css';

// One number style for this whole panel: Indian digit grouping (en-IN), formatted here only.
const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const fmt = (v) => nf.format(Math.round(Number(v) || 0));
const rupees = (v) => `₹${fmt(v)}`;
const TANKER_L = 6000;

export default function RoiPanel({ open, onClose, lastResult }) {
  // Conservative, editable starting points (assumptions, not measurements).
  const initialLeaks = 4;
  const initialLpm = 300;
  const initialDays = 3;
  const initialCost = 45;

  const [leaks, setLeaks] = useState(initialLeaks);
  const [lpm, setLpm] = useState(initialLpm);
  const [days, setDays] = useState(initialDays);
  const [cost, setCost] = useState(initialCost);

  const lastLpm = Number(lastResult?.actual_loss_lpm);
  const hasLast = Number.isFinite(lastLpm) && lastLpm > 0;

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
      title='Estimate the water you could save'
      footer={
        <div className='roi-foot'>
          <span>Illustrative estimate. Change the numbers to match your network.</span>
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
        <b>Illustrative estimate.</b> How much water a year you might save by finding leaks faster.
        The starting numbers are cautious guesses you can edit.
      </p>
      <div className='roi-fields'>
        <label>
          Leaks per month
          <input
            type='number'
            min='1'
            value={leaks}
            onChange={(e) => setLeaks(validateInput(+e.target.value, 1))}
          />
        </label>
        <label>
          Typical leak <small>litres per minute</small>
          <input
            type='number'
            min='0'
            value={lpm}
            onChange={(e) => setLpm(validateInput(+e.target.value, 0))}
          />
          {hasLast && (
            <button type='button' className='roi-use-last' onClick={() => setLpm(Math.round(lastLpm))}>
              Use my last test ({fmt(lastLpm)} L/min)
            </button>
          )}
        </label>
        <label>
          Days found sooner <small>per leak</small>
          <input
            type='number'
            min='1'
            value={days}
            onChange={(e) => setDays(validateInput(+e.target.value, 1))}
          />
        </label>
        <label>
          Cost of making water <small>₹ per 1,000 litres</small>
          <input
            type='number'
            min='0'
            value={cost}
            onChange={(e) => setCost(validateInput(+e.target.value, 0))}
          />
        </label>
      </div>
      <div className='roi-results' aria-live='polite'>
        <div className='roi-result'>
          <span>
            <Droplet size={14} aria-hidden='true' /> Water saved a year
          </span>
          <b>
            {fmt(litres)} <small>litres</small>
          </b>
        </div>
        <div className='roi-result'>
          <span>
            <Truck size={14} aria-hidden='true' /> Tanker trips avoided
          </span>
          <b>
            {fmt(litres / TANKER_L)} <small>a year</small>
          </b>
          <small>One tanker holds {fmt(TANKER_L)} litres</small>
        </div>
        <div className='roi-result emphasis'>
          <span>
            <IndianRupee size={14} aria-hidden='true' /> Value a year
          </span>
          <b>{rupees((litres / 1000) * cost)}</b>
          <small>at {rupees(cost)} per 1,000 litres</small>
        </div>
      </div>
    </Modal>
  );
}
