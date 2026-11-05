import { Modal, Kbd, Button } from '../ui/index.js';
import '../styles/ops/charts_roi.css';

export default function HelpModal({ open, onClose, onReplayTour }) {
  const shortcuts = [
    { keys: ['1', '2', '3'], action: 'Select scenario presets' },
    { keys: ['Space'], action: 'Simulate burst' },
    { keys: ['I'], action: 'Isolate valves' },
    { keys: ['R'], action: 'Reset incident' },
    { keys: ['J'], action: 'Toggle judge mode' },
    { keys: ['V'], action: 'Reveal / hide truth' },
    { keys: ['N'], action: 'Switch between Operations and Network Studio' },
    { keys: ['B'], action: 'Toggle basemap' },
    { keys: ['F'], action: 'Fullscreen' },
    { keys: ['?', '/'], action: 'Open this help dialog' },
  ];

  return (
    <Modal open={open} onClose={onClose} title='Keyboard shortcuts'>
      <div className='help-shortcuts'>
        {shortcuts.map((shortcut, index) => (
          <div key={index} className='help-shortcut-row'>
            <div className='help-shortcut-keys'>
              {shortcut.keys.map((key, keyIndex) => (
                <Kbd key={keyIndex}>{key}</Kbd>
              ))}
            </div>
            <span className='help-shortcut-action'>{shortcut.action}</span>
          </div>
        ))}
      </div>
      {onReplayTour && (
        <div className='help-replay'>
          <Button
            variant='secondary'
            size='sm'
            onClick={() => {
              onClose?.();
              onReplayTour();
            }}
          >
            Replay tour
          </Button>
        </div>
      )}
    </Modal>
  );
}
