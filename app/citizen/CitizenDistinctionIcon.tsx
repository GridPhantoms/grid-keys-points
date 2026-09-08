type CitizenDistinctionIconProps = {
  kind: 'upload' | 'wallet';
};

export function CitizenDistinctionIcon({ kind }: CitizenDistinctionIconProps) {
  if (kind === 'upload') {
    return <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 5.25 18.75 12 12 18.75 5.25 12Z" />
    </svg>;
  }

  return <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2.6" />
    <circle className="ct-distinction-icon-dot" cx="12" cy="12" r="0.8" />
  </svg>;
}
