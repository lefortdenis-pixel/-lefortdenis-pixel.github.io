(()=>{
  'use strict';
  const get = id => document.getElementById(id);
  const key = 'traversee-services-favorites-v1';
  const list = get('servicesList');
  const search = get('servicesSearch');
  const type = get('servicesType');
  let points = [], favorites = new Set(), favoritesOnly = false, limit = 60, request;
  try { favorites = new Set(JSON.parse(localStorage.getItem(key) || '[]').map(Number)); } catch {}
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function node(tag, value) {
    const el = document.createElement(tag);
    el.textContent = value;
    return el;
  }
  function link(text, url) {
    const el = node('a', text);
    el.href = url;
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
    return el;
  }
  function card(point) {
    const el = node('article', '');
    const star = node('button', '');
    star.type = 'button';
    const refresh = () => {
      const selected = favorites.has(point.id);
      star.textContent = selected ? '★' : '☆';
      star.setAttribute('aria-label', (selected ? 'Retirer des favoris : ' : 'Ajouter aux favoris : ') + point.name);
      star.setAttribute('aria-pressed', String(selected));
    };
    refresh();
    star.onclick = () => {
      if (favorites.has(point.id)) favorites.delete(point.id);
      else favorites.add(point.id);
      try { localStorage.setItem(key, JSON.stringify([...favorites])); } catch {}
      if (favoritesOnly) render();
      else refresh();
    };
    el.append(star, node('h3', point.name), node('p', point.place));
    if (point.hours && point.hours !== 'Non renseigné' && point.hours !== 'Horaire non confirmé') el.append(node('p', point.hours));
    if (point.detail) el.append(node('p', point.detail));
    if (/^https?:\/\//i.test(point.url)) el.append(link('Source', point.url));
    if (Number.isFinite(point.lat) && Number.isFinite(point.lon)) el.append(link('Carte', 'https://www.google.com/maps/search/?api=1&query=' + point.lat + ',' + point.lon));
    return el;
  }
  function render() {
    const term = normalize(search.value.trim());
    const matches = points.filter(p => (!type.value || p.type === type.value) &&
      (!favoritesOnly || favorites.has(p.id)) && normalize(p.name + ' ' + p.place).includes(term));
    get('servicesCount').textContent = matches.length ? matches.length + ' service' + (matches.length > 1 ? 's' : '') : 'Aucun résultat';
    list.replaceChildren();
    let group;
    for (const point of matches.slice(0, limit)) {
      if (group !== point.type) {
        group = point.type;
        list.append(node('h2', group));
      }
      list.append(card(point));
    }
    get('servicesMore').hidden = matches.length <= limit;
  }
  function resetList() { limit = 60; render(); }
  async function load() {
    if (points.length || request) return;
    get('servicesCount').textContent = 'Chargement…';
    request = fetch('./services-data.json');
    try {
      const response = await request;
      if (!response.ok) throw new Error('Chargement impossible');
      points = await response.json();
      const order = ['Distributeurs de repas','Casiers et produits fermiers','Supérettes autonomes','Laveries','Autres distributeurs','Alimentation','Boulangeries','Matériel et chaussures','Hygiène et soins','Autres services'];
      points.sort((a,b) => order.indexOf(a.type) - order.indexOf(b.type));
      for (const category of new Set(points.map(p => p.type))) type.add(new Option(category, category));
      render();
    } catch {
      get('servicesCount').textContent = 'Services indisponibles. Rouvre l’onglet pour réessayer.';
    } finally { request = null; }
  }
  get('openServicesBtn').onclick = () => { openAppView('services'); load(); };
  get('servicesBack').onclick = () => openAppView('home');
  search.oninput = resetList;
  type.onchange = resetList;
  get('servicesFav').onclick = event => {
    favoritesOnly = !favoritesOnly;
    event.currentTarget.setAttribute('aria-pressed', String(favoritesOnly));
    resetList();
  };
  get('servicesMore').onclick = () => { limit += 60; render(); };
})();