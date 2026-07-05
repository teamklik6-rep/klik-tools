/* Klik Tools — універсальна плаваюча FX-панель (пост-обробка) для всіх студій.
   Блюр, зерно, віньєтка, хроматична аберація, сканлайни, кольорокорекція.
   Превʼю — CSS/SVG-фільтри + оверлеї над канвасом; експорт PNG/WebM робить
   чесний композит у 2D-канвасі, тож ефекти потрапляють у файл.
   Налаштування зберігаються в localStorage("klikFX") і спільні для всіх студій. */
(function(){
  "use strict";

  var cv = document.getElementById("out") || document.getElementById("gl");
  if (!cv || !cv.getContext) return;

  /* ---------------- state ---------------- */
  var DEF = {
    on:false,
    blur:0,
    grain:0, gsize:1.6, ganim:true, gcolor:false, gblend:"overlay",
    vig:0, vsize:0.62,
    ca:0,
    bright:1, contrast:1, sat:1, hue:0,
    scan:0, scanP:4,
    recDur:8,
  };
  var S = {};
  try { S = Object.assign({}, DEF, JSON.parse(localStorage.getItem("klikFX") || "{}")); }
  catch(e){ S = Object.assign({}, DEF); }
  function save(){ try{ localStorage.setItem("klikFX", JSON.stringify(S)); }catch(e){} }

  /* ---------------- styles ---------------- */
  var css = document.createElement("style");
  css.textContent =
  ".kfx-fab{position:fixed;right:16px;bottom:16px;z-index:9990;width:44px;height:44px;border-radius:50%;" +
    "background:#bbff32;color:#060612;border:none;cursor:pointer;font:800 13px/1 Inter,system-ui,sans-serif;" +
    "box-shadow:0 6px 24px rgba(0,0,0,.45);transition:transform .15s}" +
  ".kfx-fab:hover{transform:scale(1.08)}" +
  ".kfx-fab.kfx-live{box-shadow:0 0 0 3px #bbff3255,0 6px 24px rgba(0,0,0,.45)}" +
  ".kfx-panel{position:fixed;right:16px;bottom:70px;z-index:9991;width:250px;max-height:calc(100vh - 110px);" +
    "overflow-y:auto;background:#101014;color:#fafafa;border:1px solid #26262e;border-radius:12px;" +
    "font:13px/1.4 Inter,system-ui,sans-serif;box-shadow:0 18px 60px rgba(0,0,0,.55);" +
    "-webkit-font-smoothing:antialiased;display:none}" +
  ".kfx-panel.open{display:block}" +
  ".kfx-panel::-webkit-scrollbar{width:8px}" +
  ".kfx-panel::-webkit-scrollbar-thumb{background:#26262e;border-radius:99px}" +
  ".kfx-head{display:flex;align-items:center;gap:8px;padding:11px 12px;border-bottom:1px solid #26262e;" +
    "cursor:grab;user-select:none;position:sticky;top:0;background:#101014;z-index:2}" +
  ".kfx-head b{font-size:13px;font-weight:700;flex:1}" +
  ".kfx-x{background:none;border:none;color:#8a8a94;cursor:pointer;font-size:15px;padding:2px 5px}" +
  ".kfx-x:hover{color:#fff}" +
  ".kfx-body{padding:11px 12px}" +
  ".kfx-g{margin-bottom:14px}" +
  ".kfx-g h5{margin:0 0 7px;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a8a94}" +
  ".kfx-row{display:flex;align-items:center;justify-content:space-between;margin:7px 0 2px}" +
  ".kfx-row span{font-size:12.5px}" +
  ".kfx-val{font-size:11px;color:#8a8a94;background:#1b1b22;border-radius:5px;padding:1px 6px;font-variant-numeric:tabular-nums}" +
  ".kfx-panel input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:99px;" +
    "background:#26262e;outline:none;margin:3px 0;cursor:pointer}" +
  ".kfx-panel input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;" +
    "background:#fafafa;border:2px solid #101014;box-shadow:0 0 0 1px #26262e}" +
  ".kfx-sw{display:flex;align-items:center;justify-content:space-between;margin:8px 0}" +
  ".kfx-sw span{font-size:12.5px}" +
  ".kfx-tgl{position:relative;width:32px;height:18px;flex:none}" +
  ".kfx-tgl input{opacity:0;width:0;height:0;position:absolute}" +
  ".kfx-tgl i{position:absolute;inset:0;background:#26262e;border-radius:99px;cursor:pointer;transition:.15s}" +
  ".kfx-tgl i:before{content:'';position:absolute;width:12px;height:12px;left:3px;top:3px;background:#8a8a94;" +
    "border-radius:50%;transition:.15s}" +
  ".kfx-tgl input:checked+i{background:#bbff32}" +
  ".kfx-tgl input:checked+i:before{transform:translateX(14px);background:#060612}" +
  ".kfx-panel select{width:100%;background:#1b1b22;border:1px solid #26262e;color:#fafafa;border-radius:7px;" +
    "padding:6px 8px;font:12.5px Inter,system-ui,sans-serif;outline:none;cursor:pointer;margin-top:4px}" +
  ".kfx-btns{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:6px}" +
  ".kfx-btn{border:1px solid #26262e;background:#1b1b22;color:#fafafa;border-radius:8px;padding:7px 6px;" +
    "font:600 12px Inter,system-ui,sans-serif;cursor:pointer;transition:.12s}" +
  ".kfx-btn:hover{border-color:#3a3a44}" +
  ".kfx-btn.kfx-acc{background:#bbff32;border-color:#bbff32;color:#060612}" +
  ".kfx-btn.kfx-rec{background:#c22;border-color:#c22;color:#fff}" +
  ".kfx-btn.full{grid-column:1/-1}" +
  ".kfx-note{font-size:10.5px;color:#8a8a94;line-height:1.45;margin-top:8px}" +
  ".kfx-ov{position:fixed;pointer-events:none;display:none}";
  document.head.appendChild(css);

  /* ---------------- SVG-фільтр аберації ---------------- */
  var svgNS = "http://www.w3.org/2000/svg";
  var svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width","0"); svg.setAttribute("height","0");
  svg.style.position = "absolute";
  svg.innerHTML =
    '<filter id="kfx-ca" color-interpolation-filters="sRGB" x="-20%" y="-20%" width="140%" height="140%">' +
    '<feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/>' +
    '<feOffset in="r" dx="-2" dy="0" result="r2"/>' +
    '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g"/>' +
    '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b"/>' +
    '<feOffset in="b" dx="2" dy="0" result="b2"/>' +
    '<feBlend in="r2" in2="g" mode="screen" result="rg"/>' +
    '<feBlend in="rg" in2="b2" mode="screen"/>' +
    '</filter>';
  document.body.appendChild(svg);
  var feR = svg.querySelectorAll("feOffset")[0], feB = svg.querySelectorAll("feOffset")[1];

  /* ---------------- оверлеї (зерно / віньєтка / сканлайни) ---------------- */
  var ovGrain = document.createElement("canvas"); ovGrain.className = "kfx-ov";
  var ovVig   = document.createElement("div");    ovVig.className   = "kfx-ov";
  var ovScan  = document.createElement("div");    ovScan.className  = "kfx-ov";
  cv.parentNode.insertBefore(ovGrain, cv.nextSibling);
  cv.parentNode.insertBefore(ovVig,   ovGrain.nextSibling);
  cv.parentNode.insertBefore(ovScan,  ovVig.nextSibling);
  var gctx = ovGrain.getContext("2d");

  /* шум-плитка */
  var tile = document.createElement("canvas"); tile.width = 160; tile.height = 160;
  var tctx = tile.getContext("2d");
  function makeNoise(){
    var img = tctx.createImageData(160,160), d = img.data;
    for (var i=0;i<d.length;i+=4){
      if (S.gcolor){ d[i]=Math.random()*255|0; d[i+1]=Math.random()*255|0; d[i+2]=Math.random()*255|0; }
      else { var v=Math.random()*255|0; d[i]=v; d[i+1]=v; d[i+2]=v; }
      d[i+3]=255;
    }
    tctx.putImageData(img,0,0);
  }
  makeNoise();

  /* ---------------- панель ---------------- */
  function h(html){ var t=document.createElement("div"); t.innerHTML=html.trim(); return t.firstChild; }

  var fab = h('<button class="kfx-fab" title="FX — пост-обробка">FX</button>');
  var panel = h('<div class="kfx-panel">' +
    '<div class="kfx-head"><b>FX — пост-обробка</b><button class="kfx-x" title="Згорнути">✕</button></div>' +
    '<div class="kfx-body">' +

    '<div class="kfx-sw"><span><b>Увімкнути FX</b></span><label class="kfx-tgl"><input type="checkbox" id="kfxOn"><i></i></label></div>' +

    '<div class="kfx-g"><h5>Блюр</h5>' +
      '<div class="kfx-row"><span>Блюр (px)</span><span class="kfx-val" id="kvBlur">0.0</span></div>' +
      '<input type="range" id="kBlur" min="0" max="24" step="0.5" value="0"></div>' +

    '<div class="kfx-g"><h5>Зерно</h5>' +
      '<div class="kfx-row"><span>Кількість</span><span class="kfx-val" id="kvGrain">0.00</span></div>' +
      '<input type="range" id="kGrain" min="0" max="1" step="0.05" value="0">' +
      '<div class="kfx-row"><span>Розмір зерна</span><span class="kfx-val" id="kvGsize">1.6</span></div>' +
      '<input type="range" id="kGsize" min="1" max="4" step="0.2" value="1.6">' +
      '<div class="kfx-sw"><span>Анімоване зерно</span><label class="kfx-tgl"><input type="checkbox" id="kGanim"><i></i></label></div>' +
      '<div class="kfx-sw"><span>Кольорове зерно</span><label class="kfx-tgl"><input type="checkbox" id="kGcolor"><i></i></label></div>' +
      '<div class="kfx-row"><span>Змішування</span></div>' +
      '<select id="kGblend"><option value="overlay">Overlay</option><option value="soft-light">Soft light</option><option value="screen">Screen</option></select></div>' +

    '<div class="kfx-g"><h5>Віньєтка</h5>' +
      '<div class="kfx-row"><span>Сила</span><span class="kfx-val" id="kvVig">0.00</span></div>' +
      '<input type="range" id="kVig" min="0" max="1" step="0.05" value="0">' +
      '<div class="kfx-row"><span>Радіус</span><span class="kfx-val" id="kvVsize">0.62</span></div>' +
      '<input type="range" id="kVsize" min="0.2" max="1" step="0.02" value="0.62"></div>' +

    '<div class="kfx-g"><h5>Аберація</h5>' +
      '<div class="kfx-row"><span>RGB-зсув (px)</span><span class="kfx-val" id="kvCa">0.0</span></div>' +
      '<input type="range" id="kCa" min="0" max="10" step="0.5" value="0"></div>' +

    '<div class="kfx-g"><h5>Сканлайни</h5>' +
      '<div class="kfx-row"><span>Сила</span><span class="kfx-val" id="kvScan">0.00</span></div>' +
      '<input type="range" id="kScan" min="0" max="1" step="0.05" value="0">' +
      '<div class="kfx-row"><span>Крок (px)</span><span class="kfx-val" id="kvScanP">4</span></div>' +
      '<input type="range" id="kScanP" min="2" max="10" step="1" value="4"></div>' +

    '<div class="kfx-g"><h5>Кольори</h5>' +
      '<div class="kfx-row"><span>Яскравість</span><span class="kfx-val" id="kvBright">1.00</span></div>' +
      '<input type="range" id="kBright" min="0.5" max="1.6" step="0.02" value="1">' +
      '<div class="kfx-row"><span>Контраст</span><span class="kfx-val" id="kvContrast">1.00</span></div>' +
      '<input type="range" id="kContrast" min="0.5" max="1.8" step="0.02" value="1">' +
      '<div class="kfx-row"><span>Насиченість</span><span class="kfx-val" id="kvSat">1.00</span></div>' +
      '<input type="range" id="kSat" min="0" max="2" step="0.05" value="1">' +
      '<div class="kfx-row"><span>Відтінок (°)</span><span class="kfx-val" id="kvHue">0</span></div>' +
      '<input type="range" id="kHue" min="0" max="360" step="5" value="0"></div>' +

    '<div class="kfx-g"><h5>Експорт з FX</h5>' +
      '<div class="kfx-row"><span>Запис (с)</span><span class="kfx-val" id="kvRecDur">8</span></div>' +
      '<input type="range" id="kRecDur" min="2" max="30" step="1" value="8">' +
      '<div class="kfx-btns">' +
        '<button class="kfx-btn kfx-acc" id="kPng">PNG з FX</button>' +
        '<button class="kfx-btn" id="kWebm"><span id="kWebmLbl">WebM з FX</span></button>' +
        '<button class="kfx-btn full" id="kReset">Скинути FX</button></div>' +
      '<div class="kfx-note">Ефекти видно у превʼю та у файлах з цієї панелі. Штатні кнопки експорту студії рендерять без FX. Налаштування спільні для всіх студій.</div>' +
    '</div>' +
    '</div></div>');
  document.body.appendChild(fab);
  document.body.appendChild(panel);

  var q = function(sel){ return panel.querySelector(sel); };

  /* drag за шапку */
  (function(){
    var head = q(".kfx-head"), sx=0, sy=0, px=0, py=0, drag=false;
    head.addEventListener("pointerdown", function(e){
      if (e.target.closest(".kfx-x")) return;
      drag=true; sx=e.clientX; sy=e.clientY;
      var r=panel.getBoundingClientRect(); px=r.left; py=r.top;
      head.setPointerCapture(e.pointerId);
    });
    head.addEventListener("pointermove", function(e){
      if(!drag) return;
      var nx=Math.max(4,Math.min(window.innerWidth-panel.offsetWidth-4,px+e.clientX-sx));
      var ny=Math.max(4,Math.min(window.innerHeight-60,py+e.clientY-sy));
      panel.style.left=nx+"px"; panel.style.top=ny+"px";
      panel.style.right="auto"; panel.style.bottom="auto";
    });
    head.addEventListener("pointerup", function(){ drag=false; });
  })();

  fab.addEventListener("click", function(){ panel.classList.toggle("open"); });
  q(".kfx-x").addEventListener("click", function(){ panel.classList.remove("open"); });

  /* ---------------- бінди ---------------- */
  function bindR(id, key, vid, fmt, cb){
    var el=q("#"+id), v=q("#"+vid); fmt=fmt||function(x){return x;};
    el.value=S[key]; v.textContent=fmt(S[key]);
    el.addEventListener("input", function(){
      S[key]=parseFloat(el.value); v.textContent=fmt(S[key]); save(); if(cb)cb();
    });
  }
  function bindT(id, key, cb){
    var el=q("#"+id);
    el.checked=!!S[key];
    el.addEventListener("change", function(){ S[key]=el.checked; save(); if(cb)cb(); });
  }
  var f1=function(x){return x.toFixed(1);}, f2=function(x){return x.toFixed(2);};
  bindR("kBlur","blur","kvBlur",f1);
  bindR("kGrain","grain","kvGrain",f2);
  bindR("kGsize","gsize","kvGsize",f1);
  bindR("kVig","vig","kvVig",f2);
  bindR("kVsize","vsize","kvVsize",f2);
  bindR("kCa","ca","kvCa",f1);
  bindR("kScan","scan","kvScan",f2);
  bindR("kScanP","scanP","kvScanP",function(x){return Math.round(x);});
  bindR("kBright","bright","kvBright",f2);
  bindR("kContrast","contrast","kvContrast",f2);
  bindR("kSat","sat","kvSat",f2);
  bindR("kHue","hue","kvHue",function(x){return Math.round(x);});
  bindR("kRecDur","recDur","kvRecDur",function(x){return Math.round(x);});
  bindT("kfxOn","on");
  bindT("kGanim","ganim");
  bindT("kGcolor","gcolor",makeNoise);
  q("#kGblend").value=S.gblend;
  q("#kGblend").addEventListener("change", function(e){ S.gblend=e.target.value; save(); });
  q("#kReset").addEventListener("click", function(){
    var on=S.on; S=Object.assign({},DEF); S.on=on; save();
    bindAllValues();
  });
  function bindAllValues(){
    var m=[["kBlur","blur","kvBlur",f1],["kGrain","grain","kvGrain",f2],["kGsize","gsize","kvGsize",f1],
      ["kVig","vig","kvVig",f2],["kVsize","vsize","kvVsize",f2],["kCa","ca","kvCa",f1],
      ["kScan","scan","kvScan",f2],["kScanP","scanP","kvScanP",Math.round],
      ["kBright","bright","kvBright",f2],["kContrast","contrast","kvContrast",f2],
      ["kSat","sat","kvSat",f2],["kHue","hue","kvHue",Math.round],["kRecDur","recDur","kvRecDur",Math.round]];
    m.forEach(function(a){ q("#"+a[0]).value=S[a[1]]; q("#"+a[2]).textContent=a[3](S[a[1]]); });
    q("#kfxOn").checked=S.on; q("#kGanim").checked=S.ganim; q("#kGcolor").checked=S.gcolor;
    q("#kGblend").value=S.gblend;
  }

  /* ---------------- превʼю: фільтри і оверлеї ---------------- */
  var lastNoise=0, lastRect={x:0,y:0,w:0,h:0,r:""};
  function applyFilter(){
    if(!S.on){ if(cv.style.filter)cv.style.filter=""; return; }
    var p=[];
    if(S.ca>0){ feR.setAttribute("dx",-S.ca); feB.setAttribute("dx",S.ca); p.push("url(#kfx-ca)"); }
    if(S.blur>0) p.push("blur("+S.blur+"px)");
    if(S.bright!==1) p.push("brightness("+S.bright+")");
    if(S.contrast!==1) p.push("contrast("+S.contrast+")");
    if(S.sat!==1) p.push("saturate("+S.sat+")");
    if(S.hue>0) p.push("hue-rotate("+S.hue+"deg)");
    var f=p.join(" ");
    if(cv.style.filter!==f) cv.style.filter=f;
  }
  function syncOverlays(ts){
    var showG=S.on&&S.grain>0, showV=S.on&&S.vig>0, showS=S.on&&S.scan>0;
    ovGrain.style.display=showG?"block":"none";
    ovVig.style.display=showV?"block":"none";
    ovScan.style.display=showS?"block":"none";
    fab.classList.toggle("kfx-live",S.on);
    if(!(showG||showV||showS)) return;

    var r=cv.getBoundingClientRect();
    if(r.width<2||r.height<2) return;
    var br=getComputedStyle(cv).borderRadius;
    if(r.left!==lastRect.x||r.top!==lastRect.y||r.width!==lastRect.w||r.height!==lastRect.h||br!==lastRect.r){
      lastRect={x:r.left,y:r.top,w:r.width,h:r.height,r:br};
      [ovGrain,ovVig,ovScan].forEach(function(o){
        o.style.left=r.left+"px"; o.style.top=r.top+"px";
        o.style.width=r.width+"px"; o.style.height=r.height+"px";
        o.style.borderRadius=br; o.style.overflow="hidden";
      });
    }
    if(showV){
      ovVig.style.background="radial-gradient(circle at 50% 50%, rgba(0,0,0,0) "+
        Math.round(S.vsize*62)+"%, rgba(0,0,0,"+(S.vig*0.85).toFixed(3)+") 100%)";
    }
    if(showS){
      ovScan.style.background="repeating-linear-gradient(0deg, rgba(0,0,0,"+(S.scan*0.55).toFixed(3)+
        ") 0px 1px, transparent 1px "+Math.round(S.scanP)+"px)";
    }
    if(showG){
      ovGrain.style.opacity=(S.grain*0.85).toFixed(3);
      ovGrain.style.mixBlendMode=S.gblend;
      var dpr=Math.min(2,window.devicePixelRatio||1);
      var gw=Math.round(r.width*dpr), gh=Math.round(r.height*dpr);
      var need=(ovGrain.width!==gw||ovGrain.height!==gh);
      if(need){ ovGrain.width=gw; ovGrain.height=gh; }
      if(need||(S.ganim&&ts-lastNoise>80)){
        lastNoise=ts;
        if(S.ganim)makeNoise();
        gctx.save();
        gctx.imageSmoothingEnabled=false;
        var sc=S.gsize*dpr;
        gctx.scale(sc,sc);
        var pat=gctx.createPattern(tile,"repeat");
        gctx.fillStyle=pat;
        gctx.fillRect(0,0,gw/sc+1,gh/sc+1);
        gctx.restore();
      }
    }
  }
  function loop(ts){
    requestAnimationFrame(loop);
    applyFilter();
    syncOverlays(ts||0);
  }
  requestAnimationFrame(loop);

  /* ---------------- експорт з FX ---------------- */
  function composite(dst){
    var w=cv.width,h=cv.height;
    if(dst.width!==w||dst.height!==h){ dst.width=w; dst.height=h; }
    var ctx=dst.getContext("2d");
    var rect=cv.getBoundingClientRect();
    var k=rect.width>2?w/rect.width:1; /* екранні px → внутрішні px */
    var filt=[];
    if(S.blur>0)filt.push("blur("+(S.blur*k).toFixed(2)+"px)");
    if(S.bright!==1)filt.push("brightness("+S.bright+")");
    if(S.contrast!==1)filt.push("contrast("+S.contrast+")");
    if(S.sat!==1)filt.push("saturate("+S.sat+")");
    if(S.hue>0)filt.push("hue-rotate("+S.hue+"deg)");
    var fstr=filt.length?filt.join(" "):"none";
    ctx.globalAlpha=1; ctx.globalCompositeOperation="source-over"; ctx.filter="none";
    if(S.ca>0){
      var d=S.ca*k;
      ctx.fillStyle="#000"; ctx.fillRect(0,0,w,h);
      ctx.globalCompositeOperation="lighter";
      var ch=[["#ff0000",-d],["#00ff00",0],["#0000ff",d]];
      for(var i=0;i<3;i++){
        var t=composite._t=composite._t||document.createElement("canvas");
        if(t.width!==w||t.height!==h){t.width=w;t.height=h;}
        var tc=t.getContext("2d");
        tc.globalCompositeOperation="source-over";
        tc.clearRect(0,0,w,h);
        tc.drawImage(cv,0,0);
        tc.globalCompositeOperation="multiply";
        tc.fillStyle=ch[i][0]; tc.fillRect(0,0,w,h);
        ctx.filter=fstr;
        ctx.drawImage(t,ch[i][1],0);
        ctx.filter="none";
      }
      ctx.globalCompositeOperation="source-over";
    } else {
      ctx.filter=fstr;
      ctx.drawImage(cv,0,0);
      ctx.filter="none";
    }
    if(S.grain>0){
      if(S.ganim)makeNoise();
      ctx.save();
      ctx.globalAlpha=S.grain*0.85;
      ctx.globalCompositeOperation=S.gblend;
      ctx.imageSmoothingEnabled=false;
      var sc=S.gsize*k;
      ctx.scale(sc,sc);
      ctx.fillStyle=ctx.createPattern(tile,"repeat");
      ctx.fillRect(0,0,w/sc+1,h/sc+1);
      ctx.restore();
    }
    if(S.scan>0){
      ctx.save();
      ctx.fillStyle="rgba(0,0,0,"+(S.scan*0.55).toFixed(3)+")";
      var step=Math.max(2,Math.round(S.scanP*k)), lh=Math.max(1,Math.round(k));
      for(var y=0;y<h;y+=step)ctx.fillRect(0,y,w,lh);
      ctx.restore();
    }
    if(S.vig>0){
      var cx=w/2,cy=h/2,rr=Math.hypot(w,h)/2;
      var g=ctx.createRadialGradient(cx,cy,rr*S.vsize*0.62,cx,cy,rr);
      g.addColorStop(0,"rgba(0,0,0,0)");
      g.addColorStop(1,"rgba(0,0,0,"+(S.vig*0.85).toFixed(3)+")");
      ctx.save(); ctx.fillStyle=g; ctx.fillRect(0,0,w,h); ctx.restore();
    }
    return dst;
  }
  function download(b,n){
    var u=URL.createObjectURL(b),a=document.createElement("a");
    a.href=u;a.download=n;a.click();
    setTimeout(function(){URL.revokeObjectURL(u);},1500);
  }
  q("#kPng").addEventListener("click", function(){
    var dst=document.createElement("canvas");
    composite(dst);
    dst.toBlob(function(b){ if(b)download(b,"klik-fx.png"); },"image/png");
  });
  var rec=null, recRaf=0;
  q("#kWebm").addEventListener("click", function(){
    if(rec){ rec.stop(); return; }
    if(!window.MediaRecorder){ alert("Запис недоступний у цьому браузері."); return; }
    var dst=document.createElement("canvas");
    composite(dst);
    var mime=MediaRecorder.isTypeSupported("video/webm;codecs=vp9")?"video/webm;codecs=vp9":"video/webm";
    var chunks=[];
    try{ rec=new MediaRecorder(dst.captureStream(30),{mimeType:mime,videoBitsPerSecond:16e6}); }
    catch(e){ alert("Запис недоступний у цьому браузері."); rec=null; return; }
    rec.ondataavailable=function(e){ if(e.data.size)chunks.push(e.data); };
    rec.onstop=function(){
      cancelAnimationFrame(recRaf);
      if(chunks.length)download(new Blob(chunks,{type:"video/webm"}),"klik-fx.webm");
      rec=null; q("#kWebmLbl").textContent="WebM з FX";
    };
    var stopAt=performance.now()+S.recDur*1000;
    (function draw(){
      if(!rec)return;
      composite(dst);
      if(performance.now()>stopAt){ rec.stop(); return; }
      recRaf=requestAnimationFrame(draw);
    })();
    rec.start(200);
    q("#kWebmLbl").textContent="■ Стоп";
  });
})();
