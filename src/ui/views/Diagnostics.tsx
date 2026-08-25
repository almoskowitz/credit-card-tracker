import { useEffect, useState } from 'react';

/**
 * Temporary layout-diagnostics readout. Exists so real on-device geometry can be
 * screenshotted from the installed PWA — Chrome cannot reproduce iOS viewport
 * behavior, and the simulator cannot be driven into standalone mode headlessly.
 * Remove once the bottom-of-screen layout is settled.
 */
function readEnv(name: string): string {
  const probe = document.createElement('div');
  probe.style.cssText = `position:fixed;visibility:hidden;height:env(${name},0px)`;
  document.body.appendChild(probe);
  const v = getComputedStyle(probe).height;
  probe.remove();
  return v;
}

function rect(sel: string): string {
  const el = document.querySelector(sel);
  if (!el) return 'not found';
  const r = el.getBoundingClientRect();
  return `top ${Math.round(r.top)} · bot ${Math.round(r.bottom)} · h ${Math.round(r.height)}`;
}

function collect(): [string, string][] {
  const vv = window.visualViewport;
  const shell = document.querySelector('.app-shell');
  const bar = document.querySelector('.tabbar');
  const barBottom = bar ? bar.getBoundingClientRect().bottom : 0;
  const rs = getComputedStyle(document.documentElement);
  return [
    ['display-mode', window.matchMedia('(display-mode: standalone)').matches ? 'standalone ✓' : 'browser'],
    [
      'navigator.standalone',
      'standalone' in navigator ? `${Boolean((navigator as Navigator & { standalone?: boolean }).standalone)}` : 'n/a',
    ],
    ['innerHeight', `${window.innerHeight}`],
    ['document.clientHeight', `${document.documentElement.clientHeight}`],
    ['visualViewport.h', vv ? `${Math.round(vv.height)}` : 'n/a'],
    ['vv.scale', vv ? `${vv.scale.toFixed(3)}` : 'n/a'],
    ['vv.offsetTop', vv ? `${Math.round(vv.offsetTop)}` : 'n/a'],
    ['dpr', `${window.devicePixelRatio}`],
    ['screen', `${screen.width}×${screen.height}`],
    ['screen.avail', `${screen.availWidth}×${screen.availHeight}`],
    ['safe-top', readEnv('safe-area-inset-top')],
    ['safe-bottom', readEnv('safe-area-inset-bottom')],
    ['--bottom-gutter', rs.getPropertyValue('--bottom-gutter').trim() || '(unset)'],
    ['--tabbar-h', rs.getPropertyValue('--tabbar-h').trim() || '(unset)'],
    ['--app-100vh', rs.getPropertyValue('--app-100vh').trim() || '(unset ✓)'],
    ['.app-shell', shell ? rect('.app-shell') : 'not found'],
    ['.tabbar', bar ? rect('.tabbar') : 'not found'],
    ['viewport gap below bar', `${Math.round(window.innerHeight - barBottom)} px`],
    ['screen.h − innerHeight', `${Math.round(screen.height - window.innerHeight)} px`],
    ['doc scrollTop', `${Math.round(document.documentElement.scrollTop)}`],
  ];
}

export function Diagnostics() {
  const [rows, setRows] = useState<[string, string][]>([]);

  useEffect(() => {
    const tick = () => setRows(collect());
    tick();
    const id = window.setInterval(tick, 500);
    const vv = window.visualViewport;
    window.addEventListener('resize', tick);
    window.addEventListener('scroll', tick, true);
    vv?.addEventListener('resize', tick);
    vv?.addEventListener('scroll', tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', tick);
      window.removeEventListener('scroll', tick, true);
      vv?.removeEventListener('resize', tick);
      vv?.removeEventListener('scroll', tick);
    };
  }, []);

  return (
    <div className="diag">
      <p className="diag-note">
        Live values. Screenshot this, then tap a text field below and screenshot again.
      </p>
      <table className="diag-table">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th>{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <input className="diag-input" placeholder="tap here to open keyboard" inputMode="text" />
    </div>
  );
}
