(async () => {
  const notice = document.getElementById('dashboard-notice');
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

  const STATUS_LABELS = { good: 'E mirë', watch: 'Në vëzhgim', critical: 'Kritike', unassessed: 'Pa vlerësim' };
  const STATUS_COLORS = { good: '#0ca30c', watch: '#fab219', critical: '#d03b3b', unassessed: '#898781' };
  const STATUS_ORDER = ['good', 'watch', 'critical', 'unassessed'];
  const INDICATOR_LABELS = {
    threatLevel: { key: 'Niveli i kërcënimit', low: 'I ulët', medium: 'Mesatar', high: 'I lartë' },
    habitatTrend: { key: 'Tendenca e habitatit', improving: 'Përmirësohet', stable: 'Stabël', declining: 'Përkeqësohet' },
    enforcementLevel: { key: 'Zbatimi i mbrojtjes', good: 'I mirë', partial: 'Pjesshëm', weak: 'I dobët' },
  };
  const PRIORITY_LABELS = { high: 'E lartë', medium: 'Mesatare', low: 'E ulët' };
  const PRIORITY_COLORS = { high: '#d03b3b', medium: '#fab219', low: '#898781' };
  const INTERVENTION_STATUS_LABELS = { planned: 'Planifikuar', ongoing: 'Në vazhdim', done: 'Përfunduar' };
  const INTERVENTION_STATUS_COLORS = { planned: '#898781', ongoing: '#256abf', done: '#0ca30c' };
  const INTERVENTION_STATUS_ORDER = ['ongoing', 'planned', 'done'];
  const RESPONSIBILITY_LABELS = { central: 'Përgjegjësi qendrore', local: 'Përgjegjësi vendore', shared: 'Përgjegjësi e përbashkët' };
  const MANAGEMENT_PLAN_LABELS = { yes: 'Ka plan menaxhimi', in_progress: 'Plan menaxhimi në hartim', none: 'Pa plan menaxhimi' };
  const MANAGEMENT_PLAN_COLORS = { yes: '#0ca30c', in_progress: '#fab219', none: '#898781' };

  const chip = (label, color) => {
    const element = make('span', 'badge-chip', label);
    element.style.backgroundColor = color;
    return element;
  };

  const [areasResult, interventionsResult, organizationsResult, legislationResult] = await Promise.allSettled([
    fetch('/data/status/areas.json').then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }),
    fetch('/data/status/interventions.json').then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }),
    fetch('/data/status/organizations.json').then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }),
    fetch('/data/status/legislation.json').then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }),
  ]);

  const areas = areasResult.status === 'fulfilled' ? (areasResult.value.areas || []) : [];
  const interventions = interventionsResult.status === 'fulfilled' ? (interventionsResult.value.interventions || []) : [];
  const organizations = organizationsResult.status === 'fulfilled' ? (organizationsResult.value.organizations || []) : [];
  const legislation = legislationResult.status === 'fulfilled' ? (legislationResult.value.legislation || []) : [];
  const areaNameById = new Map(areas.map((area) => [area.areaId, area.areaName]));

  if ([areasResult, interventionsResult, organizationsResult, legislationResult].every((result) => result.status !== 'fulfilled')) {
    showNotice('Të dhënat e statusit nuk u ngarkuan. Provo ta rifreskosh faqen.');
  }

  const statTile = (label, value) => {
    const tile = make('div', 'stat-tile');
    tile.append(make('span', 'stat-tile-label', label), make('span', 'stat-tile-value', value));
    return tile;
  };
  const statTiles = document.getElementById('stat-tiles');
  for (const key of STATUS_ORDER) statTiles.append(statTile(STATUS_LABELS[key], areas.filter((area) => area.status === key).length));
  statTiles.append(statTile('Ndërhyrje gjithsej', interventions.length));
  statTiles.append(statTile('Organizata', organizations.length));
  statTiles.append(statTile('Zona me kuadër ligjor', legislation.length));

  let activeStatus = 'all';
  const statusFilters = document.getElementById('status-filters');
  const allStatusButton = make('button', '', 'Të gjitha');
  allStatusButton.type = 'button';
  allStatusButton.dataset.status = 'all';
  allStatusButton.setAttribute('aria-pressed', 'true');
  statusFilters.append(allStatusButton);
  for (const key of STATUS_ORDER) {
    const button = make('button', '', STATUS_LABELS[key]);
    button.type = 'button';
    button.dataset.status = key;
    button.setAttribute('aria-pressed', 'false');
    statusFilters.append(button);
  }
  statusFilters.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-status]');
    if (!button) return;
    activeStatus = button.dataset.status;
    statusFilters.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item.dataset.status === activeStatus)));
    renderAreas();
  });

  const areaGrid = document.getElementById('area-grid');
  const renderAreas = () => {
    const shown = areas.filter((area) => activeStatus === 'all' || area.status === activeStatus);
    document.getElementById('areas-count').textContent = String(shown.length);
    areaGrid.replaceChildren();
    if (!shown.length) { areaGrid.append(make('p', 'empty-note', areas.length ? 'Asnjë zonë nuk përputhet me filtrin.' : 'Nuk ka ende të dhëna statusi. Sinkronizo Google Sheet-in me scripts/sync_status.py.')); return; }
    for (const area of shown) {
      const card = make('a', 'area-card');
      card.href = `/#${encodeURIComponent(area.areaId)}`;
      const top = make('div', 'area-card-top');
      const dot = make('span', 'health-dot');
      dot.style.backgroundColor = STATUS_COLORS[area.status] || STATUS_COLORS.unassessed;
      top.append(dot, make('span', '', STATUS_LABELS[area.status] || area.status));
      card.append(top, make('h3', '', area.areaName || area.areaId));
      if (area.lastAssessed || area.assessedBy) {
        card.append(make('p', '', [area.assessedBy, area.lastAssessed].filter(Boolean).join(' · ')));
      }
      if (area.notes) card.append(make('p', '', area.notes));
      const tags = make('div', 'area-card-tags');
      for (const [key, labels] of Object.entries(INDICATOR_LABELS)) {
        const value = area.indicators?.[key];
        if (value) tags.append(make('span', '', `${labels.key}: ${labels[value] || value}`));
      }
      if (tags.childElementCount) card.append(tags);
      areaGrid.append(card);
    }
  };
  renderAreas();

  let activeInterventionStatus = 'all';
  const interventionFilters = document.getElementById('intervention-filters');
  const allInterventionButton = make('button', '', 'Të gjitha');
  allInterventionButton.type = 'button';
  allInterventionButton.dataset.status = 'all';
  allInterventionButton.setAttribute('aria-pressed', 'true');
  interventionFilters.append(allInterventionButton);
  for (const key of INTERVENTION_STATUS_ORDER) {
    const button = make('button', '', INTERVENTION_STATUS_LABELS[key]);
    button.type = 'button';
    button.dataset.status = key;
    button.setAttribute('aria-pressed', 'false');
    interventionFilters.append(button);
  }
  interventionFilters.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-status]');
    if (!button) return;
    activeInterventionStatus = button.dataset.status;
    interventionFilters.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item.dataset.status === activeInterventionStatus)));
    renderInterventions();
  });

  const interventionList = document.getElementById('intervention-list');
  const renderInterventions = () => {
    const shown = interventions.filter((item) => activeInterventionStatus === 'all' || item.status === activeInterventionStatus);
    document.getElementById('interventions-count').textContent = String(shown.length);
    interventionList.replaceChildren();
    if (!shown.length) { interventionList.append(make('p', 'empty-note', interventions.length ? 'Asnjë ndërhyrje nuk përputhet me filtrin.' : 'Nuk ka ende ndërhyrje të regjistruara.')); return; }
    for (const item of shown) {
      const row = make('div', 'intervention-row');
      const top = make('div', 'intervention-row-top');
      top.append(make('h3', '', item.title));
      top.append(chip(PRIORITY_LABELS[item.priority] || item.priority, PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium));
      row.append(top);
      const areaLink = make('a', 'record-link', areaNameById.get(item.areaId) || item.areaId);
      areaLink.href = `/#${encodeURIComponent(item.areaId)}`;
      row.append(areaLink);
      if (item.description) row.append(make('p', '', item.description));
      const meta = make('div', 'intervention-meta');
      meta.append(chip(INTERVENTION_STATUS_LABELS[item.status] || item.status, INTERVENTION_STATUS_COLORS[item.status] || INTERVENTION_STATUS_COLORS.planned));
      if (item.organization) meta.append(make('span', '', item.organization));
      if (item.startDate) meta.append(make('span', '', item.endDate ? `${item.startDate} → ${item.endDate}` : `Nga ${item.startDate}`));
      row.append(meta);
      const link = item.link && safeLink('Më shumë ↗', item.link);
      if (link) row.append(link);
      interventionList.append(row);
    }
  };
  renderInterventions();

  const legislationList = document.getElementById('legislation-list');
  document.getElementById('legislation-count').textContent = String(legislation.length);
  if (!legislation.length) {
    legislationList.append(make('p', 'empty-note', 'Nuk ka ende të dhëna për kuadrin ligjor.'));
  } else {
    for (const entry of legislation) {
      const row = make('div', 'legislation-row');
      row.append(make('h3', '', areaNameById.get(entry.areaId) || entry.areaId));
      if (entry.protectionCategory) row.append(make('p', '', entry.protectionCategory));
      if (entry.legalBasis) row.append(make('p', '', entry.legalBasis));
      if (entry.responsibilityLevel) row.append(chip(RESPONSIBILITY_LABELS[entry.responsibilityLevel] || entry.responsibilityLevel, '#256abf'));
      if (entry.governmentPriority) row.append(chip(`Përparësi ${(PRIORITY_LABELS[entry.governmentPriority] || entry.governmentPriority).toLowerCase()}`, PRIORITY_COLORS[entry.governmentPriority] || PRIORITY_COLORS.medium));
      if (entry.managementPlan) row.append(chip(MANAGEMENT_PLAN_LABELS[entry.managementPlan] || entry.managementPlan, MANAGEMENT_PLAN_COLORS[entry.managementPlan] || MANAGEMENT_PLAN_COLORS.none));
      if (entry.notes) row.append(make('p', '', entry.notes));
      const link = entry.link && safeLink('Teksti ligjor ↗', entry.link);
      if (link) row.append(link);
      legislationList.append(row);
    }
  }

  const organizationList = document.getElementById('organization-list');
  document.getElementById('organizations-count').textContent = String(organizations.length);
  if (!organizations.length) {
    organizationList.append(make('p', 'empty-note', 'Nuk ka ende organizata të regjistruara.'));
  } else {
    for (const organization of organizations) {
      const row = make('div', 'organization-row');
      row.append(make('h3', '', organization.name));
      if (organization.focus) row.append(make('p', '', organization.focus));
      if (organization.contact) row.append(make('p', '', organization.contact));
      const link = organization.website && safeLink('Faqja ↗', organization.website);
      if (link) row.append(link);
      organizationList.append(row);
    }
  }
})();
