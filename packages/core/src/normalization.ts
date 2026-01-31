import type { NormalizationConfig } from "@dolly/schema";

export function buildNormalizationCSS(config: NormalizationConfig): string {
  const rules: string[] = [];

  if (config.hideScrollbars) {
    rules.push(`
      ::-webkit-scrollbar { display: none !important; }
      * { scrollbar-width: none !important; }
    `);
  }

  if (config.disableCursorBlink) {
    rules.push(`
      * { caret-color: currentColor !important; }
      @keyframes dolly-solid-caret { 0%, 100% { opacity: 1; } }
    `);
  }

  if (config.disableAnimations) {
    rules.push(`
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-delay: 0ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        transition-delay: 0ms !important;
      }
    `);
  }

  if (config.forceConsistentFonts && config.fontFamily) {
    rules.push(`
      *, *::before, *::after {
        font-family: ${config.fontFamily} !important;
      }
    `);
  }

  return rules.join("\n");
}

export function buildNormalizationJS(): string {
  return `
    // Suppress modal dialogs
    window.alert = () => {};
    window.confirm = () => true;
    window.prompt = () => null;

    // Re-inject normalization style on DOMContentLoaded
    const injectStyle = () => {
      if (!document.getElementById('dolly-normalization')) {
        const existing = document.querySelector('style[data-dolly]');
        if (existing) {
          existing.id = 'dolly-normalization';
        }
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectStyle);
    } else {
      injectStyle();
    }
  `;
}

export function buildInitScript(config: NormalizationConfig): string {
  const css = buildNormalizationCSS(config);
  const js = buildNormalizationJS();

  return `
    (function() {
      // Inject normalization CSS
      const style = document.createElement('style');
      style.setAttribute('data-dolly', 'normalization');
      style.id = 'dolly-normalization';
      style.textContent = ${JSON.stringify(css)};
      (document.head || document.documentElement).appendChild(style);

      ${js}
    })();
  `;
}
