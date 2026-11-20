/* Klik Tools — shared control layer (pairs with ui.css).
   Upgrades the studios' existing controls in place, without touching their logic:
   - slider rows: drag anywhere on the row, click the number to type it, double-click to reset,
     Shift for fine steps, dots for stepped ranges;
   - sections fold, show a dot when something inside left its default, and reset on their own;
   - "Search controls" across every tab of the panel;
   - short selects become segmented switches, hex codes can be typed, switch rows toggle on click.
   The native <input>/<select> stay in the DOM and still fire input/change, so each studio keeps working.
   A control's "default" is the value it had when the user first touched the page (so a studio's own
   start-up preset or restored session counts as the baseline); data-default="…" on a control overrides it.
   <script src="ui.js" data-toolbar="0"> hides the search bar. */
(function(){
  "use strict";
  if (window.KlikUI) return;
  var doc = document, root = doc.documentElement;
  var OPT = (doc.currentScript && doc.currentScript.dataset) || {};
  var PAD = 9;
  var lang = "en";
  try { lang = localStorage.getItem("klikLang") || "en"; } catch (e) {}
  var T = ({
    uk: { search:"Пошук налаштувань", none:"Немає налаштування з такою назвою", reset:"Скинути", resetSec:"Скинути розділ", fold:"Згорнути всі розділи", unfold:"Розгорнути всі розділи", clear:"Очистити" },
    ru: { search:"Поиск настроек", none:"Нет настройки с таким названием", reset:"Сбросить", resetSec:"Сбросить раздел", fold:"Свернуть все разделы", unfold:"Развернуть все разделы", clear:"Очистить" }
  })[lang] || { search:"Search controls", none:"No control with that name", reset:"Reset", resetSec:"Reset section", fold:"Fold all sections", unfold:"Unfold all sections", clear:"Clear" };
  var TOOL = (location.pathname.split("/").pop() || "tool").replace(/\.html?$/, "");
  var SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">';
  var ICON = {
    rst: SVG + '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4v5h5"/></svg>',
    chev: SVG + '<path d="M6 9l6 6 6-6"/></svg>',
    search: SVG + '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>',
    x: SVG + '<path d="M6 6l12 12M18 6L6 18"/></svg>',
    fold: SVG + '<path d="M7 5l5 5 5-5"/><path d="M7 19l5-5 5 5"/></svg>',
    unfold: SVG + '<path d="M7 9l5-5 5 5"/><path d="M7 15l5 5 5-5"/></svg>'
  };

  function num(v, d){ v = parseFloat(v); return isFinite(v) ? v : d; }
  function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
  function dec(x){ var s = String(x); if (s.indexOf("e-") > 0) return +s.split("e-")[1]; var i = s.indexOf("."); return i < 0 ? 0 : s.length - i - 1; }
  function fire(node, type){ node.dispatchEvent(new Event(type, { bubbles:true })); }
  function mk(tag, cls, html){ var n = doc.createElement(tag); if (cls) n.className = cls; if (html) n.innerHTML = html; return n; }
  function stop(e){ e.stopPropagation(); }
  function hook(node, proto, prop, cb){
    var d = Object.getOwnPropertyDescriptor(proto, prop);
    if (!d || !d.set) return;
    try {
      Object.defineProperty(node, prop, { configurable:true, enumerable:d.enumerable,
        get:function(){ return d.get.call(this); },
        set:function(v){ d.set.call(this, v); cb(); } });
    } catch (e) {}
  }
  function rstBtn(title, cls){
    var b = mk("button", "ui-rst" + (cls ? " " + cls : ""), ICON.rst);
    b.type = "button"; b.title = title; b.setAttribute("aria-label", title); b.tabIndex = -1;
    return b;
  }
  function store(key, val){
    try {
      var k = "klikUI." + TOOL + "." + key;
      if (val === undefined) return JSON.parse(localStorage.getItem(k) || "null");
      localStorage.setItem(k, JSON.stringify(val));
    } catch (e) {}
    return null;
  }

  var CT = [];              /* every enhanced control */
  var frozen = false;
  function freeze(){
    if (frozen) return;
    frozen = true;
    for (var i = 0; i < CT.length; i++) if (CT[i].def == null && CT[i].grab){ CT[i].grab(); CT[i].sync(true); }
  }
  ["pointerdown", "keydown", "touchstart"].forEach(function(t){
    doc.addEventListener(t, function(e){ if (e.isTrusted) freeze(); }, true);
  });
  var pending = false;
  function touch(){ if (!pending){ pending = true; setTimeout(flush, 0); } }
  function flush(){
    pending = false;
    var alive = [], mods = [];
    for (var i = 0; i < CT.length; i++){
      var st = CT[i];
      if (!st.el.isConnected) continue;
      alive.push(st);
      if (st.mod && st.group && mods.indexOf(st.group) < 0) mods.push(st.group);
    }
    CT = alive;
    var secs = doc.querySelectorAll(".group.ui-sec");
    for (var j = 0; j < secs.length; j++) secs[j].classList.toggle("ui-secmod", mods.indexOf(secs[j]) >= 0);
  }

  /* ───────── sliders ───────── */
  function mkRange(inp){
    var st = { type:"range", el:inp, row:null, lbl:null, val:null, mode:"mini", group:inp.closest(".group"), mod:false, def:null, ticks:"" };
    inp._kui = st;
    var prev = inp.previousElementSibling, par = inp.parentElement;
    if (prev && prev.matches(".row,.kfx-row") && !prev._kui && !prev.querySelector("input,select,textarea,button:not(.ui-rst)")) { st.row = prev; st.mode = "row"; }
    else if (par && par.matches(".row") && !par._kui && par.querySelectorAll("input,select,textarea,button:not(.ui-rst)").length === 1) { st.row = par; st.mode = "in"; }
    st.def = inp.hasAttribute("data-default") ? inp.getAttribute("data-default") : null;
    st.grab = function(){ st.def = inp.value; };

    st.snap = function(v){
      var mn = num(inp.min, 0), mx = num(inp.max, 100), sp = inp.step === "any" ? 0 : num(inp.step, 1);
      v = clamp(v, mn, mx);
      if (sp > 0){
        v = mn + Math.round((v - mn) / sp) * sp;
        if (v > mx + 1e-9) v -= sp;
        v = +v.toFixed(Math.min(10, Math.max(dec(sp), dec(mn))));
      }
      return v;
    };
    st.apply = function(v){
      freeze();
      v = st.snap(v);
      if (+inp.value === v) return false;
      inp.value = String(v);
      fire(inp, "input");
      return true;
    };
    st.reset = function(){
      if (st.def == null) return;
      var before = inp.value;
      inp.value = st.def;
      if (inp.value !== before){ fire(inp, "input"); fire(inp, "change"); }
    };
    st.text = function(){ return st.lbl ? st.lbl.textContent : ""; };
    st.els = function(){ return st.mode === "row" ? [st.row, inp] : st.row ? [st.row] : []; };

    if (st.row){
      var row = st.row; row._kui = st;
      var old = row.querySelectorAll(".ui-rst"); for (var o = 0; o < old.length; o++) old[o].remove();
      st.val = row.querySelector(".val,.kfx-val");
      st.lbl = row.querySelector(".lbl") || row.querySelector("label") || (row.firstElementChild !== st.val ? row.firstElementChild : null);
      if (!st.val){ st.val = mk("span", "val ui-own"); row.appendChild(st.val); }
      st.own = st.val.classList.contains("ui-own");
      if (st.lbl) st.lbl.classList.add("ui-lbl");
      st.val.classList.add("ui-val");
      row.classList.add("ui-sl-row"); if (st.mode === "in") row.classList.add("ui-sl-in");
      inp.classList.add("ui-sl");
      st.rst = rstBtn(T.reset); row.insertBefore(st.rst, st.val);
      bindSlider(st);
    } else inp.classList.add("ui-mini");

    var last = "";
    st.sync = function(force){
      var mn = num(inp.min, 0), mx = num(inp.max, 100), v = num(inp.value, mn), sp = inp.step;
      var key = mn + "|" + mx + "|" + sp + "|" + v + "|" + inp.disabled;
      if (key === last && !force) return;
      last = key;
      var pn = mx > mn ? clamp((v - mn) / (mx - mn), 0, 1) : 0;
      inp.style.setProperty("--pn", pn.toFixed(4));
      if (!st.row) return;
      if (st.own) st.val.textContent = inp.value;
      var s = sp === "any" ? 0 : num(sp, 1), n = s > 0 ? (mx - mn) / s : 0, ticks = "";
      if (n >= 2 && n <= 12 && Math.abs(n - Math.round(n)) < 1e-6){
        n = Math.round(n);
        var parts = [];
        for (var i = 1; i < n; i++){
          if (i / n <= pn + 1e-4) continue;
          parts.push("radial-gradient(circle at calc(var(--ui-pad) + (100% - var(--ui-pad) * 2) * " + (i / n).toFixed(4) +
            ") 50%,rgba(255,255,255,.32) 0,rgba(255,255,255,.32) 1.3px,transparent 1.9px)");
        }
        ticks = parts.join(",");
      }
      if (ticks !== st.ticks){
        st.ticks = ticks;
        if (ticks) inp.style.setProperty("--ui-ticks", ticks); else inp.style.removeProperty("--ui-ticks");
      }
      st.row.classList.toggle("ui-off", inp.disabled);
      var mod = st.def != null && Math.abs(v - st.snap(num(st.def, v))) > 1e-9;
      if (mod !== st.mod){ st.mod = mod; st.row.classList.toggle("ui-mod", mod); touch(); }
    };
    var syn = function(){ st.sync(); };
    hook(inp, HTMLInputElement.prototype, "value", syn);
    hook(inp, HTMLInputElement.prototype, "valueAsNumber", syn);
    inp.addEventListener("input", syn);
    inp.addEventListener("change", syn);
    return st;
  }

  function bindSlider(st){
    var inp = st.el, row = st.row, drag = null;
    function geom(){ var r = inp.getBoundingClientRect(); return { l:r.left + PAD, w:Math.max(1, r.width - PAD * 2) }; }
    function overVal(e){
      var r = st.val.getBoundingClientRect();
      return r.width > 0 && e.clientX >= r.left - 4 && e.clientX <= r.right + 8 && e.clientY >= r.top - 9 && e.clientY <= r.bottom + 9;
    }
    function hot(on){ if (on !== !!st.hot){ st.hot = on; row.classList.toggle("ui-val-hot", on); } }

    function openEdit(){
      if (st.ed || inp.disabled) return;
      var ed = mk("input", "ui-edit");
      ed.type = "text"; ed.inputMode = "decimal"; ed.autocomplete = "off"; ed.spellcheck = false;
      ed.value = inp.value; ed.setAttribute("aria-label", st.text());
      row.appendChild(ed); st.ed = ed; row.classList.add("ui-editing"); hot(false);
      ed.focus(); ed.select();
      function close(commit){
        if (!st.ed) return;
        st.ed = null;
        var raw = ed.value;
        row.classList.remove("ui-editing"); ed.remove();
        if (!commit) return;
        var v = parseFloat(raw.replace(",", ".").replace(/[^\d.eE+-]/g, ""));
        if (!isFinite(v)) return;
        var before = +inp.value;
        st.apply(v);
        if (+inp.value !== before) fire(inp, "change");
      }
      ed.addEventListener("keydown", function(e){
        e.stopPropagation();
        if (e.key === "Enter"){ e.preventDefault(); close(true); try { inp.focus({ preventScroll:true }); } catch (_) {} }
        else if (e.key === "Escape"){ e.preventDefault(); close(false); try { inp.focus({ preventScroll:true }); } catch (_) {} }
        else if (e.key === "ArrowUp" || e.key === "ArrowDown"){
          e.preventDefault();
          var sp = inp.step === "any" ? (num(inp.max, 100) - num(inp.min, 0)) / 100 : num(inp.step, 1);
          var cur = parseFloat(ed.value.replace(",", ".")); if (!isFinite(cur)) cur = +inp.value;
          st.apply(cur + (e.key === "ArrowUp" ? 1 : -1) * sp * (e.shiftKey ? 10 : 1));
          ed.value = inp.value; ed.select();
        }
      });
      ed.addEventListener("keyup", stop);
      ed.addEventListener("keypress", stop);
      ed.addEventListener("blur", function(){ close(true); });
    }

    row.addEventListener("pointerdown", function(e){
      if (e.button || inp.disabled || st.ed) return;
      if (e.target.closest(".ui-rst,.ui-edit")) return;
      freeze();
      var touchP = e.pointerType === "touch", g = geom(), mn = num(inp.min, 0), mx = num(inp.max, 100);
      drag = { id:e.pointerId, x0:e.clientX, v0:+inp.value, g:g, mn:mn, mx:mx, moved:false, live:false, touch:touchP,
               onVal:overVal(e), shift:e.shiftKey, ax:e.clientX, av:+inp.value, cur:+inp.value };
      if (!touchP){ e.preventDefault(); try { inp.focus({ preventScroll:true }); } catch (_) {} }
      try { row.setPointerCapture(e.pointerId); } catch (_) {}
      if (!touchP && !drag.onVal && !e.shiftKey){
        drag.live = true;
        drag.av = drag.cur = mn + clamp((e.clientX - g.l) / g.w, 0, 1) * (mx - mn);
        inp.classList.add("ui-drag");
        st.apply(drag.cur);
      }
    });
    row.addEventListener("pointermove", function(e){
      if (!drag){ hot(!inp.disabled && !st.ed && overVal(e)); return; }
      if (e.pointerId !== drag.id) return;
      if (!drag.moved){
        if (Math.abs(e.clientX - drag.x0) < (drag.touch ? 6 : 3)) return;
        drag.moved = true;
      }
      if (!drag.live){
        drag.live = true; drag.ax = e.clientX; drag.av = drag.cur = +inp.value; drag.shift = e.shiftKey;
        inp.classList.add("ui-drag"); hot(false);
      }
      if (e.shiftKey !== drag.shift){ drag.shift = e.shiftKey; drag.ax = e.clientX; drag.av = drag.cur; }
      drag.cur = clamp(drag.av + (e.clientX - drag.ax) / drag.g.w * (drag.mx - drag.mn) * (drag.shift ? 0.1 : 1), drag.mn, drag.mx);
      st.apply(drag.cur);
    });
    function end(e, cancelled){
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag; drag = null;
      try { row.releasePointerCapture(e.pointerId); } catch (_) {}
      inp.classList.remove("ui-drag");
      if (!cancelled && !d.moved){
        if (d.onVal){ openEdit(); return; }
        if (d.touch) st.apply(d.mn + clamp((e.clientX - d.g.l) / d.g.w, 0, 1) * (d.mx - d.mn));
      }
      if (+inp.value !== d.v0) fire(inp, "change");
    }
    row.addEventListener("pointerup", function(e){ end(e, false); });
    row.addEventListener("pointercancel", function(e){ end(e, true); });
    row.addEventListener("pointerleave", function(){ if (!drag) hot(false); });
    row.addEventListener("dblclick", function(e){
      if (e.target.closest(".ui-rst,.ui-edit") || overVal(e)) return;
      st.reset();
    });
    st.rst.addEventListener("click", function(e){ e.stopPropagation(); st.reset(); });
    inp.addEventListener("keydown", function(e){ if (e.key === "Enter"){ e.preventDefault(); openEdit(); } });
    st.edit = openEdit;
  }

  /* ───────── switches ───────── */
  function mkCheck(cb){
    var row = cb.closest(".switch-row,label.check");
    var st = { type:"check", el:cb, row:row, group:cb.closest(".group"), mod:false };
    cb._kui = st;
    st.def = cb.hasAttribute("data-default") ? /^(1|true|on)$/.test(cb.getAttribute("data-default")) : null;
    st.grab = function(){ st.def = cb.checked; };
    st.sync = function(){
      var mod = st.def != null && cb.checked !== st.def;
      if (mod !== st.mod){ st.mod = mod; touch(); }
    };
    st.reset = function(){
      if (st.def == null || cb.checked === st.def) return;
      cb.checked = st.def; fire(cb, "input"); fire(cb, "change");
    };
    st.text = function(){ return row ? row.textContent : ""; };
    st.els = function(){ return row ? [row] : []; };
    var syn = function(){ st.sync(); };
    hook(cb, HTMLInputElement.prototype, "checked", syn);
    cb.addEventListener("input", syn);
    cb.addEventListener("change", syn);
    return st;
  }
  doc.addEventListener("click", function(e){
    var r = e.target.closest && e.target.closest(".switch-row,.row,.kfx-sw");
    if (!r || r._kui || e.target.closest("label.switch,label.sw,label.kfx-tgl,input,button,a,select,textarea")) return;
    var cbs = r.querySelectorAll("label.switch input[type=checkbox],label.sw input[type=checkbox],label.kfx-tgl input[type=checkbox]");
    if (cbs.length === 1 && !cbs[0].disabled && r.querySelectorAll("input,select,textarea").length === 1) cbs[0].click();
  });

  /* ───────── selects (label on the left of the same row; short lists → segmented) ───────── */
  function mkSelect(sel){
    var st = { type:"select", el:sel, row:null, lbl:null, seg:null, group:sel.closest(".group"), mod:false, def:null };
    sel._kui = st;
    var prev = sel.previousElementSibling;
    if (!sel.multiple && !sel.closest(".plate,.stage-bar,.fui,.stoprow") &&
        prev && prev.matches(".row,.kfx-row") && !prev._kui && !prev.querySelector("input,select,textarea,button,.val,.kfx-val")){
      st.row = prev; prev._kui = st;
      st.lbl = prev.querySelector(".lbl,label") || prev.firstElementChild;
      prev.classList.add("ui-sel-row");
      if (st.lbl) st.lbl.classList.add("ui-lbl");
      sel.classList.add("ui-sel");
      if (st.lbl && window.ResizeObserver){
        new ResizeObserver(function(){ var w = st.lbl.offsetWidth; if (w) sel.style.setProperty("--ui-lw", w + "px"); }).observe(st.lbl);
      }
    }
    st.grab = function(){ st.def = sel.options.length ? sel.selectedIndex : null; };
    function segOK(){
      var o = sel.options, tot = 0;
      if (!st.row || o.length < 2 || o.length > 4) return false;
      for (var i = 0; i < o.length; i++){
        var t = o[i].textContent.trim();
        if (!t || t.length > 8) return false;
        tot += t.length;
      }
      return tot <= 14;
    }
    st.rebuild = function(){
      if (st.seg){ st.seg.remove(); st.seg = null; }
      if (!st.row) return;
      var ok = segOK();
      sel.classList.toggle("ui-native-hide", ok);
      st.row.classList.toggle("ui-seg-row", ok);
      if (ok){
        var box = mk("div", "ui-seg"), inn = mk("div", "ui-seg-in");
        box.setAttribute("role", "radiogroup"); box.appendChild(inn);
        for (var i = 0; i < sel.options.length; i++){
          var b = mk("button"); b.type = "button"; b.textContent = sel.options[i].textContent.trim();
          b.setAttribute("data-i", i); b.setAttribute("role", "radio"); inn.appendChild(b);
        }
        inn.addEventListener("click", function(e){
          var b = e.target.closest("button"); if (!b || sel.disabled) return;
          var i = +b.getAttribute("data-i");
          if (sel.selectedIndex === i) return;
          sel.selectedIndex = i; fire(sel, "input"); fire(sel, "change");
        });
        sel.parentNode.insertBefore(box, sel.nextSibling);
        st.seg = box;
      }
      st.sync(true);
    };
    st.sync = function(){
      if (st.seg){
        var bs = st.seg.querySelectorAll("button");
        for (var i = 0; i < bs.length; i++){
          var on = i === sel.selectedIndex;
          bs[i].classList.toggle("ui-on", on); bs[i].setAttribute("aria-checked", on ? "true" : "false");
        }
      }
      var mod = st.def != null && sel.selectedIndex !== st.def;
      if (mod !== st.mod){ st.mod = mod; touch(); }
    };
    st.reset = function(){
      if (st.def == null || sel.selectedIndex === st.def) return;
      sel.selectedIndex = st.def; fire(sel, "input"); fire(sel, "change");
    };
    st.text = function(){ return st.lbl ? st.lbl.textContent : ""; };
    st.els = function(){ var a = []; if (st.row) a.push(st.row, sel); if (st.seg) a.push(st.seg); return a; };
    var syn = function(){ st.sync(); };
    hook(sel, HTMLSelectElement.prototype, "value", syn);
    hook(sel, HTMLSelectElement.prototype, "selectedIndex", syn);
    sel.addEventListener("input", syn);
    sel.addEventListener("change", syn);
    st.rebuild();
    return st;
  }

  /* ───────── colours ───────── */
  function mkColor(c){
    var field = c.closest(".color-field"), wrap = c.closest(".color-wrap");
    var st = { type:"color", el:c, row:field, group:c.closest(".group"), mod:false };
    c._kui = st;
    st.def = c.hasAttribute("data-default") ? c.getAttribute("data-default") : null;
    st.grab = function(){ st.def = c.value; };
    if (st.def && /^#[0-9a-f]{3}$/i.test(st.def)) st.def = "#" + st.def.slice(1).replace(/./g, "$&$&");
    st.sync = function(){
      var mod = st.def != null && c.value.toLowerCase() !== String(st.def).toLowerCase();
      if (mod !== st.mod){ st.mod = mod; touch(); }
    };
    st.reset = function(){
      if (st.def == null || !st.mod) return;
      c.value = st.def; fire(c, "input"); fire(c, "change");
    };
    st.text = function(){ var s = field && field.querySelector("span"); return s ? s.textContent : ""; };
    st.els = function(){ return field ? [field] : []; };
    var syn = function(){ st.sync(); };
    hook(c, HTMLInputElement.prototype, "value", syn);
    c.addEventListener("input", syn);
    c.addEventListener("change", syn);

    var hex = wrap && wrap.querySelector(".hex");
    if (hex && !hex._kui){
      hex._kui = 1;
      hex.addEventListener("click", function(e){
        e.stopPropagation(); e.preventDefault();
        if (st.ed || c.disabled) return;
        var ed = mk("input", "ui-edit ui-edit-hex");
        ed.type = "text"; ed.maxLength = 9; ed.spellcheck = false; ed.autocomplete = "off"; ed.value = c.value.toUpperCase();
        hex.style.display = "none"; hex.parentNode.insertBefore(ed, hex.nextSibling); st.ed = ed;
        ed.focus(); ed.select();
        function close(commit){
          if (!st.ed) return;
          st.ed = null;
          var raw = ed.value.trim().replace(/^#/, "");
          ed.remove(); hex.style.display = "";
          if (!commit) return;
          if (/^[0-9a-f]{3}$/i.test(raw)) raw = raw.replace(/./g, "$&$&");
          if (!/^[0-9a-f]{6}$/i.test(raw)) return;
          var v = "#" + raw.toLowerCase();
          if (c.value.toLowerCase() === v) return;
          c.value = v; fire(c, "input"); fire(c, "change");
        }
        ed.addEventListener("click", stop);
        ed.addEventListener("keydown", function(ev){
          ev.stopPropagation();
          if (ev.key === "Enter"){ ev.preventDefault(); close(true); }
          else if (ev.key === "Escape"){ ev.preventDefault(); close(false); }
        });
        ed.addEventListener("keyup", stop);
        ed.addEventListener("keypress", stop);
        ed.addEventListener("blur", function(){ close(true); });
      });
    }
    if (field && !field._kuiCols){
      /* narrow grids (3+ columns) stack the swatch above the name */
      field._kuiCols = 1;
      var gp = field.parentElement, cols = 1;
      if (gp){
        var tpl = getComputedStyle(gp).gridTemplateColumns || "", rp = /repeat\(\s*(\d+)/.exec(tpl);
        cols = rp ? +rp[1] : tpl === "none" ? 1 : tpl.replace(/\([^)]*\)/g, "x").trim().split(/\s+/).length;
      }
      field.classList.toggle("ui-stack", cols >= 3);
      field.classList.toggle("ui-stack4", cols >= 4);
    }
    if (field && !field._kui && field.tagName !== "LABEL"){
      field._kui = 1;
      field.addEventListener("click", function(e){
        if (e.target.closest("input,.hex,button,label,a")) return;
        var first = field.querySelector("input[type=color]");
        if (first && !first.disabled) first.click();
      });
    }
    return st;
  }

  /* ───────── sections ───────── */
  var secState = store("sec") || {};
  function secKey(g){
    var pane = g.closest("[data-pane]"), scope = pane || g.parentNode, n = 0;
    var all = scope.querySelectorAll(".group");
    for (var i = 0; i < all.length; i++){ if (all[i] === g) break; n++; }
    return (pane ? pane.getAttribute("data-pane") : "") + "/" + n;
  }
  function mkSection(g){
    g._kuiSec = 1;
    var h = null;
    for (var i = 0; i < g.children.length; i++) if (g.children[i].tagName === "H2"){ h = g.children[i]; break; }
    if (!h || h.querySelector("button,input,select,a")) return;
    g.classList.add("ui-sec"); h.classList.add("ui-sec-h");
    h.setAttribute("role", "button"); h.tabIndex = 0;
    var rst = rstBtn(T.resetSec, "ui-sec-rst");
    h.appendChild(mk("span", "ui-dot"));
    h.appendChild(mk("span", "ui-sp"));
    h.appendChild(rst);
    h.appendChild(mk("span", "ui-chev", ICON.chev));
    var key = secKey(g), keep = !g.querySelector("canvas,video,iframe");
    function set(collapsed, save){
      g.classList.toggle("ui-collapsed", collapsed);
      h.setAttribute("aria-expanded", collapsed ? "false" : "true");
      if (save && keep){ if (collapsed) secState[key] = 1; else delete secState[key]; store("sec", secState); }
    }
    g._kuiSet = set;
    set(keep && !!secState[key], false);
    h.addEventListener("click", function(e){
      if (e.target.closest(".ui-rst")) return;
      set(!g.classList.contains("ui-collapsed"), true);
      syncFold();
    });
    h.addEventListener("keydown", function(e){
      if (e.target !== h) return;
      if (e.key === "Enter" || e.key === " "){ e.preventDefault(); h.click(); }
    });
    rst.addEventListener("click", function(e){
      e.stopPropagation();
      for (var i = 0; i < CT.length; i++) if (CT[i].group === g && CT[i].mod && CT[i].reset) CT[i].reset();
    });
  }

  /* ───────── panel bar: search + fold all ───────── */
  var bar = null, panel = null, foldBtn = null, searchIn = null, emptyMsg = null;
  function syncFold(){
    if (!foldBtn) return;
    var secs = doc.querySelectorAll(".group.ui-sec"), open = 0;
    for (var i = 0; i < secs.length; i++) if (!secs[i].classList.contains("ui-collapsed")) open++;
    var allShut = secs.length > 0 && open === 0;
    foldBtn.innerHTML = allShut ? ICON.unfold : ICON.fold;
    foldBtn.title = allShut ? T.unfold : T.fold;
    foldBtn.setAttribute("aria-label", foldBtn.title);
    foldBtn._shut = allShut;
  }
  function mkBar(){
    if (bar || OPT.toolbar === "0") return;
    panel = doc.querySelector(".panel");
    if (!panel) return;
    var n = 0;
    for (var i = 0; i < CT.length; i++) if (CT[i].row && panel.contains(CT[i].el)) n++;
    if (n < 12) return;
    bar = mk("div", "ui-bar");
    var box = mk("div", "ui-search", ICON.search);
    searchIn = mk("input"); searchIn.type = "text"; searchIn.placeholder = T.search; searchIn.autocomplete = "off"; searchIn.spellcheck = false;
    searchIn.setAttribute("aria-label", T.search);
    var clr = mk("button", "", ICON.x); clr.type = "button"; clr.title = T.clear; clr.setAttribute("aria-label", T.clear);
    box.appendChild(searchIn); box.appendChild(clr);
    foldBtn = mk("button", "ui-bar-btn"); foldBtn.type = "button";
    bar.appendChild(box); bar.appendChild(foldBtn);
    emptyMsg = mk("div", "ui-empty"); emptyMsg.textContent = T.none;
    panel.appendChild(emptyMsg);
    panel.insertBefore(bar, panel.firstChild);
    searchIn.addEventListener("input", function(){ box.classList.toggle("ui-has", !!searchIn.value); runSearch(searchIn.value); });
    searchIn.addEventListener("keydown", function(e){
      e.stopPropagation();
      if (e.key === "Escape"){ searchIn.value = ""; box.classList.remove("ui-has"); runSearch(""); searchIn.blur(); }
    });
    searchIn.addEventListener("keyup", stop);
    searchIn.addEventListener("keypress", stop);
    clr.addEventListener("click", function(){ searchIn.value = ""; box.classList.remove("ui-has"); runSearch(""); searchIn.focus(); });
    foldBtn.addEventListener("click", function(){
      var shut = !foldBtn._shut, secs = doc.querySelectorAll(".group.ui-sec");
      for (var i = 0; i < secs.length; i++) if (secs[i]._kuiSet) secs[i]._kuiSet(shut, true);
      syncFold();
    });
    doc.addEventListener("keydown", function(e){
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t.type !== "range" && t.type !== "checkbox")) return;
      if (!bar.offsetParent) return;
      e.preventDefault(); searchIn.focus(); searchIn.select();
    });
    syncFold();
  }
  function runSearch(q){
    q = (q || "").trim().toLowerCase();
    var old = panel.querySelectorAll(".ui-miss");
    for (var i = 0; i < old.length; i++) old[i].classList.remove("ui-miss");
    root.classList.toggle("ui-searching", !!q);
    emptyMsg.classList.remove("ui-show");
    if (!q) return;
    var items = [], hits = [], boxes = [], any = false;
    for (i = 0; i < CT.length; i++){
      var st = CT[i];
      if (!st.el.isConnected || !panel.contains(st.el)) continue;
      var els = st.els(); if (!els.length) continue;
      var h2 = st.group && st.group.querySelector("h2");
      var hit = (st.text() || "").toLowerCase().indexOf(q) >= 0 || (h2 && h2.textContent.toLowerCase().indexOf(q) >= 0);
      for (var k = 0; k < els.length; k++){
        items.push(els[k]); if (hit) hits.push(els[k]);
        for (var p = els[k].parentNode; p && p !== panel; p = p.parentNode) if (boxes.indexOf(p) < 0) boxes.push(p);
      }
    }
    function visit(node){
      if (items.indexOf(node) >= 0) return hits.indexOf(node) >= 0;
      if (boxes.indexOf(node) < 0) return false;
      var keep = false, kids = node.children, heads = [];
      for (var c = 0; c < kids.length; c++){
        var kid = kids[c];
        if (kid.tagName === "H2"){ heads.push(kid); continue; }
        if (visit(kid)) keep = true; else kid.classList.add("ui-miss");
      }
      return keep;
    }
    for (i = 0; i < panel.children.length; i++){
      var ch = panel.children[i];
      if (ch === bar || ch === emptyMsg) continue;
      if (visit(ch)) any = true; else ch.classList.add("ui-miss");
    }
    if (!any) emptyMsg.classList.add("ui-show");
  }

  /* ───────── scan + keep up with studios that build their panels in JS ───────── */
  var SEL = "input[type=range],input[type=checkbox],input[type=color],select,.group";
  function scan(base){
    var list = base.querySelectorAll ? Array.prototype.slice.call(base.querySelectorAll(SEL)) : [];
    if (base.matches && base.matches(SEL)) list.unshift(base);
    var fresh = [];
    for (var i = 0; i < list.length; i++){
      var n = list[i];
      if (n.closest("[data-ui-skip]")) continue;
      if (n.classList.contains("group")){ if (!n._kuiSec) mkSection(n); continue; }
      if (n._kui) continue;
      var st = n.tagName === "SELECT" ? mkSelect(n) : n.type === "range" ? mkRange(n) : n.type === "checkbox" ? mkCheck(n) : mkColor(n);
      fresh.push(st);
    }
    for (i = 0; i < fresh.length; i++){
      if (frozen && fresh[i].def == null && fresh[i].grab) fresh[i].grab();
      CT.push(fresh[i]); fresh[i].sync(true);
    }
    if (fresh.length){ touch(); mkBar(); }
    syncFold();
  }

  function boot(){
    scan(doc.body);
    new MutationObserver(function(muts){
      for (var i = 0; i < muts.length; i++){
        var m = muts[i], t = m.target;
        if (m.type === "attributes"){
          if (t._kui && t._kui.el === t && t._kui.type === "range") t._kui.sync(true);
          continue;
        }
        if (t.tagName === "SELECT" && t._kui && !t._kuiBusy){
          t._kuiBusy = 1;
          setTimeout((function(s){ return function(){ s._kuiBusy = 0; s._kui.rebuild(); }; })(t), 0);
          continue;
        }
        for (var j = 0; j < m.addedNodes.length; j++){
          var n = m.addedNodes[j];
          if (n.nodeType !== 1) continue;
          if (typeof n.className === "string" && /(^|\s)ui-(seg|bar|edit|rst|empty|dot|sp|chev)/.test(n.className)) continue;
          if (n.matches(SEL) || n.querySelector(SEL)) scan(n);
        }
      }
    }).observe(doc.body, { childList:true, subtree:true, attributes:true, attributeFilter:["min", "max", "step", "disabled"] });
  }
  if (doc.body) boot(); else doc.addEventListener("DOMContentLoaded", boot);

  window.KlikUI = { scan:scan, freeze:freeze, controls:function(){ return CT.slice(); }, search:function(q){ if (searchIn){ searchIn.value = q || ""; searchIn.dispatchEvent(new Event("input")); } } };
})();
