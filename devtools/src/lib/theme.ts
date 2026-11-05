export type Theme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'pawmap:theme';
const THEME_EVENT = 'pawmap:theme-change';

// Run before first paint. Only the root theme attributes differ from server HTML.
export const themeInitScript = `(function(){var r=document.documentElement,p='system',m=matchMedia('(prefers-color-scheme: dark)');try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');if(s==='light'||s==='dark')p=s}catch(e){}r.dataset.themePreference=p;r.dataset.theme=p==='system'?(m.matches?'dark':'light'):p;m.addEventListener('change',function(){if(r.dataset.themePreference==='system')r.dataset.theme=m.matches?'dark':'light'})})()`;

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function getServerTheme(): Theme {
  return 'light';
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* The current tab still works when storage is unavailable. */
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function subscribeTheme(notify: () => void) {
  const media = matchMedia('(prefers-color-scheme: dark)');
  const systemChanged = () => {
    if (document.documentElement.dataset.themePreference === 'system') {
      document.documentElement.dataset.theme = media.matches ? 'dark' : 'light';
      notify();
    }
  };
  const storageChanged = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    const preference =
      event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : 'system';
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.dataset.theme =
      preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    notify();
  };
  window.addEventListener(THEME_EVENT, notify);
  window.addEventListener('storage', storageChanged);
  media.addEventListener('change', systemChanged);
  // Reconcile changes that happened between the initial inline script and hydration.
  systemChanged();
  return () => {
    window.removeEventListener(THEME_EVENT, notify);
    window.removeEventListener('storage', storageChanged);
    media.removeEventListener('change', systemChanged);
  };
}
