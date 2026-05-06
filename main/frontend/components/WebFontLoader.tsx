import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * WebFontLoader — injects Bricolage Grotesque (display) + Onest (body) +
 * JetBrains Mono (numerals) on web only.  Native builds bundle their own
 * system fonts and should not pay the network cost.
 *
 * Mounts once at the app root.  Idempotent.
 */
const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?' +
  [
    'family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500;12..96,600;12..96,700',
    'family=Onest:wght@400;500;600;700',
    'family=JetBrains+Mono:wght@400;500',
    'display=swap',
  ].join('&');

const LINK_ID = 'gado-web-fonts';
const STYLE_ID = 'gado-web-font-defaults';

export default function WebFontLoader(): null {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;

    // <link rel=preconnect> — reduces fetch latency on first paint.
    const ensurePreconnect = (href: string, crossOrigin = false) => {
      const id = `gado-preconnect-${href}`;
      if (document.getElementById(id)) return;
      const l = document.createElement('link');
      l.id = id;
      l.rel = 'preconnect';
      l.href = href;
      if (crossOrigin) l.crossOrigin = 'anonymous';
      document.head.appendChild(l);
    };
    ensurePreconnect('https://fonts.googleapis.com');
    ensurePreconnect('https://fonts.gstatic.com', true);

    // <link rel=stylesheet> — Google Fonts CSS that declares @font-face.
    if (!document.getElementById(LINK_ID)) {
      const link = document.createElement('link');
      link.id = LINK_ID;
      link.rel = 'stylesheet';
      link.href = GOOGLE_FONTS_URL;
      document.head.appendChild(link);
    }

    // Default body/font-smoothing rules that can't be expressed in RN style.
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        html, body, #root {
          background-color: #0C0D12;
        }
        body {
          font-family: "Onest", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
          font-feature-settings: "ss01", "cv01", "cv11";
        }
        ::selection {
          background: rgba(108, 99, 232, 0.32);
          color: #EDEBE3;
        }
        /* Leaflet map — tone down the default tile look when embedded. */
        .leaflet-container {
          background: #0C0D12 !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return null;
}
