import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { Button, StatusDot } from '../../ui/index.js';
import '../../styles/studio/canvas.css';

export default function ValidationBar({ draft, validation, issuesOpen, setIssuesOpen, allIssues, focusIssue }) {
  const errors = validation.errors.length;
  const warnings = validation.warnings.length;
  return (
    <footer className={`stu-val ${issuesOpen ? 'stu-val--open' : ''}`} aria-label='Topology check'>
      <div className='stu-val__summary'>
        <span className='stu-val__text'>
          <span className='stu-val__num'>{draft.network.nodes.length}</span> nodes
          <span aria-hidden='true'> · </span>
          <span className='stu-val__num'>{draft.network.pipes.length}</span> pipes
          <span aria-hidden='true'> · </span>
          <span className='stu-val__issue'>
            <StatusDot tone={errors ? 'leak' : 'sensor'} />
            {errors ? <X size={13} aria-hidden='true' /> : <CheckCircle2 size={13} aria-hidden='true' />}
            <span className='stu-val__num'>{errors}</span> errors
          </span>
          <span aria-hidden='true'> · </span>
          <span className='stu-val__issue'>
            <StatusDot tone={warnings ? 'valve' : 'sensor'} />
            {warnings ? <AlertTriangle size={13} aria-hidden='true' /> : <CheckCircle2 size={13} aria-hidden='true' />}
            <span className='stu-val__num'>{warnings}</span> warnings
          </span>
        </span>
        <Button
          size='sm'
          onClick={() => setIssuesOpen((open) => !open)}
          aria-expanded={issuesOpen}
        >
          {issuesOpen ? 'Hide details' : 'Review'}
        </Button>
        <span className='stu-val__note'>Topology check only — no hydraulic calculation</span>
      </div>
      {issuesOpen && (
        <div className='stu-val__list'>
          {!allIssues.length ? (
            <p className='stu-val__none'><CheckCircle2 size={15} aria-hidden='true' /> No topology or property issues found.</p>
          ) : allIssues.slice(0, 12).map((issue, index) => (
            <button
              type='button'
              className='stu-val__item'
              key={`${issue.objectType}-${issue.objectId}-${index}`}
              onClick={() => focusIssue(issue)}
            >
              {issue.severity === 'error' ? <X size={14} aria-hidden='true' /> : <AlertTriangle size={14} aria-hidden='true' />}
              <span className='stu-val__sev'>{issue.severity === 'error' ? 'Error' : 'Warning'}</span>
              <span className='stu-val__msg'>{issue.message}</span>
              <code className='stu-val__id'>{issue.objectId}</code>
            </button>
          ))}
        </div>
      )}
    </footer>
  );
}
