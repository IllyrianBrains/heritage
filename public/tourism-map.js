(() => {
  const places = [
    { id: 'theth', name: 'Theth', region: 'Alpet Shqiptare', country: 'Shqipëri', category: 'nature', icon: '↟', coords: [19.774, 42.395], time: '2–3 ditë', season: 'Maj – tetor', level: 'Mesatar', score: 92, summary: 'Shtigje alpine, bujtina familjare dhe një ritëm që të fton të qëndrosh më gjatë.', tips: ['Fli në një bujtinë të drejtuar nga familje vendase.', 'Ec në shtigje të shënuara dhe mbush shishen e ujit.', 'Ndaje transportin nga Shkodra me udhëtarë të tjerë.'] },
    { id: 'valbona', name: 'Lugina e Valbonës', region: 'Kukës', country: 'Shqipëri', category: 'nature', icon: '△', coords: [20.073, 42.453], time: '2–4 ditë', season: 'Maj – tetor', level: 'Mesatar', score: 94, summary: 'Peizazh malor për ecje të ngadaltë, prodhime të zonës dhe mikpritje në fshat.', tips: ['Zgjidh një guidë lokale për shtigjet e gjata.', 'Bli ushqime të stinës nga prodhuesit e zonës.', 'Mos lër gjurmë jashtë shtigjeve.'] },
    { id: 'prespa', name: 'Prespa', region: 'Korçë', country: 'Shqipëri', category: 'nature', icon: '≈', coords: [20.934, 40.785], time: '2 ditë', season: 'Prill – tetor', level: 'I lehtë', score: 90, summary: 'Liqen, vëzhgim shpendësh dhe fshatra ku koha ecën pak më ngadalë.', tips: ['Vëzhgo shpendët në heshtje dhe nga distanca.', 'Provo gatimet e zonës në një shtëpi pritëse.', 'Përdor biçikletën për distancat e shkurtra.'] },
    { id: 'berat', name: 'Berat', region: 'Berat', country: 'Shqipëri', category: 'culture', icon: '⌂', coords: [19.949, 40.705], time: '1–2 ditë', season: 'Gjithë vitin', level: 'I lehtë', score: 86, summary: 'Lagje historike, punishte artizanale dhe tregime që zbulohen më mirë në këmbë.', tips: ['Eksploro lagjet në këmbë.', 'Zgjidh produkte të bëra nga artizanë vendas.', 'Qëndro në një shtëpi tradicionale të restauruar.'] },
    { id: 'permet', name: 'Përmet', region: 'Gjirokastër', country: 'Shqipëri', category: 'food', icon: '✿', coords: [20.352, 40.234], time: '2 ditë', season: 'Prill – nëntor', level: 'I lehtë', score: 91, summary: 'Shije shtëpie, prodhues të vegjël dhe natyrë përgjatë luginës së Vjosës.', tips: ['Kërko produkte me përbërës vendas.', 'Vizito një punishte të vogël ushqimore.', 'Shijo zonën pa nxituar nga një pikë në tjetrën.'] },
    { id: 'prizren', name: 'Prizren', region: 'Prizren', country: 'Kosovë', category: 'culture', icon: '◇', coords: [20.739, 42.213], time: '1–2 ditë', season: 'Gjithë vitin', level: 'I lehtë', score: 84, summary: 'Trashëgimi urbane, zejtarë dhe gastronomi lokale në një qendër që përshkohet lehtë më këmbë.', tips: ['Ec në qendrën historike.', 'Mbështet zejtarët dhe dyqanet e pavarura.', 'Përdor transportin publik për mbërritjen.'] },
    { id: 'rugova', name: 'Gryka e Rugovës', region: 'Pejë', country: 'Kosovë', category: 'nature', icon: '⌁', coords: [20.117, 42.667], time: '2–3 ditë', season: 'Maj – tetor', level: 'Mesatar', score: 93, summary: 'Kanione, shtigje dhe bujtina malore pranë Pejës për një arratisje pa ngut.', tips: ['Merr një guidë nga komuniteti për ecjet alpine.', 'Kthehu me të gjitha mbetjet që merr me vete.', 'Qëndro më shumë se një natë në zonë.'] },
    { id: 'rahovec', name: 'Rahovec', region: 'Gjakovë', country: 'Kosovë', category: 'food', icon: '●', coords: [20.654, 42.399], time: '1–2 ditë', season: 'Shtator – tetor', level: 'I lehtë', score: 88, summary: 'Vreshta, tryeza lokale dhe histori familjare që lidhin peizazhin me shijen.', tips: ['Rezervo një vizitë te një prodhues i vogël.', 'Zgjidh degustime me prodhime të zonës.', 'Planifiko një shofer ose transport të përbashkët.'] },
  ];

  const category = {
    nature: { label: 'Natyrë', color: '#226c56' },
    culture: { label: 'Kulturë', color: '#c46d47' },
    food: { label: 'Ushqim lokal', color: '#d29b32' },
  };
  const list = document.getElementById('tourism-list');
  const count = document.getElementById('tourism-count');
  const detail = document.getElementById('tourism-detail');
  const query = document.getElementById('tourism-query');
  let activeFilter = 'all';
  let selected = null;

  if (!window.ol) {
    document.getElementById('tourism-map').textContent = 'Harta nuk mundi të ngarkohej.';
    return;
  }

  const features = places.map((place) => {
    const feature = new ol.Feature({ geometry: new ol.geom.Point(ol.proj.fromLonLat(place.coords)), placeId: place.id });
    feature.setId(place.id);
    return feature;
  });
  const vectorSource = new ol.source.Vector({ features });
  const vectorLayer = new ol.layer.Vector({
    source: vectorSource,
    style: (feature) => {
      const place = places.find((item) => item.id === feature.getId());
      const isSelected = selected === place.id;
      return new ol.style.Style({
        image: new ol.style.Circle({ radius: isSelected ? 19 : 15, fill: new ol.style.Fill({ color: category[place.category].color }), stroke: new ol.style.Stroke({ color: '#fff', width: isSelected ? 5 : 3 }) }),
        text: new ol.style.Text({ text: place.icon, fill: new ol.style.Fill({ color: '#fff' }), font: '700 15px DM Sans', offsetY: 0 }),
      });
    },
  });
  const map = new ol.Map({
    target: 'tourism-map',
    layers: [new ol.layer.Tile({ source: new ol.source.OSM() }), vectorLayer],
    view: new ol.View({ center: ol.proj.fromLonLat([20.25, 41.55]), zoom: 7.25, minZoom: 6 }),
    controls: ol.control.defaults.defaults({ rotate: false }).extend([new ol.control.ScaleLine({ units: 'metric' })]),
  });

  const filteredPlaces = () => {
    const needle = query.value.trim().toLocaleLowerCase('sq');
    return places.filter((place) => (activeFilter === 'all' || place.category === activeFilter) && (!needle || `${place.name} ${place.region} ${place.country} ${place.summary}`.toLocaleLowerCase('sq').includes(needle)));
  };

  const openPlace = (id, move = true) => {
    const place = places.find((item) => item.id === id);
    if (!place) return;
    selected = id;
    vectorLayer.changed();
    document.querySelectorAll('.tourism-card').forEach((card) => card.classList.toggle('selected', card.dataset.id === id));
    detail.innerHTML = `<button class="tourism-detail-close" type="button" aria-label="Mbyll">×</button><div class="tourism-detail-top"><span class="tourism-detail-icon ${place.category}">${place.icon}</span><p>${category[place.category].label} · ${place.country}</p><h2>${place.name}</h2><span>${place.region}</span></div><p class="tourism-detail-summary">${place.summary}</p><div class="tourism-facts"><span><small>Kohë e sugjeruar</small><strong>${place.time}</strong></span><span><small>Koha më e mirë</small><strong>${place.season}</strong></span><span><small>Ritmi</small><strong>${place.level}</strong></span></div><section><p class="eyebrow">Udhëto me ndikim pozitiv</p><ul>${place.tips.map((tip) => `<li><span>✓</span>${tip}</li>`).join('')}</ul></section><div class="tourism-score"><div><small>Profili i qëndrueshmërisë</small><strong>${place.score}<sup>/100</sup></strong></div><span aria-label="${place.score} nga 100"><i style="width:${place.score}%"></i></span><p>Vlerësim orientues bazuar në lëvizjen pa makinë, qëndrimin lokal dhe përvojat me ndikim të ulët.</p></div>`;
    detail.hidden = false;
    detail.querySelector('.tourism-detail-close').addEventListener('click', closeDetail);
    if (move) map.getView().animate({ center: ol.proj.fromLonLat(place.coords), zoom: 10, duration: 650 });
  };
  const closeDetail = () => { detail.hidden = true; selected = null; vectorLayer.changed(); document.querySelectorAll('.tourism-card').forEach((card) => card.classList.remove('selected')); };

  const render = () => {
    const visible = filteredPlaces();
    count.textContent = `${visible.length} ${visible.length === 1 ? 'vend' : 'vende'}`;
    list.innerHTML = visible.length ? visible.map((place) => `<button class="tourism-card${selected === place.id ? ' selected' : ''}" data-id="${place.id}" type="button"><span class="tourism-card-icon ${place.category}">${place.icon}</span><span class="tourism-card-copy"><small>${category[place.category].label} · ${place.country}</small><strong>${place.name}</strong><em>${place.region}</em></span><span class="tourism-card-score"><b>${place.score}</b><small>pikë</small></span></button>`).join('') : '<p class="tourism-empty">Nuk u gjet asnjë vend. Provo një kërkim tjetër.</p>';
    list.querySelectorAll('.tourism-card').forEach((card) => card.addEventListener('click', () => openPlace(card.dataset.id)));
    features.forEach((feature) => feature.setStyle(visible.some((place) => place.id === feature.getId()) ? undefined : new ol.style.Style({})));
  };

  document.querySelectorAll('.tourism-filters button').forEach((button) => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('.tourism-filters button').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    render();
  }));
  query.addEventListener('input', render);
  map.on('singleclick', (event) => {
    const feature = map.forEachFeatureAtPixel(event.pixel, (item) => item);
    if (feature) openPlace(feature.getId(), false);
  });
  map.on('pointermove', (event) => { map.getTargetElement().style.cursor = map.hasFeatureAtPixel(event.pixel) ? 'pointer' : ''; });
  document.getElementById('tourism-sidebar-toggle').addEventListener('click', (event) => {
    const workspace = document.querySelector('.tourism-workspace');
    const collapsed = workspace.classList.toggle('sidebar-collapsed');
    event.currentTarget.setAttribute('aria-expanded', String(!collapsed));
    event.currentTarget.lastElementChild.textContent = collapsed ? 'Shfaq listën' : 'Fshih listën';
    event.currentTarget.firstElementChild.textContent = collapsed ? '→' : '←';
    setTimeout(() => map.updateSize(), 260);
  });
  render();
})();
