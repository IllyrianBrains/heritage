(async () => {
  const appBase = document.querySelector('meta[name="app-base"]')?.content || '/';
  const localPath = (path) => `${appBase}${String(path).replace(/^\/+/, '')}`;
  const mapElement = document.getElementById('heritage-map');
  const listElement = document.getElementById('place-list');
  const detailPanel = document.getElementById('place-detail');
  const detailContent = document.getElementById('detail-content');
  const notice = document.getElementById('map-notice');
  const search = document.getElementById('place-search');
  const scopeOptions = document.getElementById('scope-options');
  const environmentOptions = document.getElementById('environment-options');
  const countryOptions = document.getElementById('country-options');
  const noteCategories = {
    red: { label: 'Ndikim i raportuar', color: '#f3a29c' },
    yellow: { label: 'Shqetësim për verifikim', color: '#f6df83' },
    green: { label: 'Përmirësim i dokumentuar', color: '#a5d8b1' },
  };
  const noteCategory = (value, legacyColor = '') => {
    if (Object.hasOwn(noteCategories, value)) return value;
    if (['#ffb3c0', '#ffd4b8', '#f7d2dd'].includes(String(legacyColor).toLowerCase())) return 'red';
    if (['#a6e6a1', '#d9e8c2'].includes(String(legacyColor).toLowerCase())) return 'green';
    return 'yellow';
  };
  const make = (tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = String(value);
    return element;
  };
  let noticeTimer;
  const showNotice = (message) => {
    notice.textContent = message;
    notice.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.hidden = true; }, 8000);
  };
  const newLocalId = () => `local-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const safeLink = (label, value) => {
    try {
      const url = new URL(value, window.location.href);
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      const anchor = make('a', 'record-link', label);
      anchor.href = url.href;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      return anchor;
    } catch { return null; }
  };
  const imageFigure = (image, compact = false) => {
    if (!image || typeof image.url !== 'string') return null;
    let url;
    try { url = new URL(image.url, window.location.href); } catch { return null; }
    if (url.protocol !== 'https:') return null;
    const figure = make('figure', compact ? 'card-image' : 'detail-image');
    const photo = make('img');
    photo.src = url.href;
    photo.alt = image.alt || '';
    photo.loading = compact ? 'lazy' : 'eager';
    photo.decoding = 'async';
    photo.addEventListener('error', () => figure.remove(), { once: true });
    const caption = make('figcaption', '', [image.context, image.credit, image.license].filter(Boolean).join(' · '));
    figure.append(photo);
    if (caption.textContent) figure.append(caption);
    if (!compact && image.source) {
      const source = safeLink('Shiko fotografinë dhe licencën ↗', image.source);
      if (source) figure.append(source);
    }
    return figure;
  };
  if (!window.ol) { showNotice('Harta nuk u ngarkua. Kontrollo lidhjen me internetin dhe rifresko faqen.'); return; }

  let manifest;
  try {
    const response = await fetch(localPath('data/groups.json'));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    manifest = await response.json();
    if (!Array.isArray(manifest.groups)) throw new Error('Regjistri i grupeve është i pavlefshëm');
  } catch {
    showNotice('Grupet e hartës nuk u ngarkuan. Provo ta rifreskosh faqen.');
    return;
  }

  const groupStates = [];
  const records = [];
  const format = new ol.format.GeoJSON();
  const baseSources = {
    standard: new ol.source.OSM(),
    satellite: new ol.source.XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attributions: 'Pllaka: Esri, Maxar, Earthstar Geographics, GIS User Community',
      maxZoom: 19,
    }),
    terrain: new ol.source.XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}',
      attributions: 'Pllaka: Esri, USGS, NOAA',
      maxZoom: 13,
    }),
    sentinel: new ol.source.XYZ({
      url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
      attributions: 'Pllaka: Sentinel-2 cloudless by EOX IT Services GmbH (përmban të dhëna të modifikuara Copernicus Sentinel 2020)',
      maxZoom: 14,
    }),
  };
  const baseLayer = new ol.layer.Tile({ source: baseSources.standard });
  const labelsLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      attributions: 'Etiketat: Esri',
      maxZoom: 19,
    }),
    visible: false,
  });
  const environmentalDefinitions = [
    {
      id: 'copernicus',
      label: 'Imazheri Sentinel-2',
      provider: 'Copernicus Sentinel-2 · mozaik 2020',
      description: 'Imazheri satelitore pa re për të lexuar pyjet, ujërat, tokën dhe zonat e ndërtuara.',
      swatch: 'linear-gradient(90deg,#234d42,#79905b,#b6a578,#547785)',
      source: new ol.source.XYZ({
        url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
        attributions: 'Sentinel-2 cloudless nga EOX · përmban të dhëna të modifikuara Copernicus Sentinel 2020',
        maxZoom: 14,
        crossOrigin: 'anonymous',
      }),
    },
    {
      id: 'landcover',
      label: 'Mbulesa e tokës',
      provider: 'NASA MODIS · klasifikim vjetor',
      description: 'Pyje, ujë, tokë bujqësore, zona të ndërtuara dhe klasa të tjera të mbulesës së tokës.',
      swatch: 'linear-gradient(90deg,#006400,#ffbb22,#ffff4c,#0064c8,#fa0000)',
      source: new ol.source.TileWMS({
        url: 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi',
        params: { LAYERS: 'MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual', FORMAT: 'image/png', TRANSPARENT: true },
        attributions: 'NASA EOSDIS GIBS · MODIS IGBP Land Cover',
        crossOrigin: 'anonymous',
      }),
    },
    {
      id: 'ndvi',
      label: 'Gjendja e bimësisë',
      provider: 'NASA MODIS NDVI · 8 ditë',
      description: 'Indeksi NDVI: tonet më të gjelbra tregojnë bimësi më të dendur dhe aktive.',
      swatch: 'linear-gradient(90deg,#f1ecec,#d8c6aa,#b4c476,#67a844,#0b5d28)',
      source: new ol.source.TileWMS({
        url: 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi',
        params: { LAYERS: 'MODIS_Terra_NDVI_8Day', FORMAT: 'image/png', TRANSPARENT: true },
        attributions: 'NASA EOSDIS GIBS · MODIS Terra NDVI',
        crossOrigin: 'anonymous',
      }),
    },
    {
      id: 'temperature',
      label: 'Temperatura e sipërfaqes',
      provider: 'NASA MODIS · 8 ditë, ditën',
      description: 'Temperatura e sipërfaqes së tokës; nuk është temperatura e ajrit.',
      swatch: 'linear-gradient(90deg,#313695,#74add1,#ffffbf,#f46d43,#a50026)',
      source: new ol.source.TileWMS({
        url: 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi',
        params: { LAYERS: 'MODIS_Terra_L3_Land_Surface_Temp_8Day_Day', FORMAT: 'image/png', TRANSPARENT: true },
        attributions: 'NASA EOSDIS GIBS · MODIS Terra',
        crossOrigin: 'anonymous',
      }),
    },
  ];
  const environmentalLayers = environmentalDefinitions.map((definition) => ({
    ...definition,
    layer: new ol.layer.Tile({ source: definition.source, visible: Boolean(definition.defaultVisible), opacity: 0.68 }),
  }));
  let selectedId = null;
  let query = '';
  const activeCountries = new Set(['AL', 'XK']);
  let photoOnly = false;
  let dangerOnly = false;
  const activeGroups = new Set(manifest.groups.map((group) => group.id));
  const STATUS_LABELS = { good: 'E mirë', watch: 'Në vëzhgim', critical: 'Kritike', unassessed: 'Pa vlerësim' };
  const STATUS_COLORS = { good: '#0ca30c', watch: '#fab219', critical: '#d03b3b' };
  const INDICATOR_LABELS = {
    threatLevel: { key: 'Niveli i kërcënimit', low: 'I ulët', medium: 'Mesatar', high: 'I lartë' },
    habitatTrend: { key: 'Tendenca e habitatit', improving: 'Përmirësohet', stable: 'Stabël', declining: 'Përkeqësohet' },
    enforcementLevel: { key: 'Zbatimi i mbrojtjes', good: 'I mirë', partial: 'Pjesshëm', weak: 'I dobët' },
  };
  const RESPONSIBILITY_LABELS = { central: 'Qendrore', local: 'Vendore', shared: 'E përbashkët' };
  const GOVERNMENT_PRIORITY_LABELS = { high: 'E lartë', medium: 'Mesatare', low: 'E ulët' };
  const MANAGEMENT_PLAN_LABELS = { yes: 'Ka plan menaxhimi', in_progress: 'Plan menaxhimi në hartim', none: 'Pa plan menaxhimi' };
  const SENSOR_RADIUS_KM = 25;
  const SENSOR_VALUE_LABELS = {
    P1: { label: 'PM10', unit: 'µg/m³' },
    P2: { label: 'PM2.5', unit: 'µg/m³' },
    temperature: { label: 'Temperatura', unit: '°C' },
    humidity: { label: 'Lagështia', unit: '%' },
    pressure: { label: 'Presioni', unit: 'hPa', transform: (value) => value / 100 },
    noise_LAeq: { label: 'Zhurma LAeq', unit: 'dB(A)' },
  };
  const sensorCache = new Map();
  const styles = (color) => ({
    point: new ol.style.Style({ image: new ol.style.Circle({ radius: 8, fill: new ol.style.Fill({ color }), stroke: new ol.style.Stroke({ color: '#fff', width: 2.5 }) }) }),
    selectedPoint: [new ol.style.Style({ image: new ol.style.Circle({ radius: 15, fill: new ol.style.Fill({ color: '#f6d34b' }), stroke: new ol.style.Stroke({ color: '#473b12', width: 1 }) }) }), new ol.style.Style({ image: new ol.style.Circle({ radius: 8, fill: new ol.style.Fill({ color }), stroke: new ol.style.Stroke({ color: '#fff', width: 2 }) }) })],
    area: new ol.style.Style({ fill: new ol.style.Fill({ color: `${color}45` }), stroke: new ol.style.Stroke({ color, width: 2 }) }),
    selectedArea: new ol.style.Style({ fill: new ol.style.Fill({ color: `${color}77` }), stroke: new ol.style.Stroke({ color: '#f6d34b', width: 5 }) }),
    line: new ol.style.Style({ stroke: new ol.style.Stroke({ color, width: 3 }) }),
    selectedLine: new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#f6d34b', width: 6 }) }),
  });
  const statusAppearances = Object.fromEntries(Object.entries(STATUS_COLORS).map(([level, color]) => [level, styles(color)]));
  const dangerAppearance = {
    point: [
      new ol.style.Style({ image: new ol.style.Circle({ radius: 14, fill: new ol.style.Fill({ color: '#c73f36' }), stroke: new ol.style.Stroke({ color: '#fff', width: 3 }) }) }),
      new ol.style.Style({ text: new ol.style.Text({ text: '!', font: '800 15px DM Sans', fill: new ol.style.Fill({ color: '#fff' }) }) }),
    ],
    selectedPoint: [new ol.style.Style({ image: new ol.style.Circle({ radius: 18, fill: new ol.style.Fill({ color: '#f6d34b' }), stroke: new ol.style.Stroke({ color: '#6d1e18', width: 2 }) }) }), new ol.style.Style({ text: new ol.style.Text({ text: '!', font: '800 16px DM Sans', fill: new ol.style.Fill({ color: '#6d1e18' }) }) })],
    area: [
      new ol.style.Style({ fill: new ol.style.Fill({ color: '#c73f3655' }), stroke: new ol.style.Stroke({ color: '#c73f36', width: 4 }) }),
      new ol.style.Style({ text: new ol.style.Text({ text: '!  NË RREZIK', font: '800 11px DM Sans', fill: new ol.style.Fill({ color: '#fff' }), backgroundFill: new ol.style.Fill({ color: '#ad3029' }), padding: [6, 9, 6, 9], overflow: true }) }),
    ],
    selectedArea: [
      new ol.style.Style({ fill: new ol.style.Fill({ color: '#c73f3677' }), stroke: new ol.style.Stroke({ color: '#f6d34b', width: 5 }) }),
      new ol.style.Style({ text: new ol.style.Text({ text: '!  NË RREZIK', font: '800 11px DM Sans', fill: new ol.style.Fill({ color: '#fff' }), backgroundFill: new ol.style.Fill({ color: '#ad3029' }), padding: [6, 9, 6, 9], overflow: true }) }),
    ],
    line: new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#c73f36', width: 5 }) }),
    selectedLine: new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#f6d34b', width: 7 }) }),
  };

  for (const group of manifest.groups) {
    const source = new ol.source.Vector();
    const appearance = styles(group.color || '#4d6a59');
    const layer = new ol.layer.Vector({ source, style: (feature) => {
      if (!feature.get('searchVisible')) return null;
      const kind = feature.getGeometry()?.getType() || '';
      const selected = feature.getId() === selectedId;
      const active = feature.get('hasActiveIssue') ? dangerAppearance : statusAppearances[feature.get('statusLevel')] || appearance;
      if (kind.includes('Polygon')) return selected ? active.selectedArea : active.area;
      if (kind.includes('LineString')) return selected ? active.selectedLine : active.line;
      return selected ? active.selectedPoint : active.point;
    } });
    groupStates.push({ group, source, layer });
    for (const file of group.files || []) {
      try {
        const response = await fetch(localPath(file));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const collection = await response.json();
        if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) throw new Error('GeoJSON i pavlefshëm');
        for (const featureData of collection.features) {
          if (!featureData.geometry) continue;
          const [feature] = format.readFeatures(featureData, { featureProjection: 'EPSG:3857' });
          if (!feature || !feature.getGeometry()) continue;
          const properties = { ...(featureData.properties || {}) };
          const id = String(featureData.id || properties.id || `${group.id}-${records.length + 1}`);
          if (records.some((record) => record.id === id)) continue;
          feature.setId(id);
          feature.set('searchVisible', true);
          source.addFeature(feature);
          records.push({ id, group, feature, properties, sourceFile: file });
        }
      } catch (error) {
        showNotice(`Nuk u ngarkua shtresa ${group.label}: ${file}. Kontrollo skedarin GeoJSON.`);
      }
    }
  }
  if (!records.length) { showNotice('Nuk ka objekte të vlefshme GeoJSON në grupet e hartës.'); return; }

  try {
    const response = await fetch(localPath('data/status/areas.json'));
    if (response.ok) {
      const payload = await response.json();
      const statusById = new Map((payload.areas || []).map((area) => [area.areaId, area]));
      for (const record of records) {
        const status = statusById.get(record.id);
        if (!status) continue;
        record.status = status;
        if (STATUS_COLORS[status.status]) record.feature.set('statusLevel', status.status);
      }
    }
  } catch { /* statusi është shtesë; harta funksionon edhe pa të */ }

  try {
    const response = await fetch(localPath('data/status/legislation.json'));
    if (response.ok) {
      const payload = await response.json();
      const legislationById = new Map((payload.legislation || []).map((entry) => [entry.areaId, entry]));
      for (const record of records) {
        const entry = legislationById.get(record.id);
        if (entry) record.legislation = entry;
      }
    }
  } catch { /* legjislacioni është shtesë; harta funksionon edhe pa të */ }

  try {
    const response = await fetch(localPath('data/status/issues.json'));
    if (response.ok) {
      const payload = await response.json();
      const issuesByArea = new Map();
      for (const issue of payload.issues || []) {
        if (!issuesByArea.has(issue.areaId)) issuesByArea.set(issue.areaId, []);
        issuesByArea.get(issue.areaId).push(issue);
      }
      for (const record of records) {
        record.issues = issuesByArea.get(record.id) || [];
        if (record.issues.some((issue) => ['ongoing', 'verification', 'paused'].includes(issue.status))) record.feature.set('hasActiveIssue', true);
      }
      document.getElementById('danger-count').textContent = String(records.filter((record) => record.feature.get('hasActiveIssue')).length);
    }
  } catch { /* regjistri i çështjeve është shtesë */ }

  const map = new ol.Map({
    target: mapElement,
    layers: [baseLayer, ...environmentalLayers.map((item) => item.layer), labelsLayer, ...[...groupStates].sort((a, b) => ({ parqe: 0, mbrojtura: 0, rezervate: 0, projekte: 0.5, protesta: 0.5, flora: 1, fauna: 2 }[a.group.id] ?? 1) - ({ parqe: 0, mbrojtura: 0, rezervate: 0, projekte: 0.5, protesta: 0.5, flora: 1, fauna: 2 }[b.group.id] ?? 1)).map((state) => state.layer)],
    view: new ol.View({ center: ol.proj.fromLonLat([20.2, 41.2]), zoom: 7.2, minZoom: 5 }),
  });
  const previewElement = document.getElementById('point-preview');
  const hidePointPreview = () => {
    previewElement.hidden = true;
  };
  const markSelected = (record) => {
    selectedId = record.id;
    groupStates.forEach((state) => state.layer.changed());
    listElement.querySelectorAll('.card-open').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.id === selectedId)));
  };
  const showPointPreview = (record, pixel) => {
    markSelected(record);
    detailPanel.hidden = true;
    const figure = imageFigure(record.properties.image, true);
    if (figure) figure.classList.add('preview-figure');
    const kicker = make('span', 'preview-kicker', record.properties.categoryLabel || record.group.label);
    const name = make('strong', 'preview-name', record.properties.name || 'Pa emër');
    const summary = make('p', 'preview-summary', record.properties.summary || record.properties.categoryLabel || record.group.label);
    const readMore = make('button', 'preview-read-more', 'Lexo më shumë');
    readMore.type = 'button';
    readMore.addEventListener('click', () => selectRecord(record));
    const close = make('button', 'preview-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Mbyll përmbledhjen');
    close.addEventListener('click', () => { hidePointPreview(); closeDetail(); });
    previewElement.replaceChildren(...(figure ? [figure] : []), kicker, name, summary, readMore, close);
    previewElement.hidden = false;
    const pane = mapElement.parentElement;
    const width = previewElement.offsetWidth;
    const height = previewElement.offsetHeight;
    const x = Math.max(12, Math.min(pane.clientWidth - width - 12, pixel[0] - width / 2));
    const above = pixel[1] - height - 20 >= 12;
    const y = above ? pixel[1] - height - 20 : pixel[1] + 20;
    previewElement.style.left = `${x}px`;
    previewElement.style.top = `${Math.max(12, Math.min(pane.clientHeight - height - 12, y))}px`;
    previewElement.dataset.position = above ? 'above' : 'below';
  };
  map.on('movestart', hidePointPreview);
  new ResizeObserver(() => map.updateSize()).observe(mapElement);
  const workspace = document.querySelector('.workspace');
  const catalogToggle = document.getElementById('catalog-toggle');
  const catalog = document.querySelector('.catalog');
  const catalogResizer = document.getElementById('catalog-resizer');
  const widthKey = 'nature-atlas-gallery-width';
  const openKey = 'nature-atlas-gallery-open-v3';
  const clampWidth = (width) => Math.max(280, Math.min(760, window.innerWidth - 320, width));
  const setCatalogWidth = (width) => {
    const value = Math.round(clampWidth(width));
    workspace.style.setProperty('--catalog-width', `${value}px`);
    catalogResizer.setAttribute('aria-valuenow', String(value));
    catalogResizer.setAttribute('aria-valuemax', String(Math.round(Math.max(280, Math.min(760, window.innerWidth - 320)))));
    return value;
  };
  const setCatalogOpen = (open) => {
    workspace.classList.toggle('catalog-open', open);
    catalog.inert = !open;
    catalog.setAttribute('aria-hidden', String(!open));
    catalogToggle.setAttribute('aria-expanded', String(open));
    catalogToggle.setAttribute('aria-label', open ? 'Fshih galerinë' : 'Shfaq galerinë');
    catalogToggle.title = open ? 'Fshih galerinë' : 'Shfaq galerinë';
    catalogToggle.textContent = open ? '‹' : '›';
    try { localStorage.setItem(openKey, String(open)); } catch { /* Preferenca është opsionale. */ }
    setTimeout(() => map.updateSize(), 220);
  };
  try {
    setCatalogWidth(Number(localStorage.getItem(widthKey)) || 365);
    const savedOpen = localStorage.getItem(openKey);
    setCatalogOpen(savedOpen === null ? window.innerWidth > 700 : savedOpen === 'true');
  } catch { setCatalogWidth(365); setCatalogOpen(window.innerWidth > 700); }
  catalogToggle.addEventListener('click', () => setCatalogOpen(!workspace.classList.contains('catalog-open')));
  document.getElementById('catalog-close').addEventListener('click', () => setCatalogOpen(false));
  catalogResizer.addEventListener('pointerdown', (event) => {
    if (window.innerWidth <= 700 || event.button !== 0) return;
    event.preventDefault();
    catalogResizer.setPointerCapture(event.pointerId);
    workspace.classList.add('catalog-resizing');
  });
  catalogResizer.addEventListener('pointermove', (event) => {
    if (!catalogResizer.hasPointerCapture(event.pointerId)) return;
    setCatalogWidth(event.clientX - catalog.getBoundingClientRect().left);
  });
  const finishResize = (event) => {
    if (!catalogResizer.hasPointerCapture(event.pointerId)) return;
    catalogResizer.releasePointerCapture(event.pointerId);
    workspace.classList.remove('catalog-resizing');
    try { localStorage.setItem(widthKey, catalogResizer.getAttribute('aria-valuenow')); } catch { /* Preferenca është opsionale. */ }
  };
  catalogResizer.addEventListener('pointerup', finishResize);
  catalogResizer.addEventListener('pointercancel', finishResize);
  catalogResizer.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = Number(catalogResizer.getAttribute('aria-valuenow'));
    const target = event.key === 'Home' ? 280 : event.key === 'End' ? 760 : current + (event.key === 'ArrowRight' ? 24 : -24);
    const value = setCatalogWidth(target);
    try { localStorage.setItem(widthKey, String(value)); } catch { /* Preferenca është opsionale. */ }
  });
  window.addEventListener('resize', () => setCatalogWidth(Number(catalogResizer.getAttribute('aria-valuenow'))));
  const basemapSwitcher = document.querySelector('.basemap-switcher');
  const basemapToggle = document.getElementById('basemap-toggle');
  const basemapOptions = document.getElementById('basemap-options');
  const basemapButtons = document.querySelectorAll('[data-basemap]');
  const basemapLabels = { standard: 'OpenStreetMap', satellite: 'Esri', terrain: 'Terreni', sentinel: 'Copernicus' };
  const closeBasemapOptions = () => {
    basemapOptions.hidden = true;
    basemapToggle.setAttribute('aria-expanded', 'false');
    basemapToggle.setAttribute('aria-label', `Harta bazë: ${document.getElementById('basemap-current-label').textContent}. Shfaq opsionet`);
  };
  const setBasemap = (key) => {
    baseLayer.setSource(baseSources[key] || baseSources.standard);
    labelsLayer.setVisible(key === 'satellite' || key === 'sentinel');
    basemapSwitcher.dataset.activeMap = key;
    document.getElementById('basemap-current-label').textContent = basemapLabels[key];
    basemapButtons.forEach((button) => {
      const selected = button.dataset.basemap === key;
      button.setAttribute('aria-pressed', String(selected));
      button.hidden = selected;
    });
    closeBasemapOptions();
  };
  basemapButtons.forEach((button) => button.addEventListener('click', () => { setBasemap(button.dataset.basemap); basemapToggle.focus(); }));
  basemapToggle.addEventListener('click', () => {
    const open = basemapOptions.hidden;
    basemapOptions.hidden = !open;
    basemapToggle.setAttribute('aria-expanded', String(open));
    basemapToggle.setAttribute('aria-label', `Harta bazë: ${document.getElementById('basemap-current-label').textContent}. ${open ? 'Fshih opsionet' : 'Shfaq opsionet'}`);
  });
  document.addEventListener('click', (event) => { if (!basemapSwitcher.contains(event.target)) closeBasemapOptions(); });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || basemapOptions.hidden) return;
    event.stopImmediatePropagation();
    closeBasemapOptions();
    basemapToggle.focus();
  });
  setBasemap('standard');
  const updateEnvironmentLabel = () => {
    const enabled = environmentalLayers.filter((item) => item.layer.getVisible());
    document.getElementById('environment-label').textContent = enabled.length === 0 ? 'Asnjë' : enabled.length === 1 ? enabled[0].label : `${enabled.length} shtresa`;
  };
  for (const item of environmentalLayers) {
    const option = make('label', 'environment-option');
    const checkbox = make('input');
    checkbox.type = 'checkbox';
    checkbox.value = item.id;
    checkbox.checked = item.layer.getVisible();
    const copy = make('span', 'environment-copy');
    copy.append(make('strong', '', item.label), make('small', '', item.provider), make('em', '', item.description));
    const swatch = make('i', 'environment-swatch');
    swatch.style.background = item.swatch;
    option.append(checkbox, swatch, copy);
    environmentOptions.append(option);
    checkbox.addEventListener('change', () => {
      item.layer.setVisible(checkbox.checked);
      updateEnvironmentLabel();
    });
  }
  const environmentHelp = make('p', 'environment-help');
  environmentHelp.textContent = 'Shtresat janë orientuese, vijnë drejtpërdrejt nga shërbimet burimore dhe mund të kombinohen. Aktivizimi i tyre nuk ndryshon të dhënat e atlasit.';
  environmentOptions.append(environmentHelp);
  updateEnvironmentLabel();
  for (const group of manifest.groups) {
    const option = make('label', 'filter-option');
    const checkbox = make('input');
    checkbox.type = 'checkbox';
    checkbox.value = group.id;
    checkbox.checked = true;
    const isArea = ['parqe', 'mbrojtura', 'rezervate', 'projekte', 'protesta'].includes(group.id);
    const dot = make('i', isArea ? 'key-dot key-area' : 'key-dot');
    dot.style.backgroundColor = group.color || '#4d6a59';
    option.append(checkbox, dot, make('span', '', group.label), make('small', '', records.filter((record) => record.group.id === group.id).length));
    scopeOptions.append(option);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) activeGroups.add(group.id);
      else activeGroups.delete(group.id);
      updateFilters();
    });
  }
  const noteLegend = make('div', 'note-legend');
  noteLegend.append(make('strong', '', 'Shënimet'));
  for (const category of ['red', 'yellow', 'green']) {
    const row = make('div', 'note-legend-row');
    const swatch = make('i', 'note-legend-swatch');
    swatch.style.background = noteCategories[category].color;
    row.append(swatch, make('span', '', noteCategories[category].label));
    noteLegend.append(row);
  }
  scopeOptions.append(noteLegend);
  countryOptions.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => checkbox.addEventListener('change', () => {
    if (checkbox.checked) activeCountries.add(checkbox.value);
    else activeCountries.delete(checkbox.value);
    updateFilters();
  }));
  document.getElementById('with-photo').addEventListener('change', (event) => {
    photoOnly = event.target.checked;
    updateFilters();
  });
  document.getElementById('danger-only').addEventListener('change', (event) => {
    dangerOnly = event.target.checked;
    document.getElementById('danger-label').textContent = dangerOnly ? 'Në rrezik' : 'Të gjitha';
    updateFilters();
    if (dangerOnly) focusVisible();
  });
  const matches = (record) => activeGroups.has(record.group.id)
    && (activeCountries.size === 2 || (record.properties.countryCodes || []).some((country) => activeCountries.has(country)))
    && (!photoOnly || Boolean(record.properties.image))
    && (!dangerOnly || record.feature.get('hasActiveIssue'))
    && [record.properties.name, record.properties.location, record.properties.categoryLabel, record.properties.summary, ...(record.properties.keywords || [])]
      .join(' ').toLocaleLowerCase('sq').includes(query);
  const shownRecords = () => records.filter(matches);
  const observationDate = (place) => {
    const value = place.extra?.Data;
    if (!value || value === 'E panjohur') return '';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('sq-AL', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  };
  const geometryLabel = (feature) => {
    const kind = feature.getGeometry().getType();
    return ({ Polygon: 'Sipërfaqe', MultiPolygon: 'Shumëpoligon', Point: 'Pikë', LineString: 'Vijë', MultiLineString: 'Shumëvijë' })[kind] || kind;
  };
  const haversineKm = ([lon1, lat1], [lon2, lat2]) => {
    const radians = (degrees) => degrees * Math.PI / 180;
    const dLat = radians(lat2 - lat1);
    const dLon = radians(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const recordCenter = (record) => ol.proj.toLonLat(ol.extent.getCenter(record.feature.getGeometry().getExtent()));
  const loadNearbySensors = async (record) => {
    if (sensorCache.has(record.id)) return sensorCache.get(record.id);
    const [lon, lat] = recordCenter(record);
    const request = fetch(`https://data.sensor.community/airrohr/v1/filter/area=${lat.toFixed(5)},${lon.toFixed(5)},${SENSOR_RADIUS_KM}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((measurements) => {
        const stations = new Map();
        for (const measurement of Array.isArray(measurements) ? measurements : []) {
          const location = measurement.location || {};
          if (Number(location.indoor) === 1) continue;
          const stationLon = Number(location.longitude);
          const stationLat = Number(location.latitude);
          if (!Number.isFinite(stationLon) || !Number.isFinite(stationLat)) continue;
          const key = String(location.id || `${stationLat.toFixed(5)},${stationLon.toFixed(5)}`);
          const station = stations.get(key) || {
            id: key,
            coordinates: [stationLon, stationLat],
            distanceKm: haversineKm([lon, lat], [stationLon, stationLat]),
            timestamp: measurement.timestamp,
            values: {},
            valueTimes: {},
            sensorIds: new Set(),
          };
          if (measurement.timestamp > station.timestamp) station.timestamp = measurement.timestamp;
          if (measurement.sensor?.id) station.sensorIds.add(String(measurement.sensor.id));
          for (const item of measurement.sensordatavalues || []) {
            if (!SENSOR_VALUE_LABELS[item.value_type]) continue;
            const value = Number(item.value);
            if (Number.isFinite(value) && (!station.valueTimes[item.value_type] || measurement.timestamp > station.valueTimes[item.value_type])) {
              station.values[item.value_type] = value;
              station.valueTimes[item.value_type] = measurement.timestamp;
            }
          }
          stations.set(key, station);
        }
        return [...stations.values()]
          .filter((station) => Object.keys(station.values).length)
          .sort((a, b) => a.distanceKm - b.distanceKm)[0] || null;
      });
    sensorCache.set(record.id, request);
    request.catch(() => sensorCache.delete(record.id));
    return request;
  };
  const renderSensorSection = async (record, section) => {
    try {
      const station = await loadNearbySensors(record);
      if (selectedId !== record.id || !detailContent.contains(section)) return;
      section.replaceChildren(make('h3', '', 'Matje aktuale pranë zonës'));
      if (!station) {
        section.append(make('p', 'sensor-empty', `Nuk u gjet asnjë sensor publik aktiv brenda ${SENSOR_RADIUS_KM} km në pesë minutat e fundit.`));
        const join = safeLink('Si të ndërtosh dhe regjistrosh një sensor të hapur ↗', 'https://sensor.community/en/sensors/airrohr/');
        if (join) section.append(join);
        return;
      }
      const grid = make('div', 'sensor-grid');
      for (const [key, rawValue] of Object.entries(station.values)) {
        const definition = SENSOR_VALUE_LABELS[key];
        const value = definition.transform ? definition.transform(rawValue) : rawValue;
        const tile = make('div', 'sensor-reading');
        tile.append(make('span', '', definition.label), make('strong', '', `${Number(value.toFixed(1))} ${definition.unit}`));
        grid.append(tile);
      }
      section.append(grid);
      const measuredAt = new Date(`${station.timestamp.replace(' ', 'T')}Z`);
      const time = Number.isNaN(measuredAt.getTime()) ? station.timestamp : new Intl.DateTimeFormat('sq-AL', { dateStyle: 'medium', timeStyle: 'short' }).format(measuredAt);
      section.append(make('p', 'sensor-meta', `Sensori më i afërt: ${station.distanceKm.toFixed(1)} km · Përditësuar ${time}`));
      section.append(make('p', 'sensor-caveat', 'Matje orientuese nga një sensor komunitar me kosto të ulët; nuk përfaqëson domosdoshmërisht kushtet brenda gjithë zonës dhe nuk zëvendëson monitorimin zyrtar.'));
      const source = safeLink('Të dhënat dhe harta · Sensor.Community ↗', 'https://maps.sensor.community/');
      if (source) section.append(source);
    } catch {
      if (selectedId !== record.id || !detailContent.contains(section)) return;
      section.replaceChildren(make('h3', '', 'Matje aktuale pranë zonës'), make('p', 'sensor-empty', 'Matjet e drejtpërdrejta nuk janë të disponueshme tani. Provo përsëri më vonë.'));
    }
  };
  const focusVisible = () => {
    const shown = shownRecords();
    if (!shown.length) return;
    const extent = ol.extent.createEmpty();
    shown.forEach((record) => ol.extent.extend(extent, record.feature.getGeometry().getExtent()));
    map.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 10, duration: 350 });
  };
  const expandedGroups = new Set(manifest.groups.length ? [manifest.groups[0].id] : []);
  const renderCards = () => {
    const shown = shownRecords();
    document.getElementById('place-count').textContent = String(shown.length);
    document.getElementById('result-label').textContent = `${shown.length} ${shown.length === 1 ? 'rezultat' : 'rezultate'}`;
    listElement.replaceChildren();
    const priorityRecords = shown.filter((record) => record.issues?.some((issue) => ['ongoing', 'verification', 'paused'].includes(issue.status)));
    if (priorityRecords.length) {
      const priority = make('section', 'priority-places');
      const heading = make('div', 'priority-places-heading');
      heading.append(make('span', 'priority-alert', '!'), make('strong', '', 'VENDE NË RREZIK'), make('small', '', `${priorityRecords.length} prioritare`));
      priority.append(heading);
      for (const record of priorityRecords.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.issues[0]?.priority] ?? 3) - ({ high: 0, medium: 1, low: 2 }[b.issues[0]?.priority] ?? 3))) {
        const issue = record.issues[0];
        const button = make('button', 'priority-place');
        button.type = 'button';
        const copy = make('span', 'priority-place-copy');
        copy.append(make('strong', '', record.properties.name), make('small', '', issue.activity));
        button.append(copy, make('span', `priority-level priority-${issue.priority}`, issue.priority === 'high' ? 'Prioritet i lartë' : issue.priority === 'low' ? 'Prioritet i ulët' : 'Prioritet mesatar'), make('b', '', '↗'));
        button.addEventListener('click', () => selectRecord(record));
        priority.append(button);
      }
      listElement.append(priority);
    }
    if (shown.length && !shown.some((record) => expandedGroups.has(record.group.id))) expandedGroups.add(shown[0].group.id);
    for (const group of manifest.groups) {
      const groupRecords = shown.filter((record) => record.group.id === group.id);
      if (!groupRecords.length) continue;
      const section = make('details', 'gallery-group');
      section.setAttribute('aria-label', group.label);
      section.open = expandedGroups.has(group.id);
      section.addEventListener('toggle', () => {
        if (section.open) expandedGroups.add(group.id);
        else expandedGroups.delete(group.id);
      });
      const heading = make('summary', 'gallery-group-heading');
      const dot = make('span', 'gallery-group-dot');
      dot.style.backgroundColor = group.color || '#4d6a59';
      heading.append(dot, make('span', 'gallery-group-name', group.label), make('span', 'gallery-group-count', groupRecords.length), make('span', 'gallery-group-chevron', '⌄'));
      const cards = make('div', 'gallery-group-cards');
      for (const record of groupRecords) {
      const place = record.properties;
      const observation = record.id.startsWith('gbif-');
      const card = make('article', `place-card ${observation ? 'observation-card' : 'atlas-area-card'}`);
      const openCard = make('button', 'card-open');
      openCard.type = 'button';
      openCard.dataset.id = record.id;
      openCard.setAttribute('aria-pressed', String(record.id === selectedId));
      const top = make('span', 'card-top');
      const dot = make('span', 'category-dot');
      dot.style.backgroundColor = record.group.color;
      top.append(dot, make('span', 'card-category', place.categoryLabel || record.group.label));
      if (record.status) {
        const statusDot = make('span', 'health-dot');
        statusDot.style.backgroundColor = STATUS_COLORS[record.status.status] || '#898781';
        statusDot.title = STATUS_LABELS[record.status.status] || record.status.status;
        top.append(statusDot);
      }
      top.append(make('span', 'geometry-badge', observation ? 'Vëzhgim' : geometryLabel(record.feature)));
      const bottom = make('span', 'card-bottom');
      bottom.append(make('span', '', observation ? observationDate(place) || 'Pa datë' : place.location || ''), make('span', '', 'Shiko në hartë ↗'));
      const photo = imageFigure(place.image, true);
      if (photo) openCard.append(photo);
      openCard.append(top, make('strong', 'card-title', place.name || 'Pa emër'));
      if (observation) openCard.append(make('span', 'card-location', place.location || 'Vendndodhje e panjohur'));
      else {
        openCard.append(make('span', 'card-summary', place.summary || ''));
        const counts = [place.extra?.['Vëzhgime flore'] && `${place.extra['Vëzhgime flore']} florë`, place.extra?.['Vëzhgime faune'] && `${place.extra['Vëzhgime faune']} faunë`].filter(Boolean);
        if (counts.length) openCard.append(make('span', 'area-observations', `Vëzhgime brenda kufirit · ${counts.join(' · ')}`));
      }
      openCard.append(bottom);
      openCard.addEventListener('click', () => selectRecord(record));
      card.append(openCard);
      if (photo && place.image?.source) {
        const imageLink = safeLink('Burimi i fotografisë ↗', place.image.source);
        if (imageLink) {
          imageLink.classList.add('card-image-link');
          card.append(imageLink);
        }
      }
        cards.append(card);
      }
      section.append(heading, cards);
      listElement.append(section);
    }
    if (!shown.length) listElement.append(make('p', 'no-results', 'Nuk u gjet asnjë zonë ose vëzhgim. Ndrysho filtrat ose kërkimin.'));
    groupStates.forEach((state) => {
      state.layer.setVisible(activeGroups.has(state.group.id));
      state.source.getFeatures().forEach((feature) => {
        const record = records.find((item) => item.feature === feature);
        feature.set('searchVisible', record ? matches(record) : false);
      });
      state.layer.changed();
    });
    if (selectedId && !shown.some((record) => record.id === selectedId)) closeDetail();
  };
  const updateFilters = () => {
    hidePointPreview();
    const selectedGroups = manifest.groups.filter((group) => activeGroups.has(group.id));
    document.getElementById('scope-label').textContent = selectedGroups.length === manifest.groups.length ? 'Të gjitha' : selectedGroups.length === 1 ? selectedGroups[0].label : selectedGroups.length ? `${selectedGroups.length} fusha` : 'Asnjë';
    document.getElementById('country-label').textContent = activeCountries.size === 2 ? 'Të dy' : activeCountries.has('AL') ? 'Shqipëri' : activeCountries.has('XK') ? 'Kosovë' : 'Asnjë';
    renderCards();
  };
  document.addEventListener('click', (event) => {
    for (const menu of document.querySelectorAll('.header-filter')) if (!menu.contains(event.target)) menu.open = false;
  });
  const selectRecord = (record) => {
    hidePointPreview();
    if (!notesEditor.hidden) closeNotesEditor();
    markSelected(record);
    const place = record.properties;
    const observation = record.id.startsWith('gbif-');
    detailContent.replaceChildren();
    const photo = imageFigure(place.image);
    if (photo) detailContent.append(photo);
    const heading = make('div', 'record-heading');
    heading.append(make('p', 'record-kicker', place.categoryLabel || record.group.label), make('h2', '', place.name || 'Pa emër'), make('p', 'record-intro', place.summary || ''));
    detailContent.append(heading);
    const facts = make('div', 'record-facts');
    const addFact = (label, value) => {
      if (!value) return;
      const fact = make('div', 'record-fact');
      fact.append(make('span', 'fact-label', label), make('strong', 'fact-value', value));
      facts.append(fact);
    };
    addFact('Vendi', place.location);
    if (observation) addFact('Vëzhguar', observationDate(place) || 'Pa datë');
    else {
      addFact('Gjeometria', geometryLabel(record.feature));
      if (place.extra?.['Vëzhgime flore']) addFact('Flora', `${place.extra['Vëzhgime flore']} vëzhgime`);
      if (place.extra?.['Vëzhgime faune']) addFact('Fauna', `${place.extra['Vëzhgime faune']} vëzhgime`);
    }
    detailContent.append(facts);
    if (!observation && record.feature.getGeometry()?.getType().includes('Polygon')) {
      const area = record.feature.getGeometry();
      const nearby = records.filter((item) => item.id.startsWith('gbif-') && item.feature.getGeometry()?.getType() === 'Point' && area.intersectsCoordinate(item.feature.getGeometry().getCoordinates()));
      if (nearby.length) {
        const section = make('section', 'record-section related-section');
        section.append(make('h3', '', `Vëzhgime brenda kufirit (${nearby.length})`));
        const list = make('div', 'related-list');
        for (const item of nearby) {
          const button = make('button', 'related-record');
          button.type = 'button';
          const image = imageFigure(item.properties.image, true);
          if (image) button.append(image);
          const copy = make('span', 'related-copy');
          copy.append(make('strong', '', item.properties.name), make('small', '', `${item.group.label} · ${observationDate(item.properties) || 'Pa datë'}`));
          button.append(copy, make('span', 'related-arrow', '↗'));
          button.addEventListener('click', () => {
            activeGroups.add(item.group.id);
            activeCountries.add('AL');
            activeCountries.add('XK');
            photoOnly = false;
            dangerOnly = false;
            query = '';
            search.value = '';
            document.getElementById('with-photo').checked = false;
            document.getElementById('danger-only').checked = false;
            document.getElementById('danger-label').textContent = 'Të gjitha';
            countryOptions.querySelectorAll('input').forEach((country) => { country.checked = true; });
            scopeOptions.querySelectorAll('input').forEach((scope) => { scope.checked = activeGroups.has(scope.value); });
            updateFilters();
            selectRecord(item);
          });
          list.append(button);
        }
        section.append(list);
        detailContent.append(section);
      }
    }
    if (Array.isArray(place.details) && place.details.length) {
      const body = make('section', 'record-section');
      body.append(make('h3', '', observation ? 'Rreth vëzhgimit' : 'Brenda kësaj zone'));
      place.details.forEach((paragraph) => body.append(make('p', '', paragraph)));
      if (place.wikipediaAttribution) body.append(make('p', 'record-attribution', place.wikipediaAttribution));
      detailContent.append(body);
    }
    const mapping = make('section', 'record-section');
    mapping.append(make('h3', '', 'Çfarë tregon harta'), make('p', '', place.mapNote || `Objekti është vizatuar si ${geometryLabel(record.feature).toLowerCase()}.`));
    detailContent.append(mapping);
    if (record.issues?.length) {
      const section = make('section', 'record-section issue-section');
      section.append(make('h3', '', 'Aktivitet që rrezikon trashëgiminë'));
      for (const issue of record.issues) {
        const issueCard = make('article', 'issue-card');
        const head = make('div', 'issue-card-head');
        const priorityLabel = issue.priority === 'high' ? 'Prioritet i lartë' : issue.priority === 'low' ? 'Prioritet i ulët' : 'Prioritet mesatar';
        const statusLabel = issue.status === 'ongoing' ? 'Në vazhdim' : issue.status === 'paused' ? 'Pezulluar' : issue.status === 'closed' ? 'Mbyllur' : 'Për verifikim';
        head.append(make('span', `priority-level priority-${issue.priority}`, priorityLabel), make('span', 'issue-status', statusLabel));
        issueCard.append(head, make('h4', '', issue.activity));
        if (issue.threatType) issueCard.append(make('p', 'record-tag', `Lloji: ${issue.threatType}`));
        if (issue.description) issueCard.append(make('p', '', issue.description));
        if (issue.reportedAt || issue.updatedAt) issueCard.append(make('p', 'issue-date', [issue.reportedAt && `Raportuar: ${issue.reportedAt}`, issue.updatedAt && `Përditësuar: ${issue.updatedAt}`].filter(Boolean).join(' · ')));
        if (issue.reportedBy) issueCard.append(make('p', 'issue-reporter', `Raportuar nga ${issue.reportedBy}`));
        const evidence = issue.evidenceUrl && safeLink('Hap dëshminë burimore ↗', issue.evidenceUrl);
        if (evidence) issueCard.append(evidence);
        section.append(issueCard);
      }
      detailContent.append(section);
    }
    if (!observation) {
      const sensorSection = make('section', 'record-section sensor-section');
      sensorSection.setAttribute('aria-live', 'polite');
      sensorSection.append(make('h3', '', 'Matje aktuale pranë zonës'), make('p', 'sensor-loading', 'Duke kërkuar sensorë të hapur pranë kësaj zone…'));
      detailContent.append(sensorSection);
      renderSensorSection(record, sensorSection);
    }
    if (record.status) {
      const section = make('section', 'record-section');
      section.append(make('h3', '', 'Gjendja e zonës'));
      const badge = make('p', 'status-badge-inline');
      const dot = make('span', 'health-dot');
      dot.style.backgroundColor = STATUS_COLORS[record.status.status] || '#898781';
      badge.append(dot, make('span', '', STATUS_LABELS[record.status.status] || record.status.status));
      section.append(badge);
      if (record.status.lastAssessed) section.append(make('p', 'record-tag', `Vlerësuar më: ${record.status.lastAssessed}`));
      if (record.status.assessedBy) section.append(make('p', 'record-tag', `Organizata vlerësuese: ${record.status.assessedBy}`));
      for (const [key, labels] of Object.entries(INDICATOR_LABELS)) {
        const value = record.status.indicators?.[key];
        if (value) section.append(make('p', 'record-tag', `${labels.key}: ${labels[value] || value}`));
      }
      if (record.status.notes) section.append(make('p', '', record.status.notes));
      const evidence = record.status.evidenceUrl && safeLink('Dëshmia e vlerësimit ↗', record.status.evidenceUrl);
      if (evidence) section.append(evidence);
      detailContent.append(section);
    }
    if (record.legislation) {
      const section = make('section', 'record-section');
      section.append(make('h3', '', 'Kuadri ligjor'));
      if (record.legislation.protectionCategory) section.append(make('p', '', record.legislation.protectionCategory));
      if (record.legislation.legalBasis) section.append(make('p', 'record-tag', record.legislation.legalBasis));
      if (record.legislation.responsibilityLevel) section.append(make('p', 'record-tag', `Përgjegjësia: ${RESPONSIBILITY_LABELS[record.legislation.responsibilityLevel] || record.legislation.responsibilityLevel}`));
      if (record.legislation.governmentPriority) section.append(make('p', 'record-tag', `Përparësia e qeverisë: ${GOVERNMENT_PRIORITY_LABELS[record.legislation.governmentPriority] || record.legislation.governmentPriority}`));
      if (record.legislation.managementPlan) section.append(make('p', 'record-tag', MANAGEMENT_PLAN_LABELS[record.legislation.managementPlan] || record.legislation.managementPlan));
      if (record.legislation.notes) section.append(make('p', '', record.legislation.notes));
      const legalLink = record.legislation.link && safeLink('Teksti ligjor ↗', record.legislation.link);
      if (legalLink) section.append(legalLink);
      detailContent.append(section);
    }
    const extra = place.extra || place.attributes;
    if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
      const hidden = observation ? new Set(['Lloji', 'Data']) : new Set(['Vëzhgime flore', 'Vëzhgime faune']);
      const entries = Object.entries(extra).filter(([key, value]) => !hidden.has(key) && value);
      if (entries.length) {
      const section = make('section', 'record-section');
      section.append(make('h3', '', observation ? 'Të dhënat e burimit' : 'Informacion tjetër'));
      for (const [key, value] of entries) {
        const row = make('div', 'source-fact');
        row.append(make('span', '', key), make('strong', '', value));
        section.append(row);
      }
      detailContent.append(section);
      }
    }
    const tags = place.osm?.tags || {};
    if (Object.keys(tags).length) {
      const section = make('details', 'record-section technical-details');
      section.append(make('summary', '', 'Etiketat OSM'));
      for (const [key, value] of Object.entries(tags)) section.append(make('p', 'record-tag', `${key}: ${value}`));
      detailContent.append(section);
    }
    if (Array.isArray(place.sources) && place.sources.length) {
      const section = make('section', 'record-section record-sources');
      section.append(make('h3', '', 'Burimet dhe atribuimi'));
      for (const source of place.sources) {
        const link = safeLink(`${source.label || 'Burim'} ↗`, source.url);
        if (link) section.append(link);
      }
      detailContent.append(section);
    }
    detailPanel.hidden = false;
    renderCards();
    detailPanel.scrollTop = 0;
    if (window.innerWidth <= 700) {
      setCatalogOpen(false);
    }
  };
  function closeDetail() {
    hidePointPreview();
    selectedId = null;
    detailPanel.hidden = true;
    groupStates.forEach((state) => state.layer.changed());
    listElement.querySelectorAll('.card-open').forEach((button) => button.setAttribute('aria-pressed', 'false'));
  }
  const notesKey = 'heritage-map-notes-v1';
  const noteBanner = document.getElementById('note-banner');
  const notesEditor = document.getElementById('notes-editor');
  const noteForm = document.getElementById('note-form');
  const noteText = document.getElementById('note-text');
  const noteList = document.getElementById('note-list');
  const exportNotes = document.getElementById('export-notes');
  const noteState = new Map();
  const noteReadZoom = 11;
  let placingNote = false;
  let pendingCoordinate = null;
  const updateNoteVisibility = () => {
    const compact = (map.getView().getZoom() ?? 0) < noteReadZoom;
    for (const note of noteState.values()) {
      const element = note.overlay.getElement();
      element.classList.toggle('sticky-note-compact', compact);
      element.tabIndex = compact ? 0 : -1;
      if (compact) {
        element.setAttribute('role', 'button');
        element.setAttribute('aria-label', `${noteCategories[note.category].label}. Afro hartën për të lexuar shënimin`);
      } else {
        element.removeAttribute('role');
        element.removeAttribute('aria-label');
      }
    }
  };
  map.getView().on('change:resolution', updateNoteVisibility);
  const noteRotation = (id) => {
    let hash = 0;
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return ((hash % 900) / 100) - 4.5;
  };
  const createNoteOverlay = (id, text, category, published = false, source = '') => {
    const element = make('div', 'sticky-note');
    if (published) element.classList.add('sticky-note-published');
    element.style.setProperty('--note-color', noteCategories[category].color);
    element.style.setProperty('--note-rotate', `${noteRotation(id)}deg`);
    const deleteButton = make('button', 'sticky-note-delete', '×');
    deleteButton.type = 'button';
    deleteButton.setAttribute('aria-label', 'Fshi shënimin');
    deleteButton.addEventListener('click', () => deleteNote(id));
    element.append(make('span', 'sticky-note-category', noteCategories[category].label), make('p', 'sticky-note-text', text));
    if (published) {
      const sourceLink = source && safeLink('Lexo burimin ↗', source);
      if (sourceLink) {
        sourceLink.classList.add('sticky-note-source');
        element.append(sourceLink);
      }
    } else element.append(deleteButton);
    const revealNote = () => {
      if (element.classList.contains('sticky-note-compact')) map.getView().animate({ center: noteState.get(id)?.overlay.getPosition(), zoom: noteReadZoom, duration: 300 });
    };
    element.addEventListener('click', revealNote);
    element.addEventListener('keydown', (event) => {
      if (!['Enter', ' '].includes(event.key) || !element.classList.contains('sticky-note-compact')) return;
      event.preventDefault();
      revealNote();
    });
    return new ol.Overlay({ element, positioning: 'bottom-center', offset: [0, -6], stopEvent: true });
  };
  const renderNoteList = () => {
    noteList.replaceChildren();
    let localNoteCount = 0;
    for (const [id, note] of noteState) {
      if (note.published) continue;
      localNoteCount += 1;
      const item = make('div', 'note-item');
      const dot = make('span', 'note-item-dot');
      dot.style.background = noteCategories[note.category].color;
      dot.title = noteCategories[note.category].label;
      const openButton = make('button', 'note-item-open', note.text.length > 60 ? `${note.text.slice(0, 60)}…` : note.text);
      openButton.type = 'button';
      openButton.addEventListener('click', () => map.getView().animate({ center: ol.proj.fromLonLat(note.coordinate), zoom: Math.max(map.getView().getZoom(), noteReadZoom), duration: 300 }));
      const deleteButton = make('button', 'note-item-delete', '×');
      deleteButton.type = 'button';
      deleteButton.setAttribute('aria-label', 'Fshi shënimin');
      deleteButton.addEventListener('click', () => deleteNote(id));
      item.append(dot, openButton, deleteButton);
      noteList.append(item);
    }
    if (!localNoteCount) noteList.append(make('p', 'no-results', 'Ende pa shënime.'));
    exportNotes.disabled = localNoteCount === 0;
    exportNotes.title = localNoteCount ? `Shkarko ${localNoteCount} shënime si GeoJSON` : 'Shto një shënim përpara se ta shkarkosh';
  };
  const saveNotes = () => {
    const collection = {
      type: 'FeatureCollection',
      features: [...noteState.entries()].filter(([, note]) => !note.published).map(([id, note]) => ({ type: 'Feature', id, geometry: { type: 'Point', coordinates: note.coordinate }, properties: { text: note.text, category: note.category, color: noteCategories[note.category].color } })),
    };
    try { localStorage.setItem(notesKey, JSON.stringify(collection)); }
    catch { showNotice('Shënimet nuk mund të ruhen në këtë shfletues.'); }
  };
  const addNote = (id, text, category, coordinate, published = false, source = '') => {
    const overlay = createNoteOverlay(id, text, category, published, source);
    overlay.setPosition(ol.proj.fromLonLat(coordinate));
    map.addOverlay(overlay);
    noteState.set(id, { text, category, coordinate, overlay, published });
    updateNoteVisibility();
  };
  const deleteNote = (id) => {
    const note = noteState.get(id);
    if (!note || note.published) return;
    map.removeOverlay(note.overlay);
    noteState.delete(id);
    renderNoteList();
    saveNotes();
  };
  const loadPublishedNotes = async () => {
    try {
      const response = await fetch(localPath('data/manual/notes.geojson'));
      if (!response.ok) return;
      const collection = await response.json();
      for (const feature of collection.features || []) {
        const coordinates = feature?.geometry?.coordinates;
        if (feature?.geometry?.type !== 'Point' || !Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.every(Number.isFinite)) continue;
        const id = String(feature.id || '');
        const text = String(feature.properties?.text || '').trim();
        if (!id || !text || noteState.has(id)) continue;
        addNote(id, text, noteCategory(feature.properties?.category, feature.properties?.color), coordinates, true, feature.properties?.source || '');
      }
    } catch { /* Published notes are optional if the data file is unavailable. */ }
  };
  const loadNotes = () => {
    let collection;
    try { collection = JSON.parse(localStorage.getItem(notesKey) || '{"type":"FeatureCollection","features":[]}'); }
    catch { collection = { type: 'FeatureCollection', features: [] }; }
    for (const feature of collection.features || []) {
      if (feature?.geometry?.type !== 'Point' || !Array.isArray(feature.geometry.coordinates)) continue;
      const id = String(feature.id ?? newLocalId());
      if (noteState.has(id)) continue;
      addNote(id, String(feature.properties?.text || ''), noteCategory(feature.properties?.category, feature.properties?.color), feature.geometry.coordinates);
    }
    renderNoteList();
  };
  const cancelNotePlacement = () => {
    placingNote = false;
    pendingCoordinate = null;
    noteBanner.hidden = true;
    noteForm.hidden = true;
    noteForm.reset();
  };
  const closeNotesEditor = () => {
    cancelNotePlacement();
    notesEditor.hidden = true;
  };
  document.getElementById('open-notes').addEventListener('click', () => {
    closeDetail();
    notesEditor.hidden = false;
    if (window.innerWidth <= 700) {
      setCatalogOpen(false);
    }
  });
  if (new URLSearchParams(window.location.search).get('notes') === '1') document.getElementById('open-notes').click();
  document.getElementById('close-notes-editor').addEventListener('click', closeNotesEditor);
  document.getElementById('start-note').addEventListener('click', () => {
    noteForm.hidden = true;
    noteForm.reset();
    notesEditor.hidden = true;
    noteBanner.hidden = false;
    placingNote = true;
  });
  document.getElementById('cancel-note').addEventListener('click', () => {
    cancelNotePlacement();
    notesEditor.hidden = false;
  });
  document.getElementById('cancel-note-form').addEventListener('click', () => {
    noteForm.hidden = true;
    noteForm.reset();
    pendingCoordinate = null;
  });
  noteForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = noteText.value.trim();
    if (!text || !pendingCoordinate) return;
    const category = noteForm.querySelector('input[name="category"]:checked')?.value || 'yellow';
    addNote(newLocalId(), text, noteCategory(category), pendingCoordinate);
    pendingCoordinate = null;
    renderNoteList();
    saveNotes();
    noteForm.reset();
    noteForm.hidden = true;
  });
  document.getElementById('notes-import').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('GeoJSON duhet të jetë FeatureCollection');
      let imported = 0;
      for (const feature of data.features) {
        if (feature?.geometry?.type !== 'Point' || !Array.isArray(feature.geometry.coordinates)) continue;
        let id = String(feature.id ?? newLocalId());
        if (noteState.has(id)) id = newLocalId();
        addNote(id, String(feature.properties?.text || ''), noteCategory(feature.properties?.category, feature.properties?.color), feature.geometry.coordinates);
        imported += 1;
      }
      renderNoteList();
      saveNotes();
      showNotice(`${imported} shënime u importuan.`);
    } catch { showNotice('Skedari nuk u importua. Kontrollo që është një GeoJSON FeatureCollection i vlefshëm me pika.'); }
    event.target.value = '';
  });
  exportNotes.addEventListener('click', () => {
    const collection = {
      type: 'FeatureCollection',
      features: [...noteState.entries()].filter(([, note]) => !note.published).map(([id, note]) => ({ type: 'Feature', id, geometry: { type: 'Point', coordinates: note.coordinate }, properties: { text: note.text, category: note.category, color: noteCategories[note.category].color } })),
    };
    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const anchor = make('a');
    anchor.href = url;
    anchor.download = `shenime-harta-${new Date().toISOString().slice(0, 10)}.geojson`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    showNotice(`${collection.features.length} shënime u shkarkuan si GeoJSON.`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  search.addEventListener('input', () => { query = search.value.trim().toLocaleLowerCase('sq'); renderCards(); });
  document.getElementById('close-detail').addEventListener('click', closeDetail);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (document.getElementById('project-intro').open) return;
    if (!previewElement.hidden) { closeDetail(); return; }
    const openMenu = document.querySelector('.header-filter[open]');
    if (openMenu) { openMenu.open = false; openMenu.querySelector('summary')?.focus(); return; }
    if (placingNote) { cancelNotePlacement(); notesEditor.hidden = false; }
    else if (!notesEditor.hidden) closeNotesEditor();
    else if (!detailPanel.hidden) closeDetail();
  });
  map.on('singleclick', (event) => {
    if (placingNote) {
      pendingCoordinate = ol.proj.toLonLat(event.coordinate);
      placingNote = false;
      noteBanner.hidden = true;
      notesEditor.hidden = false;
      noteForm.hidden = false;
      noteText.focus();
      return;
    }
    hidePointPreview();
    const feature = map.forEachFeatureAtPixel(event.pixel, (candidate, layer) => (layer !== baseLayer && layer !== labelsLayer) ? candidate : null, { hitTolerance: 6 });
    const record = records.find((item) => item.feature === feature);
    if (record && matches(record)) {
      if (feature.getGeometry()?.getType() === 'Point') showPointPreview(record, event.pixel);
      else selectRecord(record);
    } else closeDetail();
  });
  map.on('pointermove', (event) => {
    const feature = event.dragging ? null : map.forEachFeatureAtPixel(event.pixel, (candidate) => candidate, { hitTolerance: 6 });
    const record = records.find((item) => item.feature === feature);
    const visible = record && matches(record);
    mapElement.style.cursor = placingNote ? 'crosshair' : visible ? 'pointer' : '';
  });
  await loadPublishedNotes();
  loadNotes();
  updateFilters();
  focusVisible();
})();
