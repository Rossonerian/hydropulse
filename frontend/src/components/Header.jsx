import TopBar from './TopBar.jsx';

export default function Header({
  view = 'operations',
  onViewChange,
  onStudioToggle,
  onHelpToggle,
  onHelp,
  onRoiToggle,
  onRoi,
  ...props
}) {
  return (
    <TopBar
      view={view}
      onViewChange={
        onViewChange ||
        (onStudioToggle ? (v) => (v === 'studio' ? onStudioToggle(true) : onStudioToggle(false)) : undefined)
      }
      onHelp={onHelp || onHelpToggle}
      onRoi={onRoi || onRoiToggle}
      {...props}
    />
  );
}
