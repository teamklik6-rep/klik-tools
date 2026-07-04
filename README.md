# Klik Tools

Внутрішні креативні інструменти [Klik Studio](https://www.klikstudio.co/) — одинадцять студій в одному інтерфейсі. Все статичне, вся обробка відбувається локально у браузері, сервер не потрібен.

## Інструменти

| # | Студія | Що робить |
|---|--------|-----------|
| 01 | **LumaGrid Studio** | CellMap · PixelSynth · ASCII · Dither — сітки за яскравістю, ретро-дизеринг з палітрами, glow/glitch пост-ефекти, експорт PNG / SVG / MP4 |
| 02 | **Sphere Studio** | 3D генератор світлових сфер на WebGL, пресети, запис MP4 |
| 03 | **X-Ray Studio** | Фото → wireframe/рентген (Canny), експорт PNG / SVG |
| 04 | **Thermo Studio** | Термо-ґлоу типографіка: echo-шлейфи + градієнт-мапа (як Echo + Colorama в AE), 12 пресетів, луп-анімація, експорт PNG / JPG / WEBP / SVG / MP4 / WebM |
| 05 | **Flux Studio** | Рідкі градієнти: blur → wave warp → дзеркало → Colorama + скляні фігури з рефракцією, 12 пресетів, експорт PNG / JPG / WEBP / SVG / MP4 / WebM |
| 06 | **Flare Studio** | Лінзові відблиски (як Flareware): діфракційні зірки, гало, ghost-и, боке, 18 типів, true-PNG з альфою, MP4-лупи |
| 07 | **CRT Studio** | Скан-лінії, модульовані яскравістю (як CRT Scanlines Template): кут/ширина/деталізація, поріг маскування, глітчі, частинки |
| 08 | **Glitch Studio** | Глітч-машина (як Glitch Machine): сяюча аберація, CRT-вигин, дисторсія, слайси, Bayer-дизер, сяючий текст |
| 09 | **Displace Studio** | Error-дисплейсмент (як Error Displacements): 10 генераторів Ч/Б-мап, експорт результату або самої мапи |
| 10 | **Particle Studio** | Сніг/дощ (як Particle Playground): 6 типів, 3 флікери, дзеркало/фон-шар, star glow, rave, god rays |
| 11 | **Shader Studio** | 20 живих WebGL-шейдерів (як Paper Shaders): mesh gradient, neuro noise, metaballs, voronoi, warp, god rays, liquid metal… |

## Мови

EN (за замовчуванням) · RU · UA — перемикач у шапці. Вибір зберігається у localStorage (`klikLang`); студії перекладаються оверлеєм `tools/i18n.js` без змін у їхньому коді.

## Структура

```
index.html              ← оболонка-хаб (Klik-стиль, роутинг, iframe, i18n)
tools/
  ascii-studio.html     ← LumaGrid
  sphere-studio.html    ← Sphere
  xray-studio.html      ← X-Ray
  thermo-studio.html    ← Thermo
  flux-studio.html      ← Flux
  flare-studio.html     ← Flare
  crt-studio.html       ← CRT
  glitch-studio.html    ← Glitch
  displace-studio.html  ← Displace
  particle-studio.html  ← Particles
  shader-studio.html    ← Shaders (WebGL2)
  studio.css            ← спільний скелет нових студій
  mp4-muxer.js          ← спільний MP4-муксер
  i18n.js               ← EN/RU-переклад студій (UA — оригінал)
```

## Локальний запуск

Просто відкрий `index.html` у браузері, або:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Деплой

Хостинг — GitHub Pages (безкоштовно): Settings → Pages → Deploy from a branch → `main` / root.
