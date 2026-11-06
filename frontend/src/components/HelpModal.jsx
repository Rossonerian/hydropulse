import { Modal, Kbd, Button } from '../ui/index.js';
import '../styles/ops/charts_roi.css';

export default function HelpModal({ open, onClose, onReplayTour }) {
  const groups = [
    {
      title: 'Run',
      rows: [
        { keys: ['1', '2', '3'], action: 'Pick a problem to try' },
        { keys: ['Space'], action: 'Start the test leak' },
        { keys: ['I'], action: 'Shut the valves to stop the leak' },
        { keys: ['R'], action: 'Start over' },
      ],
    },
    {
      title: 'Navigate',
      rows: [
        { keys: ['N'], action: 'Switch between Operations and Network editor' },
        { keys: ['?', '/'], action: 'Open this help' },
      ],
    },
    {
      title: 'View',
      rows: [
        { keys: ['B'], action: 'Show or hide the street map' },
        { keys: ['F'], action: 'Full screen' },
        { keys: ['J', 'V'], action: 'Blind test: hide the real leak spot, then show it' },
      ],
    },
  ];

  return (
    <Modal open={open} onClose={onClose} title='Keyboard shortcuts'>
      <div className='help-shortcuts'>
        {groups.map((group) => (
          <section key={group.title} className='help-group' aria-labelledby={`help-${group.title}`}>
            <h3 id={`help-${group.title}`} className='help-group__title'>
              {group.title}
            </h3>
            {group.rows.map((row) => (
              <div key={row.action} className='help-shortcut-row'>
                <span className='help-shortcut-action'>{row.action}</span>
                <div className='help-shortcut-keys'>
                  {row.keys.map((key, keyIndex) => (
                    <Kbd key={keyIndex}>{key}</Kbd>
                  ))}
                </div>
              </div>
            ))}
          </section>
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
            Replay the quick tour
          </Button>
        </div>
      )}
    </Modal>
  );
}
