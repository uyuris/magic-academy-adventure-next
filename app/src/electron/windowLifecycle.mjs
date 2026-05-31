export function attachWindowLifecycle(window, { onClosed } = {}) {
  if (!window || typeof window.once !== 'function') {
    throw new Error('window with once(event, handler) is required');
  }
  window.once('closed', () => {
    onClosed?.();
  });
  return window;
}

export function resolveMainWindowEntryUrl({ runtimeUrl, isPackaged }) {
  if (!runtimeUrl) return null;
  return isPackaged ? new URL('/?initialScreen=title', runtimeUrl).toString() : runtimeUrl;
}

export function shouldCreateMainWindowOnActivate({ mainWindow, runtimeUrl }) {
  if (!runtimeUrl) return false;
  if (!mainWindow) return true;
  if (typeof mainWindow.isDestroyed === 'function') {
    return mainWindow.isDestroyed();
  }
  return false;
}
