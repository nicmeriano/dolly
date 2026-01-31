import type { NormalizationConfig, CursorConfig } from "@dolly/schema";

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

export function buildCursorCSS(config: CursorConfig): string {
  return `
    .dolly-cursor {
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      border-radius: 50%;
      width: ${config.size}px;
      height: ${config.size}px;
      background: ${config.color};
      opacity: ${config.opacity};
      transform: translate(-50%, -50%);
      transition-property: left, top, transform !important;
      transition-duration: 150ms, 150ms, 100ms !important;
      transition-timing-function: ease-out, ease-out, ease !important;
      transition-delay: 0ms !important;
      left: -100px;
      top: -100px;
    }
    .dolly-cursor--clicking {
      transform: translate(-50%, -50%) scale(0.75);
    }
  `;
}

export function buildCursorJS(): string {
  return `
    var dollyCursor = document.createElement('div');
    dollyCursor.className = 'dolly-cursor';
    document.documentElement.appendChild(dollyCursor);

    document.addEventListener('mousemove', function(e) {
      dollyCursor.style.left = e.clientX + 'px';
      dollyCursor.style.top = e.clientY + 'px';
    }, true);

    document.addEventListener('mousedown', function() {
      dollyCursor.classList.add('dolly-cursor--clicking');
    }, true);

    document.addEventListener('mouseup', function() {
      dollyCursor.classList.remove('dolly-cursor--clicking');
    }, true);
  `;
}

export interface BuildInitScriptOptions {
  normalization: NormalizationConfig;
  cursor?: CursorConfig;
}

export function buildInitScript(config: NormalizationConfig | BuildInitScriptOptions): string {
  const normConfig = "normalization" in config ? config.normalization : config;
  const cursorConfig = "normalization" in config ? config.cursor : undefined;

  const css = buildNormalizationCSS(normConfig);
  const cursorCss = cursorConfig?.show ? buildCursorCSS(cursorConfig) : "";
  const cursorJs = cursorConfig?.show ? buildCursorJS() : "";

  const allCss = css + cursorCss;
  const cssLiteral = JSON.stringify(allCss);

  return `
    (function() {
      // Non-DOM overrides can run immediately
      window.alert = function() {};
      window.confirm = function() { return true; };
      window.prompt = function() { return null; };

      function dollyInit() {
        // Inject normalization + cursor CSS
        if (document.getElementById('dolly-normalization')) return;
        var style = document.createElement('style');
        style.setAttribute('data-dolly', 'normalization');
        style.id = 'dolly-normalization';
        style.textContent = ${cssLiteral};
        var target = document.head || document.documentElement || document.querySelector('html');
        if (target) {
          target.appendChild(style);
        }

        ${cursorJs}
      }

      // Run immediately if DOM is ready, otherwise defer
      if (document.documentElement) {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', dollyInit, { once: true });
        } else {
          dollyInit();
        }
      } else {
        document.addEventListener('DOMContentLoaded', dollyInit, { once: true });
      }
    })();
  `;
}
