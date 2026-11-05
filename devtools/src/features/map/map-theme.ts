export function mapTheme() {
  const style = getComputedStyle(document.documentElement);
  return {
    dark: document.documentElement.dataset.theme === 'dark',
    background: style.getPropertyValue('--map-background').trim(),
    sky: style.getPropertyValue('--map-sky').trim(),
    ground: style.getPropertyValue('--map-ground').trim(),
  };
}

export function observeMapTheme(update: () => void) {
  update();
  const observer = new MutationObserver(update);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}
