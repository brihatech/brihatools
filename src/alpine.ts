import Alpine from "alpinejs";

declare global {
  interface Window {
    Alpine?: typeof Alpine;
    __briha_alpine_started__?: boolean;
  }
}

export const getAlpine = () => {
  window.Alpine = Alpine;
  return Alpine;
};

export const startAlpine = () => {
  if (window.__briha_alpine_started__) return;
  Alpine.start();
  window.__briha_alpine_started__ = true;
};
