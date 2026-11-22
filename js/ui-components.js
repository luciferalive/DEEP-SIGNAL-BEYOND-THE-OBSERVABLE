// Small HTML-string helpers shared by all views.
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const num = (n, d = 0) => (n == null || !isFinite(n) ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
export const pct = n => `${Math.round(n)}%`;
export const days = n => (!isFinite(n) ? '∞' : n >= 999 ? '999+ d' : `${n < 10 ? n.toFixed(1) : Math.round(n)} d`);
export const tone = (v, warn = 40, bad = 20) => (v <= bad ? 'bad' : v <= warn ? 'warn' : 'ok');

export const bar = (value, max = 100, cls = '') => `<div class="bar ${cls}" role="progressbar" aria-valuenow="${Math.round(value)}" aria-valuemin="0" aria-valuemax="${Math.round(max)}"><i style="width:${Math.max(0, Math.min(100, (value / (max || 1)) * 100)).toFixed(1)}%"></i></div>`;

export const meter = (label, valueText, value, max, cls = '', sub = '') => `<div class="meter"><div class="top"><b>${esc(label)}</b><span class="mono">${valueText}</span></div>${bar(value, max, cls)}${sub ? `<div class="faint" style="font-size:.72rem">${sub}</div>` : ''}</div>`;

export const badge = (text, cls = '') => `<span class="badge ${cls}">${esc(text)}</span>`;
export const unknown = () => '<span class="unknown">DATA UNKNOWN</span>';
export const val = v => (v == null || v === 'DATA UNKNOWN' ? unknown() : esc(v));

export const btn = (label, act, { id = '', val: v = '', cls = '', disabled = false, title = '', extra = '' } = {}) =>
  `<button class="btn ${cls}" data-act="${act}"${id !== '' ? ` data-id="${esc(id)}"` : ''}${v !== '' ? ` data-val="${esc(v)}"` : ''}${disabled ? ' disabled' : ''}${title ? ` title="${esc(title)}"` : ''} ${extra}>${label}</button>`;

export const panel = (title, body, { tag = '', cls = '' } = {}) => `<section class="panel ${cls}"><h3>${esc(title)}${tag ? `<span class="tag">${tag}</span>` : ''}</h3>${body}</section>`;
export const head = (kicker, title, text = '') => `<div class="page-head"><div><div class="kicker">${esc(kicker)}</div><h2>${esc(title)}</h2>${text ? `<p>${text}</p>` : ''}</div></div>`;
export const tile = (label, value, sub = '', cls = '') => `<div class="tile"><span class="label">${esc(label)}</span><span class="value ${cls}">${value}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</div>`;
export const empty = text => `<p class="muted" style="margin:.2rem 0">${esc(text)}</p>`;

// Interactive line chart. Hover data is in data-pts so one delegated handler can show a tooltip.
export function chart(series, { unit = '', min = null, max = null, label = '', formatDate = t => t } = {}) {
  if (!series || series.length < 2) return `<div class="faint" style="font-size:.74rem;padding:.6rem 0">Chart fills as the simulation runs.</div>`;
  const W = 300, H = 64, pad = 4;
  const vs = series.map(p => p[1]); const lo = min ?? Math.min(...vs), hi = max ?? Math.max(...vs); const span = hi - lo || 1;
  const x = i => pad + (i / (series.length - 1)) * (W - 2 * pad), y = v => H - pad - ((v - lo) / span) * (H - 2 * pad);
  const pts = series.map((p, i) => `${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ');
  const data = series.map(p => `${formatDate(p[0])}|${p[1]}`).join(';');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} history" data-pts="${esc(data)}" data-unit="${esc(unit)}" data-label="${esc(label)}" preserveAspectRatio="none">
    <line class="grid" x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}"/><polygon class="area" points="${pad},${H - pad} ${pts} ${W - pad},${H - pad}"/><polyline class="line" points="${pts}"/><line class="hv" y1="0" y2="${H}" x1="0" x2="0"/>
    <text x="${pad}" y="9">${num(hi, hi < 10 ? 1 : 0)}</text><text x="${pad}" y="${H - 6}">${num(lo, lo < 10 ? 1 : 0)}</text></svg>`;
}
export const tabs = (items, current, act) => `<div class="row" style="margin-bottom:.8rem" role="tablist">${items.map(([id, label]) => `<button class="btn small" role="tab" data-act="${act}" data-id="${esc(id)}" aria-pressed="${id === current}">${esc(label)}</button>`).join('')}</div>`;
export const select = (id, options, current, { act = '', extra = '' } = {}) => `<select id="${id}" ${act ? `data-act="${act}"` : ''} ${extra}>${options.map(([v, l, dis]) => `<option value="${esc(v)}"${String(v) === String(current) ? ' selected' : ''}${dis ? ' disabled' : ''}>${esc(l)}</option>`).join('')}</select>`;
