function getLogoUrl() {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL('Logo.png');
    }
  } catch {
    // ignore — browser preview
  }
  return '/Logo.png';
}

export function EmptyState() {
  return (
    <div className="logo-area">
      <img src={getLogoUrl()} alt="DigitalTwin" className="center-logo" />
    </div>
  );
}
