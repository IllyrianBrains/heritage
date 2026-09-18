(async () => {
  const mapElement = document.getElementById('heritage-map');
  const listElement = document.getElementById('place-list');
  const detailPanel = document.getElementById('place-detail');
  const detailContent = document.getElementById('detail-content');
  const notice = document.getElementById('map-notice');
  const search = document.getElementById('place-search');
  const scopeOptions = document.getElementById('scope-options');
  const countryOptions = document.getElementById('country-options');
  const legend = document.querySelector('.map-key');
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
    if (!compact && image.licenseUrl) {
      const license = safeLink('Kushtet e licencës ↗', image.licenseUrl);
      if (license) figure.append(license);
    }
    return figure;
  };
  if (!window.ol) { showNotice('Harta nuk u ngarkua. Kontrollo lidhjen me internetin dhe rifresko faqen.'); return; }

  let manifest;
  try {
    const response = await fetch('/data/groups.json');
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
  let selectedId = null;
  let query = '';
  const activeCountries = new Set(['AL', 'XK']);
  let photoOnly = false;
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
  const styles = (color) => ({
    point: new ol.style.Style({ image: new ol.style.Circle({ radius: 8, fill: new ol.style.Fill({ color }), stroke: new ol.style.Stroke({ color: '#fff', width: 2.5 }) }) }),
    selectedPoint: [new ol.style.Style({ image: new ol.style.Circle({ radius: 15, fill: new ol.style.Fill({ color: '#f6d34b' }), stroke: new ol.style.Stroke({ color: '#473b12', width: 1 }) }) }), new ol.style.Style({ image: new ol.style.Circle({ radius: 8, fill: new ol.style.Fill({ color }), stroke: new ol.style.Stroke({ color: '#fff', width: 2 }) }) })],
    area: new ol.style.Style({ fill: new ol.style.Fill({ color: `${color}45` }), stroke: new ol.style.Stroke({ color, width: 2 }) }),
    selectedArea: new ol.style.Style({ fill: new ol.style.Fill({ color: `${color}77` }), stroke: new ol.style.Stroke({ color: '#f6d34b', width: 5 }) }),
    line: new ol.style.Style({ stroke: new ol.style.Stroke({ color, width: 3 }) }),
    selectedLine: new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#f6d34b', width: 6 }) }),
  });
  const statusAppearances = Object.fromEntries(Object.entries(STATUS_COLORS).map(([level, color]) => [level, styles(color)]));

  for (const group of manifest.groups) {
    const source = new ol.source.Vector();
    const appearance = styles(group.color || '#4d6a59');
    const layer = new ol.layer.Vector({ source, style: (feature) => {
      if (!feature.get('searchVisible')) return null;
      const kind = feature.getGeometry()?.getType() || '';
      const selected = feature.getId() === selectedId;
      const active = statusAppearances[feature.get('statusLevel')] || appearance;
      if (kind.includes('Polygon')) return selected ? active.selectedArea : active.area;
      if (kind.includes('LineString')) return selected ? active.selectedLine : active.line;
      return selected ? active.selectedPoint : active.point;
    } });
    groupStates.push({ group, source, layer });
    for (const file of group.files || []) {
      try {
        const response = await fetch(file);
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
    const response = await fetch('/data/status/areas.json');
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
    const response = await fetch('/data/status/legislation.json');
    if (response.ok) {
      const payload = await response.json();
      const legislationById = new Map((payload.legislation || []).map((entry) => [entry.areaId, entry]));
      for (const record of records) {
        const entry = legislationById.get(record.id);
        if (entry) record.legislation = entry;
      }
    }
  } catch { /* legjislacioni është shtesë; harta funksionon edhe pa të */ }

  const map = new ol.Map({
    target: mapElement,
    layers: [baseLayer, labelsLayer, ...[...groupStates].sort((a, b) => ({ zona: 0, flora: 1, fauna: 2 }[a.group.id] ?? 1) - ({ zona: 0, flora: 1, fauna: 2 }[b.group.id] ?? 1)).map((state) => state.layer)],
    view: new ol.View({ center: ol.proj.fromLonLat([20.2, 41.2]), zoom: 7.2, minZoom: 5 }),
  });
  const previewElement = document.getElementById('point-preview');
  const hidePointPreview = () => {
    previewElement.hidden = true;
  };
  const markSelected = (record) => {
    selectedId = record.id;
    groupStates.forEach((state) => state.layer.changed());
    listElement.querySelectorAll('.place-card').forEach((card) => card.setAttribute('aria-pressed', String(card.dataset.id === selectedId)));
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
  for (const group of manifest.groups) {
    const option = make('label', 'filter-option');
    const checkbox = make('input');
    checkbox.type = 'checkbox';
    checkbox.value = group.id;
    checkbox.checked = true;
    option.append(checkbox, make('span', '', group.label), make('small', '', records.filter((record) => record.group.id === group.id).length));
    scopeOptions.append(option);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) activeGroups.add(group.id);
      else activeGroups.delete(group.id);
      updateFilters();
    });
    const entry = make('span');
    const dot = make('i', group.id === 'zona' ? 'key-dot key-area' : 'key-dot');
    dot.style.backgroundColor = group.color || '#4d6a59';
    entry.append(dot, document.createTextNode(group.label));
    legend.append(entry);
  }
  countryOptions.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => checkbox.addEventListener('change', () => {
    if (checkbox.checked) activeCountries.add(checkbox.value);
    else activeCountries.delete(checkbox.value);
    updateFilters();
  }));
  document.getElementById('with-photo').addEventListener('change', (event) => {
    photoOnly = event.target.checked;
    updateFilters();
  });
  const matches = (record) => activeGroups.has(record.group.id)
    && (activeCountries.size === 2 || (record.properties.countryCodes || []).some((country) => activeCountries.has(country)))
    && (!photoOnly || Boolean(record.properties.image))
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
      const card = make('button', `place-card ${observation ? 'observation-card' : 'atlas-area-card'}`);
      card.type = 'button';
      card.dataset.id = record.id;
      card.setAttribute('aria-pressed', String(record.id === selectedId));
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
      if (photo) card.append(photo);
      card.append(top, make('strong', 'card-title', place.name || 'Pa emër'));
      if (observation) card.append(make('span', 'card-location', place.location || 'Vendndodhje e panjohur'));
      else {
        card.append(make('span', 'card-summary', place.summary || ''));
        const counts = [place.extra?.['Vëzhgime flore'] && `${place.extra['Vëzhgime flore']} florë`, place.extra?.['Vëzhgime faune'] && `${place.extra['Vëzhgime faune']} faunë`].filter(Boolean);
        if (counts.length) card.append(make('span', 'area-observations', `Vëzhgime brenda kufirit · ${counts.join(' · ')}`));
      }
      card.append(bottom);
      card.addEventListener('click', () => selectRecord(record));
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
            query = '';
            search.value = '';
            document.getElementById('with-photo').checked = false;
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
    listElement.querySelectorAll('.place-card').forEach((card) => card.setAttribute('aria-pressed', 'false'));
  }
  const notesKey = 'heritage-map-notes-v1';
  const noteBanner = document.getElementById('note-banner');
  const notesEditor = document.getElementById('notes-editor');
  const noteForm = document.getElementById('note-form');
  const noteText = document.getElementById('note-text');
  const noteList = document.getElementById('note-list');
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
        element.setAttribute('aria-label', 'Afro hartën për të lexuar shënimin');
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
  const createNoteOverlay = (id, text, color) => {
    const element = make('div', 'sticky-note');
    element.style.setProperty('--note-color', color);
    element.style.setProperty('--note-rotate', `${noteRotation(id)}deg`);
    const deleteButton = make('button', 'sticky-note-delete', '×');
    deleteButton.type = 'button';
    deleteButton.setAttribute('aria-label', 'Fshi shënimin');
    deleteButton.addEventListener('click', () => deleteNote(id));
    element.append(make('p', 'sticky-note-text', text), deleteButton);
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
    for (const [id, note] of noteState) {
      const item = make('div', 'note-item');
      const dot = make('span', 'note-item-dot');
      dot.style.background = note.color;
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
    if (!noteState.size) noteList.append(make('p', 'no-results', 'Ende pa shënime.'));
  };
  const saveNotes = () => {
    const collection = {
      type: 'FeatureCollection',
      features: [...noteState.entries()].map(([id, note]) => ({ type: 'Feature', id, geometry: { type: 'Point', coordinates: note.coordinate }, properties: { text: note.text, color: note.color } })),
    };
    try { localStorage.setItem(notesKey, JSON.stringify(collection)); }
    catch { showNotice('Shënimet nuk mund të ruhen në këtë shfletues.'); }
  };
  const addNote = (id, text, color, coordinate) => {
    const overlay = createNoteOverlay(id, text, color);
    overlay.setPosition(ol.proj.fromLonLat(coordinate));
    map.addOverlay(overlay);
    noteState.set(id, { text, color, coordinate, overlay });
    updateNoteVisibility();
  };
  const deleteNote = (id) => {
    const note = noteState.get(id);
    if (!note) return;
    map.removeOverlay(note.overlay);
    noteState.delete(id);
    renderNoteList();
    saveNotes();
  };
  const loadNotes = () => {
    let collection;
    try { collection = JSON.parse(localStorage.getItem(notesKey) || '{"type":"FeatureCollection","features":[]}'); }
    catch { collection = { type: 'FeatureCollection', features: [] }; }
    for (const feature of collection.features || []) {
      if (feature?.geometry?.type !== 'Point' || !Array.isArray(feature.geometry.coordinates)) continue;
      const id = String(feature.id ?? newLocalId());
      if (noteState.has(id)) continue;
      addNote(id, String(feature.properties?.text || ''), feature.properties?.color || '#fdf279', feature.geometry.coordinates);
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
    const color = noteForm.querySelector('input[name="color"]:checked')?.value || '#fdf279';
    addNote(newLocalId(), text, color, pendingCoordinate);
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
        addNote(id, String(feature.properties?.text || ''), feature.properties?.color || '#fdf279', feature.geometry.coordinates);
        imported += 1;
      }
      renderNoteList();
      saveNotes();
      showNotice(`${imported} shënime u importuan.`);
    } catch { showNotice('Skedari nuk u importua. Kontrollo që është një GeoJSON FeatureCollection i vlefshëm me pika.'); }
    event.target.value = '';
  });
  document.getElementById('export-notes').addEventListener('click', () => {
    const collection = {
      type: 'FeatureCollection',
      features: [...noteState.entries()].map(([id, note]) => ({ type: 'Feature', id, geometry: { type: 'Point', coordinates: note.coordinate }, properties: { text: note.text, color: note.color } })),
    };
    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const anchor = make('a');
    anchor.href = url;
    anchor.download = 'notes.geojson';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  search.addEventListener('input', () => { query = search.value.trim().toLocaleLowerCase('sq'); renderCards(); });
  document.getElementById('fit-map').addEventListener('click', focusVisible);
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
  loadNotes();
  updateFilters();
  focusVisible();
})();
