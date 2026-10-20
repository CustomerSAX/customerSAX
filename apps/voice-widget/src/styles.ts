/** Widget styles, scoped by the Shadow DOM so merchant CSS can't reach in (and ours can't leak out). */
export const STYLES = `
:host {
  --vw-accent: #3b5bdb;
  --vw-accent-hover: #3249b8;
  --vw-on-accent: #ffffff;
  --vw-surface: #ffffff;
  --vw-surface-2: #f3f4f7;
  --vw-text: #1b1d24;
  --vw-text-muted: #5d6170;
  --vw-border: #dde0e8;
  --vw-ok: #1f7a4d;
  --vw-ok-bg: #e5f4ec;
  --vw-danger: #b3261e;
  --vw-shadow: 0 12px 32px rgba(17, 20, 32, 0.18);
  all: initial;
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--vw-text);
}
@media (prefers-color-scheme: dark) {
  :host {
    --vw-accent: #7c93ff;
    --vw-accent-hover: #98aaff;
    --vw-on-accent: #0e1222;
    --vw-surface: #1a1c23;
    --vw-surface-2: #252832;
    --vw-text: #eceef4;
    --vw-text-muted: #a3a8b8;
    --vw-border: #343846;
    --vw-ok: #6fd3a0;
    --vw-ok-bg: #173527;
    --vw-danger: #ff8a80;
    --vw-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  }
}
* { box-sizing: border-box; }
button { font: inherit; cursor: pointer; }
button:focus-visible, input:focus-visible { outline: 2px solid var(--vw-accent); outline-offset: 2px; }

.launcher {
  position: fixed; right: 16px; bottom: 16px; z-index: 2147483000;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 18px; border: 0; border-radius: 999px;
  background: var(--vw-accent); color: var(--vw-on-accent);
  font-weight: 600; box-shadow: var(--vw-shadow);
}
.launcher:hover { background: var(--vw-accent-hover); }
.launcher svg { width: 18px; height: 18px; }

.panel {
  position: fixed; right: 16px; bottom: 16px; z-index: 2147483000;
  width: min(380px, calc(100vw - 32px)); height: min(560px, calc(100vh - 32px));
  display: flex; flex-direction: column;
  background: var(--vw-surface); color: var(--vw-text);
  border: 1px solid var(--vw-border); border-radius: 16px; box-shadow: var(--vw-shadow);
  overflow: hidden;
}
.header { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--vw-border); }
.title { font-weight: 600; flex: 1; }
.icon-btn { border: 0; background: transparent; color: var(--vw-text-muted); padding: 6px; border-radius: 8px; line-height: 0; }
.icon-btn:hover { background: var(--vw-surface-2); color: var(--vw-text); }
.icon-btn svg { width: 18px; height: 18px; }

.status { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 14px; color: var(--vw-text-muted); font-size: 13px; min-height: 36px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--vw-text-muted); }
.status[data-state="listening"] .dot { background: var(--vw-danger); animation: pulse 1.2s ease-in-out infinite; }
.status[data-state="speaking"] .dot, .status[data-state="thinking"] .dot { background: var(--vw-accent); animation: pulse 1.2s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) { .dot { animation: none !important; } }
.chip { padding: 2px 8px; border-radius: 999px; background: var(--vw-ok-bg); color: var(--vw-ok); font-weight: 600; font-size: 12px; }

.captions { flex: 1; overflow-y: auto; padding: 4px 14px 12px; display: flex; flex-direction: column; gap: 8px; }
.msg { max-width: 85%; padding: 8px 12px; border-radius: 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
.msg.assistant { align-self: flex-start; background: var(--vw-surface-2); }
.msg.user { align-self: flex-end; background: var(--vw-accent); color: var(--vw-on-accent); }
.msg.interim { opacity: 0.6; font-style: italic; }
.notice { align-self: center; text-align: center; color: var(--vw-text-muted); font-size: 13px; padding: 4px 8px; }

.intro { flex: 1; padding: 20px 16px; display: flex; flex-direction: column; gap: 14px; justify-content: center; }
.intro p { margin: 0; color: var(--vw-text-muted); }
.primary { border: 0; border-radius: 10px; padding: 10px 14px; background: var(--vw-accent); color: var(--vw-on-accent); font-weight: 600; }
.primary:hover { background: var(--vw-accent-hover); }
.primary:disabled { opacity: 0.6; cursor: default; }

.controls { display: flex; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--vw-border); }
.ctrl { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; border: 1px solid var(--vw-border); border-radius: 10px; background: var(--vw-surface); color: var(--vw-text); font-size: 13px; }
.ctrl:hover:not(:disabled) { background: var(--vw-surface-2); }
.ctrl:disabled { opacity: 0.45; cursor: default; }
.ctrl svg { width: 16px; height: 16px; }
.ctrl.end { color: var(--vw-danger); }

.composer { display: flex; gap: 8px; padding: 0 14px 14px; }
.composer input { flex: 1; min-width: 0; padding: 9px 12px; border: 1px solid var(--vw-border); border-radius: 10px; background: var(--vw-surface); color: var(--vw-text); font: inherit; }
.composer button { border: 0; border-radius: 10px; padding: 0 14px; background: var(--vw-accent); color: var(--vw-on-accent); font-weight: 600; }
.composer button:disabled, .composer input:disabled { opacity: 0.5; cursor: default; }
[hidden] { display: none !important; }
`;
