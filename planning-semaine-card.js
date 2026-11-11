/*!
 * planning-semaine-card  v1.2.0
 * Carte Home Assistant : planning hebdomadaire avec périodes horaires.
 * Deux cartes dans ce fichier :
 *   - custom:planning-semaine-card             (vertical : jours en colonnes, heures du haut en bas)
 *   - custom:planning-semaine-horizontal-card  (horizontal : jours en lignes, heures de gauche à droite)
 *   (l'option « orientation: vertical | horizontal » fonctionne sur les deux)
 *
 *  - Lit et écrit un helper « Planning » (schedule.xxx) : les périodes sont donc
 *    utilisables dans les automatisations (l'entité est "on" pendant les plages).
 *  - Mode Exploitation (par défaut) : lecture seule, aucune modification possible.
 *  - Mode Configuration : toutes les modifications — déplacer une plage (même vers
 *    un autre jour), ajuster ses bords par glissé, créer des plages (glisser sur
 *    un jour, un simple clic = 1 h) et les supprimer (bouton ×).
 *  - hide_config_button: true  =>  carte entièrement en lecture seule.
 *
 *  Nécessite un compte administrateur pour enregistrer (API du helper Planning).
 */

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const pad = (n) => String(n).padStart(2, '0');
const parseTime = (s) => {
  const p = String(s).split(':');
  return Number(p[0]) * 60 + (Number(p[1]) || 0);
};
const fmtShort = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; // 1440 -> "24:00"
const fmtFull = (m) => (m >= 1440 ? '24:00:00' : `${fmtShort(m)}:00`);

const CSS = `
  :host { display: block; }
  ha-card { padding: 12px 12px 10px; overflow: hidden; }

  .head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .titles { flex: 1; min-width: 0; }
  .title { font-size: 1.1em; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font-size: .8em; color: var(--secondary-text-color); min-height: 1.1em; }
  .badge { font-size: .75em; padding: 3px 10px; border-radius: 999px;
           background: var(--divider-color); color: var(--secondary-text-color); white-space: nowrap; }
  .badge.on { background: color-mix(in srgb, var(--c) 22%, transparent); color: var(--c); font-weight: 600; }
  .mode { display: flex; align-items: center; gap: 4px; font: inherit; font-size: .8em; cursor: pointer;
          padding: 4px 10px; border-radius: 999px; white-space: nowrap;
          border: 1px solid var(--divider-color); background: none; color: var(--primary-text-color); }
  .mode[hidden] { display: none; }
  .mode ha-icon { --mdc-icon-size: 16px; }
  ha-card.config .mode { background: var(--c); border-color: var(--c); color: #fff; }

  .banner { margin: 0 0 10px; padding: 8px 12px; border-radius: 8px; font-size: .85em;
            background: color-mix(in srgb, var(--error-color, #db4437) 14%, transparent);
            color: var(--primary-text-color); }
  .banner[hidden] { display: none; }

  /* ---------- vertical ---------- */
  .dayrow, .body { display: grid; grid-template-columns: 34px 1fr; }
  .dayhead, .cols { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px; }
  .dl { text-align: center; font-size: .8em; font-weight: 600; padding: 4px 0 6px;
        color: var(--secondary-text-color); }
  .dl.today { color: var(--c); }

  .body { height: calc(var(--hh) * 24); }
  .axis { position: relative; }
  .hl { position: absolute; right: 5px; font-size: 10px; line-height: 1;
        color: var(--secondary-text-color); transform: translateY(-50%); }
  .hl:first-child { transform: none; }

  .col { position: relative; height: calc(var(--hh) * 24); border-radius: 6px; container: col / inline-size;
         background-color: color-mix(in srgb, var(--divider-color) 16%, transparent);
         background-image: repeating-linear-gradient(to bottom, transparent 0,
           transparent calc(var(--hh) - 1px), var(--divider-color) calc(var(--hh) - 1px), var(--divider-color) var(--hh));
         touch-action: pan-y; }
  ha-card.config .col { cursor: crosshair; touch-action: none; }

  .blk { position: absolute; left: 2px; right: 2px; box-sizing: border-box; padding: 2px 3px;
         border-radius: 5px; cursor: default; user-select: none; -webkit-user-select: none;
         background: color-mix(in srgb, var(--c) 88%, transparent); color: #fff;
         font-size: 10px; line-height: 1.2; box-shadow: 0 1px 2px rgba(0, 0, 0, .25); }
  .blk .t { display: block; height: 100%; overflow: hidden; white-space: nowrap; pointer-events: none; }
  .blk .t span { display: block; }
  .blk .t .sep { display: none; }
  @container col (min-width: 84px) {
    .blk .t span { display: inline; }
    .blk .t .sep { display: inline; }
  }
  ha-card.config .blk { cursor: grab; touch-action: none; }
  .blk.drag { cursor: grabbing; z-index: 5; box-shadow: 0 4px 12px rgba(0, 0, 0, .4); outline: 2px solid #fff; }
  .blk.ghost { pointer-events: none; background: color-mix(in srgb, var(--c) 40%, transparent);
               border: 2px dashed var(--c); box-shadow: none; z-index: 3; }

  .h { display: none; position: absolute; left: 0; right: 0; height: min(8px, 30%); cursor: ns-resize; }
  ha-card.config .h { display: block; }
  .h.top { top: 0; }
  .h.bot { bottom: 0; }
  .h::after { content: ''; position: absolute; left: 50%; top: 50%; width: 14px; height: 2px;
              margin: -1px 0 0 -7px; border-radius: 2px; background: rgba(255, 255, 255, .6); opacity: 0; }
  .blk:hover .h::after { opacity: 1; }

  .del { display: none; position: absolute; top: -7px; right: -4px; z-index: 6; width: 18px; height: 18px;
         padding: 0; border: none; border-radius: 50%; cursor: pointer; font-size: 13px; line-height: 18px;
         background: var(--error-color, #db4437); color: #fff; }
  ha-card.config .del { display: block; }

  .now { position: absolute; left: 0; right: 0; height: 2px; z-index: 4; pointer-events: none;
         background: var(--error-color, #e53935); }
  .now::before { content: ''; position: absolute; left: -3px; top: -2px; width: 6px; height: 6px;
                 border-radius: 50%; background: var(--error-color, #e53935); }

  .foot { display: flex; justify-content: space-between; gap: 10px; margin-top: 10px;
          font-size: .75em; color: var(--secondary-text-color); }
  .st { white-space: nowrap; }
  .st.err { color: var(--error-color, #db4437); white-space: normal; text-align: right; }

  /* ---------- horizontal ---------- */
  .scroller { overflow-x: auto; overflow-y: hidden; padding-bottom: 2px; }
  .inner { min-width: calc(46px + var(--hw) * 24); }
  .hrow, .line { display: grid; grid-template-columns: 46px minmax(0, 1fr); }
  .ruler { position: relative; height: 16px; margin-bottom: 2px; }
  .ruler .hl { top: 0; right: auto; transform: translateX(-50%); }
  .ruler .hl:first-child { transform: none; }
  .rows { display: grid; gap: 3px; }

  .horiz .col { height: var(--rh);
    background-image: repeating-linear-gradient(to right, transparent 0,
      transparent calc(100% / 24 - 1px), var(--divider-color) calc(100% / 24 - 1px), var(--divider-color) calc(100% / 24)); }
  .horiz .dl { position: sticky; left: 0; z-index: 7; align-self: center; text-align: left;
               padding: 0 6px 0 2px; background: var(--ha-card-background, var(--card-background-color, #fff)); }
  .horiz .blk { right: auto; top: 3px; bottom: 3px; padding: 0 8px; font-size: 11px; }
  .horiz .blk .t { display: flex; align-items: center; height: 100%; }
  .horiz .blk .t span { display: inline; }
  .horiz .blk .t .sep { display: inline; margin: 0 .3em; }
  .horiz .blk { container: blk / inline-size; }
  @container blk (max-width: 74px) {
    .horiz .blk .t .sep, .horiz .blk .t .b { display: none; }
  }
  @container blk (max-width: 34px) {
    .horiz .blk { padding: 0 3px; font-size: 10px; }
  }
  .horiz .h { top: 0; bottom: 0; left: auto; right: auto; height: auto; width: min(8px, 30%); cursor: ew-resize; }
  .horiz .h.top { left: 0; }
  .horiz .h.bot { right: 0; }
  .horiz .h::after { width: 2px; height: 14px; margin: -7px 0 0 -1px; }
  .horiz .del { top: -5px; right: -5px; }
  .horiz .now { top: 0; bottom: 0; right: auto; width: 2px; height: auto; }
  .horiz .now::before { left: -2px; top: -3px; }
`;

class PlanningSemaineCard extends HTMLElement {
  static get defaultOrientation() {
    return 'vertical';
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._model = null;
    this._mode = 'exploitation';
    this._drag = null;
    this._chain = Promise.resolve();
    this._loadToken = 0;
  }

  static getConfigElement() {
    return document.createElement('planning-semaine-card-editor');
  }

  static getStubConfig(hass) {
    const entity = Object.keys((hass && hass.states) || {}).find((k) => k.startsWith('schedule.'));
    return { entity: entity || '' };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error('Veuillez renseigner « entity » (un helper Planning, ex. schedule.chauffage).');
    }
    this._config = {
      step: 15,
      hour_height: 28,
      row_height: 40,
      hour_width: 18,
      color: 'var(--primary-color)',
      hide_config_button: false,
      ...config,
    };
    const o = this._config.orientation;
    this._config.orientation = o === 'horizontal' || o === 'vertical' ? o : this.constructor.defaultOrientation;
    this._horiz = this._config.orientation === 'horizontal';
    this._config.step = Math.max(1, Math.min(120, Number(this._config.step) || 15));
    this._config.hour_height = Math.max(12, Number(this._config.hour_height) || 28);
    this._config.row_height = Math.max(24, Number(this._config.row_height) || 40);
    this._config.hour_width = Math.max(10, Number(this._config.hour_width) || 18);
    this._mode = 'exploitation';
    this._model = null;
    this._build();
    if (this._hass) {
      this._updateHeader();
      this._maybeLoad();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    this._stateObj = hass.states[this._config.entity];
    this._updateHeader();
    const stamp = this._stateObj ? this._stateObj.last_updated : null;
    if (stamp !== this._stamp) {
      this._stamp = stamp;
      this._maybeLoad();
    }
  }

  getCardSize() {
    return this._horiz
      ? Math.round((this._config.row_height * 7) / 50) + 3
      : Math.round((this._config.hour_height * 24) / 50) + 2;
  }

  getGridOptions() {
    return { columns: 12, min_columns: this._horiz ? 9 : 6, rows: 'auto' };
  }

  connectedCallback() {
    this._timer = setInterval(() => this._updateNow(), 30000);
  }

  disconnectedCallback() {
    clearInterval(this._timer);
  }

  /* ---------------------------------------------------------------- DOM */

  _build() {
    const c = this._config;
    const head = `
        <div class="head">
          <div class="titles"><div class="title"></div><div class="sub"></div></div>
          <span class="badge"></span>
          <button class="mode" type="button" ${c.hide_config_button ? 'hidden' : ''}>
            <ha-icon icon="mdi:cog-outline"></ha-icon><span></span>
          </button>
        </div>
        <div class="banner" hidden></div>`;
    const foot = '<div class="foot"><div class="hint"></div><div class="st"></div></div>';

    if (this._horiz) {
      const ruler = Array.from(
        { length: 24 },
        (_, h) => `<div class="hl" style="left:${(h / 24) * 100}%">${pad(h)}h</div>`
      ).join('');
      const lines = DAYS.map(
        (_, i) => `<div class="line"><div class="dl" data-d="${i}">${DAY_LABELS[i]}</div><div class="col" data-d="${i}"></div></div>`
      ).join('');
      this.shadowRoot.innerHTML = `<style>${CSS}</style>
        <ha-card class="horiz" style="--c:${c.color}">
          ${head}
          <div class="scroller">
            <div class="inner" style="--rh:${c.row_height}px;--hw:${c.hour_width}px">
              <div class="hrow"><div></div><div class="ruler">${ruler}</div></div>
              <div class="rows">${lines}</div>
            </div>
          </div>
          ${foot}
        </ha-card>`;
    } else {
      const hours = Array.from(
        { length: 24 },
        (_, h) => `<div class="hl" style="top:calc(var(--hh) * ${h})">${pad(h)}h</div>`
      ).join('');
      const heads = DAY_LABELS.map((d, i) => `<div class="dl" data-d="${i}">${d}</div>`).join('');
      const cols = DAYS.map((_, i) => `<div class="col" data-d="${i}"></div>`).join('');
      this.shadowRoot.innerHTML = `<style>${CSS}</style>
        <ha-card style="--c:${c.color}">
          ${head}
          <div class="dayrow"><div></div><div class="dayhead">${heads}</div></div>
          <div class="body" style="--hh:${c.hour_height}px">
            <div class="axis">${hours}</div>
            <div class="cols">${cols}</div>
          </div>
          ${foot}
        </ha-card>`;
    }

    const $ = (s) => this.shadowRoot.querySelector(s);
    this._card = $('ha-card');
    this._titleEl = $('.title');
    this._subEl = $('.sub');
    this._badgeEl = $('.badge');
    this._modeBtn = $('.mode');
    this._bannerEl = $('.banner');
    this._hintEl = $('.hint');
    this._stEl = $('.st');
    this._colsEl = $('.cols') || $('.rows');
    this._cols = [...this.shadowRoot.querySelectorAll('.col')];

    if (this._horiz && typeof ResizeObserver !== 'undefined') {
      if (this._ro) this._ro.disconnect();
      this._ro = new ResizeObserver(() => this._fitLabels());
      this._ro.observe($('.ruler'));
    }

    this._modeBtn.addEventListener('click', () => {
      this._mode = this._mode === 'configuration' ? 'exploitation' : 'configuration';
      this._applyMode();
    });
    this._colsEl.addEventListener('pointerdown', (e) => this._down(e));
    this._colsEl.addEventListener('pointermove', (e) => this._move(e));
    this._colsEl.addEventListener('pointerup', (e) => this._up(e));
    this._colsEl.addEventListener('pointercancel', () => this._cancel());
    this._colsEl.addEventListener('click', (e) => {
      const del = e.target.closest('.del');
      if (!del || !this._model) return;
      const blk = del.closest('.blk');
      const list = this._model[DAYS[Number(blk.dataset.d)]];
      list.splice(Number(blk.dataset.i), 1);
      this._renderCols();
      this._save();
    });

    this._applyMode();
    this._updateNow();
    this._fitLabels();
  }

  // Horizontal : n'affiche qu'une heure sur deux ou trois quand la place manque.
  _fitLabels() {
    if (!this._horiz) return;
    const ruler = this.shadowRoot.querySelector('.ruler');
    if (!ruler) return;
    const pph = ruler.clientWidth / 24;
    const k = pph >= 30 ? 1 : pph >= 16 ? 2 : 3;
    ruler.querySelectorAll('.hl').forEach((el, h) => { el.hidden = h % k !== 0; });
  }

  _applyMode() {
    const cfg = this._mode === 'configuration';
    this._card.classList.toggle('config', cfg);
    this._modeBtn.querySelector('span').textContent = cfg ? 'Configuration' : 'Exploitation';
    this._hintEl.textContent = cfg
      ? 'Glissez une plage pour la déplacer, tirez ses bords pour l’ajuster. Glissez dans le vide pour en créer une (un clic = 1 h), × pour supprimer.'
      : 'Lecture seule : passez en Configuration pour modifier les plages.';
  }

  _updateHeader() {
    const st = this._stateObj;
    const name = this._config.name || (st && st.attributes.friendly_name) || this._config.entity;
    this._titleEl.textContent = name;
    this._badgeEl.classList.toggle('on', !!st && st.state === 'on');
    this._badgeEl.textContent = !st ? 'Introuvable' : st.state === 'on' ? 'Actif' : st.state === 'off' ? 'Inactif' : 'Indisponible';
    let sub = '';
    if (st && st.attributes.next_event) {
      const d = new Date(st.attributes.next_event);
      if (!isNaN(d)) {
        sub = 'Prochain changement : ' + d.toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
      }
    }
    this._subEl.textContent = sub;
  }

  _banner(text) {
    this._bannerEl.hidden = !text;
    this._bannerEl.textContent = text || '';
  }

  _status(text, ms = 2500, err = false) {
    clearTimeout(this._stT);
    this._stEl.textContent = text;
    this._stEl.classList.toggle('err', err);
    if (ms) {
      this._stT = setTimeout(() => {
        this._stEl.textContent = '';
        this._stEl.classList.remove('err');
      }, ms);
    }
  }

  _renderCols() {
    this._cols.forEach((col, d) => {
      col.innerHTML = '';
      const list = this._model ? this._model[DAYS[d]] : [];
      list.forEach((r, i) => col.appendChild(this._makeBlock(r, d, i)));
    });
    this._updateNow();
  }

  _makeBlock(r, d, i) {
    const el = document.createElement('div');
    el.className = 'blk';
    el.dataset.d = d;
    el.dataset.i = i;
    el.innerHTML =
      '<div class="h top"></div>' +
      '<span class="t"><span class="a"></span><span class="sep"> – </span><span class="b"></span></span>' +
      '<div class="h bot"></div>' +
      '<button class="del" type="button" title="Supprimer cette plage">×</button>';
    this._place(el, r.from, r.to);
    return el;
  }

  // Position en pourcentage de la journée (0–1440 min), sur l'axe du temps.
  _place(el, s, e) {
    const a = s / 14.4;
    const w = (e - s) / 14.4;
    if (this._horiz) {
      el.style.left = `calc(${a}% + 1px)`;
      el.style.width = `max(2px, calc(${w}% - 2px))`;
    } else {
      el.style.top = `calc(${a}% + 1px)`;
      el.style.height = `max(2px, calc(${w}% - 2px))`;
    }
    el.querySelector('.a').textContent = fmtShort(s);
    el.querySelector('.b').textContent = fmtShort(e);
    el.title = `${fmtShort(s)} – ${fmtShort(e)}`;
  }

  _updateNow() {
    if (!this._cols) return;
    this._cols.forEach((c) => c.querySelectorAll('.now').forEach((n) => n.remove()));
    const now = new Date();
    const d = (now.getDay() + 6) % 7;
    const m = now.getHours() * 60 + now.getMinutes();
    const line = document.createElement('div');
    line.className = 'now';
    line.style[this._horiz ? 'left' : 'top'] = `${m / 14.4}%`;
    this._cols[d].appendChild(line);
    this.shadowRoot.querySelectorAll('.dl').forEach((el, i) => el.classList.toggle('today', i === d));
  }

  /* ------------------------------------------------------------ données */

  _maybeLoad() {
    if (!this._drag) this._load();
  }

  async _load() {
    const token = ++this._loadToken;
    const entity = this._config.entity;
    const st = this._hass && this._hass.states[entity];
    if (!st) {
      this._model = null;
      this._renderCols();
      return this._banner(`Entité introuvable : ${entity}`);
    }
    if (!entity.startsWith('schedule.')) {
      return this._banner('L’entité doit être un helper Planning (schedule.xxx).');
    }
    if (st.attributes.editable === false) {
      return this._banner('Ce planning est défini en YAML : il n’est pas modifiable depuis la carte.');
    }
    try {
      const list = await this._hass.callWS({ type: 'schedule/list' });
      if (token !== this._loadToken || this._drag) return;
      const id = entity.split('.')[1];
      const item = list.find((x) => x.id === id);
      if (!item) {
        this._model = null;
        this._renderCols();
        return this._banner('Planning introuvable dans les helpers (créez-le dans Paramètres → Appareils et services → Entrées).');
      }
      this._id = id;
      this._name = item.name;
      this._icon = item.icon;
      const model = {};
      DAYS.forEach((d) => {
        model[d] = (item[d] || [])
          .map((r) => {
            const { from, to, ...extra } = r;
            return { from: parseTime(from), to: parseTime(to), extra };
          })
          .sort((a, b) => a.from - b.from);
      });
      this._model = model;
      this._banner('');
      this._renderCols();
    } catch (e) {
      this._model = null;
      this._renderCols();
      this._banner('Lecture impossible (compte administrateur requis ?) : ' + (e.message || e.code || e));
    }
  }

  _save() {
    this._chain = this._chain.then(async () => {
      if (!this._model || !this._id) return;
      const payload = { type: 'schedule/update', schedule_id: this._id };
      payload.name = this._name;
      if (this._icon) payload.icon = this._icon;
      DAYS.forEach((d) => {
        payload[d] = this._model[d].map((r) => ({ ...r.extra, from: fmtFull(r.from), to: fmtFull(r.to) }));
      });
      this._status('Enregistrement…', 0);
      try {
        await this._hass.callWS(payload);
        this._status('Enregistré', 2000);
      } catch (e) {
        this._status('Échec de l’enregistrement : ' + (e.message || e.code || e), 7000, true);
        await this._load();
      }
    });
  }

  /* ----------------------------------------------------------- géométrie */

  _snap(v) {
    const s = this._config.step;
    return Math.round(v / s) * s;
  }

  // Minutes (0–1440) sous le pointeur, dans la ligne/colonne du jour `day`.
  _minutesAt(e, day) {
    const r = this._cols[day].getBoundingClientRect();
    return this._horiz
      ? ((e.clientX - r.left) / r.width) * 1440
      : ((e.clientY - r.top) / r.height) * 1440;
  }

  // Jour (colonne ou ligne) sous le pointeur.
  _colAt(e, fallback) {
    const v = this._horiz ? e.clientY : e.clientX;
    const lo = (r) => (this._horiz ? r.top : r.left);
    const hi = (r) => (this._horiz ? r.bottom : r.right);
    for (let i = 0; i < this._cols.length; i++) {
      const r = this._cols[i].getBoundingClientRect();
      if (v >= lo(r) && v < hi(r)) return i;
    }
    if (v < lo(this._cols[0].getBoundingClientRect())) return 0;
    if (v >= hi(this._cols[this._cols.length - 1].getBoundingClientRect())) return this._cols.length - 1;
    return fallback;
  }

  _free(day, s, e, ignore) {
    return !this._model[DAYS[day]].some((o) => o !== ignore && o.from < e && o.to > s);
  }

  _bounds(day, s, e, ignore) {
    let lo = 0;
    let hi = 1440;
    for (const o of this._model[DAYS[day]]) {
      if (o === ignore) continue;
      if (o.to <= s) lo = Math.max(lo, o.to);
      else if (o.from >= e) hi = Math.min(hi, o.from);
    }
    return { lo, hi };
  }

  /* ------------------------------------------------------------- glissés */

  _down(e) {
    if (!this._model || this._mode !== 'configuration') return;
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('.del')) return;
    const step = this._config.step;
    const blk = e.target.closest('.blk');

    if (blk) {
      const d = Number(blk.dataset.d);
      const item = this._model[DAYS[d]][Number(blk.dataset.i)];
      const handle = e.target.closest('.h');
      const b = this._bounds(d, item.from, item.to, item);
      this._drag = {
        kind: handle ? (handle.classList.contains('top') ? 'top' : 'bot') : 'move',
        item, blk, day: d, origDay: d, origFrom: item.from, origTo: item.to,
        grab: this._minutesAt(e, d) - item.from,
        lo: b.lo, hi: b.hi, x0: e.clientX, y0: e.clientY, moved: false,
      };
      blk.classList.add('drag');
    } else if (this._mode === 'configuration') {
      const col = e.target.closest('.col');
      if (!col) return;
      const d = Number(col.dataset.d);
      const pm = this._minutesAt(e, d);
      const anchor = Math.max(0, Math.min(1440 - step, Math.floor(pm / step) * step));
      const b = this._bounds(d, anchor, anchor + step, null);
      const ghost = document.createElement('div');
      ghost.className = 'blk ghost';
      ghost.innerHTML = '<span class="t"><span class="a"></span><span class="sep"> – </span><span class="b"></span></span>';
      col.appendChild(ghost);
      this._place(ghost, anchor, anchor + step);
      this._drag = {
        kind: 'create', day: d, anchor, ghost, lo: b.lo, hi: b.hi,
        x0: e.clientX, y0: e.clientY, moved: false,
      };
    } else {
      return;
    }
    try { this._colsEl.setPointerCapture(e.pointerId); } catch (_) { /* ignoré */ }
    e.preventDefault();
  }

  _move(e) {
    const dr = this._drag;
    if (!dr) return;
    const step = this._config.step;
    if (Math.abs(e.clientX - dr.x0) + Math.abs(e.clientY - dr.y0) > 3) dr.moved = true;

    if (dr.kind === 'move') {
      const len = dr.item.to - dr.item.from;
      const td = this._colAt(e, dr.day);
      let s = this._snap(this._minutesAt(e, td) - dr.grab);
      s = Math.max(0, Math.min(1440 - len, s));
      if (td !== dr.day && this._free(td, s, s + len, dr.item)) {
        dr.day = td;
        const b = this._bounds(td, s, s + len, dr.item);
        dr.lo = b.lo;
        dr.hi = b.hi;
        this._cols[td].appendChild(dr.blk);
      }
      s = Math.max(dr.lo, Math.min(dr.hi - len, s));
      dr.s = s;
      dr.e = s + len;
    } else if (dr.kind === 'bot') {
      const end = this._snap(this._minutesAt(e, dr.day));
      dr.s = dr.item.from;
      dr.e = Math.max(dr.item.from + step, Math.min(dr.hi, end));
    } else if (dr.kind === 'top') {
      const start = this._snap(this._minutesAt(e, dr.day));
      dr.s = Math.min(dr.item.to - step, Math.max(dr.lo, start));
      dr.e = dr.item.to;
    } else if (dr.kind === 'create') {
      const pm = this._minutesAt(e, dr.day);
      const p = Math.max(0, Math.min(1440 - step, Math.floor(pm / step) * step));
      let s = p >= dr.anchor ? dr.anchor : p;
      let en = p >= dr.anchor ? p + step : dr.anchor + step;
      s = Math.max(dr.lo, s);
      en = Math.min(dr.hi, en);
      if (en - s < step) return;
      dr.s = s;
      dr.e = en;
      this._place(dr.ghost, s, en);
      return;
    }
    this._place(dr.blk, dr.s, dr.e);
  }

  _up(e) {
    const dr = this._drag;
    if (!dr) return;
    this._drag = null;
    try { this._colsEl.releasePointerCapture(e.pointerId); } catch (_) { /* ignoré */ }
    const step = this._config.step;
    let changed = false;

    if (dr.kind === 'create') {
      let s = dr.anchor;
      let en;
      if (dr.moved && dr.s !== undefined) {
        s = dr.s;
        en = dr.e;
      } else {
        en = Math.min(dr.hi, dr.anchor + 60);
      }
      if (en - s >= step && this._free(dr.day, s, en, null)) {
        const list = this._model[DAYS[dr.day]];
        list.push({ from: s, to: en, extra: {} });
        list.sort((a, b) => a.from - b.from);
        changed = true;
      }
    } else if (dr.s !== undefined && (dr.s !== dr.origFrom || dr.e !== dr.origTo || dr.day !== dr.origDay)) {
      const src = this._model[DAYS[dr.origDay]];
      src.splice(src.indexOf(dr.item), 1);
      dr.item.from = dr.s;
      dr.item.to = dr.e;
      const dst = this._model[DAYS[dr.day]];
      dst.push(dr.item);
      dst.sort((a, b) => a.from - b.from);
      changed = true;
    }

    this._renderCols();
    if (changed) this._save();
  }

  _cancel() {
    if (!this._drag) return;
    this._drag = null;
    this._renderCols();
  }
}

class PlanningSemaineHorizontalCard extends PlanningSemaineCard {
  static get defaultOrientation() {
    return 'horizontal';
  }
}

/* ------------------------------------------------------- éditeur visuel */

class PlanningSemaineCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
  }

  _render() {
    if (!this._form) {
      this._form = document.createElement('ha-form');
      this._form.computeLabel = (s) => ({
        entity: 'Planning (helper schedule)',
        name: 'Titre (optionnel)',
        orientation: 'Orientation',
        step: 'Pas du glissé (minutes)',
        hour_height: 'Vertical : hauteur d’une heure (px)',
        row_height: 'Horizontal : hauteur d’une ligne (px)',
        hour_width: 'Horizontal : largeur minimale d’une heure (px)',
        color: 'Couleur des plages (ex. #ff9800)',
        hide_config_button: 'Masquer le bouton Configuration',
      }[s.name] || s.name);
      this._form.schema = [
        { name: 'entity', required: true, selector: { entity: { domain: 'schedule' } } },
        { name: 'name', selector: { text: {} } },
        {
          name: 'orientation',
          selector: {
            select: {
              mode: 'dropdown',
              options: [
                { value: 'vertical', label: 'Vertical (jours en colonnes)' },
                { value: 'horizontal', label: 'Horizontal (jours en lignes)' },
              ],
            },
          },
        },
        { name: 'step', selector: { number: { min: 5, max: 60, step: 5, mode: 'box' } } },
        { name: 'hour_height', selector: { number: { min: 16, max: 80, step: 2, mode: 'box' } } },
        { name: 'row_height', selector: { number: { min: 24, max: 100, step: 2, mode: 'box' } } },
        { name: 'hour_width', selector: { number: { min: 10, max: 80, step: 2, mode: 'box' } } },
        { name: 'color', selector: { text: {} } },
        { name: 'hide_config_button', selector: { boolean: {} } },
      ];
      this._form.addEventListener('value-changed', (ev) => {
        ev.stopPropagation();
        this._config = ev.detail.value;
        this.dispatchEvent(new CustomEvent('config-changed', {
          detail: { config: this._config }, bubbles: true, composed: true,
        }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
  }
}

customElements.define('planning-semaine-card', PlanningSemaineCard);
customElements.define('planning-semaine-horizontal-card', PlanningSemaineHorizontalCard);
customElements.define('planning-semaine-card-editor', PlanningSemaineCardEditor);

window.customCards = window.customCards || [];
window.customCards.push(
  {
    type: 'planning-semaine-card',
    name: 'Planning hebdomadaire (vertical)',
    description: 'Semaine en colonnes, heures de haut en bas : plages modifiables par glissé (helper Planning).',
  },
  {
    type: 'planning-semaine-horizontal-card',
    name: 'Planning hebdomadaire (horizontal)',
    description: 'Semaine en lignes, heures de gauche à droite : plages modifiables par glissé (helper Planning).',
  }
);

console.info('%c PLANNING-SEMAINE-CARD %c v1.2.0 ', 'background:#03a9f4;color:#fff', 'background:#444;color:#fff');
