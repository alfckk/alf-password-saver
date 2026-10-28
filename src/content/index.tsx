import { createRoot } from 'react-dom/client';
import { installCapture } from './capture';
import { App } from './ui/App';
import css from './ui/styles.css?inline';

const HOST_TAG = 'password-saver-root';

/** Only the top frame and same-origin iframes may receive credentials. */
function canRunInFrame(): boolean {
  if (window === window.top) return true;
  try {
    return window.top!.location.origin === location.origin;
  } catch {
    return false;
  }
}

if (canRunInFrame() && !document.querySelector(HOST_TAG)) {
  const host = document.createElement(HOST_TAG);
  // Closed so page scripts can't read suggestions; e2e builds open it for Playwright.
  const shadow = host.attachShadow({ mode: import.meta.env.MODE === 'e2e' ? 'open' : 'closed' });
  const style = document.createElement('style');
  style.textContent = css;
  const mount = document.createElement('div');
  shadow.append(style, mount);
  document.documentElement.appendChild(host);

  createRoot(mount).render(<App isTop={window === window.top} />);
  installCapture((e) => e.composedPath().includes(host));
}
