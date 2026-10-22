// country-engine.js — Country query engine for Xenon.
//
// Handles:
//   • Country attributes      (capital, population, GDP, HDI, history…)
//   • Country comparisons     (USA vs China, India vs Pakistan)
//   • Superlatives            (largest by population/area/GDP/HDI)
//   • Rivers                  (world + within-country, with length ranking)
//   • Mountains               (world + within-country, tallest, specific)
//   • Cliffs                  (tallest, famous, by country, specific)
//   • Seas                    (largest, deepest, by country, specific)
//   • Cross-country geography (which sea lies between X and Y)
//
// Registered as the /country tool via xenon.js's routeToTool.

(function (root) {
'use strict';

const C = root.XENON_COUNTRIES || [];
const RIVERS = root.XENON_WORLD_RIVERS || [];
const MOUNTAINS = root.XENON_WORLD_MOUNTAINS || [];
const CLIFFS = root.XENON_WORLD_CLIFFS || [];
const SEAS = root.XENON_WORLD_SEAS || [];
const W = root;

// ─── Utilities ────────────────────────────────────────────

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function fmtBig(n) {
  if (n == null) return 'unknown';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + ' trillion';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(2) + ' billion';
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(2) + ' million';
  return '$' + n.toLocaleString();
}
function title(s) { return '<div class="xetex-equation">' + esc(s) + '</div>'; }
function body(s)  { return '<div class="para-body"><p class="para-line">' + s + '</p></div>'; }
function head(s)  { return '<div class="para-keypoints-heading">' + esc(s) + '</div>'; }
function close(s) { return '<div class="para-closing">' + esc(s) + '</div>'; }
function lst(items) {
  return '<ul class="para-keypoints">' + items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>';
}
function wrap(inner) {
  return { __html: true, text: '<div class="xetex-output para-output">' + inner + '</div>' };
}
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// ─── Country finders ──────────────────────────────────────

function findAllCountries(text) {
  const found = [];
  for (const c of C) if (c.aliases.test(text) && !found.includes(c)) found.push(c);
  if (/\bkorea\b/i.test(text) && !/\b(north|south)\s+korea\b/i.test(text)) {
    const sk = C.find(c => c.id === 'south-korea');
    const nk = C.find(c => c.id === 'north-korea');
    if (sk && !found.includes(sk)) found.push(sk);
    if (nk && !found.includes(nk)) found.push(nk);
  }
  return found;
}

// Reverse lookup: find country NAMES in the query, even ones not in
// the country DB. Used by mountain/cliff/sea handlers so "mountains in
// Nepal" works though Nepal isn't a full country page yet.
function findGeoCountryNames(text) {
  const known = findAllCountries(text).map(c => c.name);
  if (known.length) return known;
  const names = new Set();
  MOUNTAINS.forEach(m => m.countries.forEach(c => names.add(c)));
  CLIFFS.forEach(c => names.add(c.country));
  SEAS.forEach(s => s.countries.forEach(c => names.add(c)));
  C.forEach(c => names.add(c.name));
  const hits = [];
  names.forEach(n => {
    if (new RegExp('\\b' + escRe(n) + '\\b', 'i').test(text)) hits.push(n);
  });
  return hits;
}

// ─── Attributes ───────────────────────────────────────────

const ATTRS = [
  { key: 'capital',           re: /\bcapital\b/i,           label: 'Capital',           fmt: c => c.capital, short: true },
  { key: 'populationDensity', re: /\bpopulation\s+density\b|\bdensity\s+of\s+population\b/i, label: 'Population density', fmt: c => c.populationDensity != null ? c.populationDensity.toLocaleString() + ' people/km²' : 'unknown', short: true },
  { key: 'population',        re: /\bpopulation\b(?!\s+density)|\bhow\s+many\s+people\s+live\b/i, label: 'Population', fmt: c => c.population.toLocaleString(), short: true },
  { key: 'area',              re: /\b(area|size|land\s+area)\b/i, label: 'Area', fmt: c => c.area.toLocaleString() + ' km²', short: true },
  { key: 'gdpPerCapita',      re: /\bgdp\s*(?:per\s+capita|per\s+person)\b|\bincome\s+per\s+(?:capita|person)\b/i, label: 'GDP per capita', fmt: c => c.gdpPerCapita ? '$' + c.gdpPerCapita.toLocaleString() : 'unknown', short: true },
  { key: 'gdpGrowth',         re: /\bgdp\s+growth\b|\beconomic\s+growth\b/i, label: 'GDP growth', fmt: c => c.gdpGrowth != null ? c.gdpGrowth + '%' : 'unknown', short: true },
  { key: 'gdp',               re: /\bgdp\b(?!\s*(?:per|growth))/i, label: 'GDP', fmt: c => c.gdp ? fmtBig(c.gdp) : 'unknown', short: true },
  { key: 'gnp',               re: /\bgnp\b/i, label: 'GNP', fmt: c => c.gnp ? fmtBig(c.gnp) : 'unknown', short: true },
  { key: 'hdi',               re: /\bhdi\b|\bhuman\s+development\s+index\b/i, label: 'HDI', fmt: c => c.hdi != null ? c.hdi.toFixed(3) : 'unknown', short: true },
  { key: 'currency',          re: /\bcurrency\b/i, label: 'Currency', fmt: c => c.currency || 'unknown', short: true },
  { key: 'languages',         re: /\blanguages?\b/i, label: 'Languages', fmt: c => c.languages.join(', '), list: true },
  { key: 'independence',      re: /\bindependence\b|\bwhen.*independ/i, label: 'Independence', fmt: c => c.independence ? `From ${c.independence.from} on ${c.independence.date}` : 'Not applicable (no independence event)', short: true },
  { key: 'victoryDay',        re: /\b(victory|liberation)\s+day\b/i, label: 'Victory Day', fmt: c => c.victoryDay ? `${c.victoryDay.name} — ${c.victoryDay.date}` : 'Not a national holiday', short: true },
  { key: 'mourningDay',       re: /\b(mourning|memorial)\s+day\b/i, label: 'Mourning Day', fmt: c => c.mourningDay ? `${c.mourningDay.name} — ${c.mourningDay.date}` : 'Not a national holiday', short: true },
  { key: 'nationalDay',       re: /\bnational\s+day\b/i, label: 'National Day', fmt: c => c.nationalDay ? `${c.nationalDay.name} — ${c.nationalDay.date}` : 'unknown', short: true },
  { key: 'history',           re: /\bhistory\b/i, label: 'History', fmt: c => c.history, long: true },
  { key: 'culture',           re: /\bculture\b/i, label: 'Culture', fmt: c => c.culture, long: true },
  { key: 'events',            re: /\bevents?\b|\bfestivals?\b|\bholidays?\b|\bcelebrations?\b/i, label: 'Major events', fmt: c => c.events, list: true },
  { key: 'rivers',            re: /\brivers?\b/i, label: 'Rivers', fmt: c => c.rivers, list: true },
  { key: 'neighbors',         re: /\bneighbou?rs?\b|\bborders?\b/i, label: 'Neighbours', fmt: c => c.neighbors.map(id => { const n = C.find(x => x.id === id); return n ? n.name : id; }), list: true },
];

// ─── Detection ────────────────────────────────────────────

function isCountryQuery(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 300) return false;

  const countries = findAllCountries(t);
  const geoCountries = findGeoCountryNames(t);
  const hasWorld = /\b(world|worldwide|global|on\s+earth|globally)\b/i.test(t);
  const hasCountryWord = /\bcountr(?:y|ies)\b/i.test(t);
  const mentionsGeo = /\bmountains?\b|\bpeaks?\b|\bcliffs?\b|\bseas?\b|\boceans?\b|\brivers?\b/i.test(t);
  const geoQuestionVerb = /\b(tallest|highest|largest|deepest|biggest|shortest|smallest|famous|world|in|of|around|between|how|what|which|list|tell)\b/i.test(t);

  if (!countries.length && !hasWorld && !hasCountryWord && !(mentionsGeo && (geoCountries.length || geoQuestionVerb))) return false;

  // Geo domains — check first, they need precise routing.
  if (mentionsGeo && (geoCountries.length || hasWorld || geoQuestionVerb)) return true;

  // Superlative
  if (/\b(largest|biggest|smallest|most\s+populous|least\s+populous|longest|shortest|highest|lowest|richest|poorest)\b/i.test(t)) return true;

  // Comparison
  if (countries.length >= 2) return true;

  // Attribute
  for (const a of ATTRS) if (a.re.test(t)) return true;

  // Overview
  if (countries.length && /\b(tell\s+me\s+about|about|facts?\s+(?:about|on)|info(?:rmation)?\s+(?:about|on)|describe|overview|profile)\b/i.test(t)) return true;
  if (countries.length && /\bwhat\s+(?:do\s+you\s+know|can\s+you\s+tell)\b/i.test(t)) return true;

  return false;
}

// ─── Specific-entity finders ──────────────────────────────

function findMountainInText(t) {
  for (const m of MOUNTAINS) {
    if (new RegExp('\\b' + escRe(m.name) + '\\b', 'i').test(t)) return m;
  }
  return null;
}
function findCliffInText(t) {
  for (const cl of CLIFFS) {
    if (new RegExp('\\b' + escRe(cl.name) + '\\b', 'i').test(t)) return cl;
  }
  return null;
}
function findSeaInText(t) {
  for (const s of SEAS) {
    if (new RegExp('\\b' + escRe(s.name) + '\\b', 'i').test(t)) return s;
  }
  return null;
}

// ─── MOUNTAINS ────────────────────────────────────────────

function formatMountain(m) {
  const where = m.countries.join(', ');
  return `<b>${esc(m.name)}</b> — ${m.height.toLocaleString()} m (${esc(m.range)}, ${where})`;
}

function handleMountainSuperlative(t) {
  const isTallest = /\b(tallest|highest|largest|biggest)\b/i.test(t);
  const isShortest = /\b(shortest|smallest|lowest)\b/i.test(t);
  if (!isTallest && !isShortest) return null;

  const sorted = MOUNTAINS.slice().sort((a, b) => isTallest ? b.height - a.height : a.height - b.height);
  const top = sorted.slice(0, 5);
  let out = title(`${isTallest ? 'Highest' : 'Lowest'} mountains in the world`);
  top.forEach((m, i) => out += body(`${i + 1}. ${formatMountain(m)}`));
  out += close('Ask about mountains in a specific country, or "how tall is Mount Everest".');
  return wrap(out);
}

function handleMountainSpecific(t, m) {
  let out = title(m.name);
  out += body(`Height: <b>${m.height.toLocaleString()} m</b> above sea level.`);
  out += body(`Range: <b>${esc(m.range)}</b> · Continent: <b>${esc(m.continent)}</b>`);
  out += body(`Located in: <b>${esc(m.countries.join(', '))}</b>`);
  if (m.note) out += body(esc(m.note));
  out += close('Ask for the world\'s highest mountains, or mountains in a specific country.');
  return wrap(out);
}

function handleMountains(t, countryNames) {
  const superlative = handleMountainSuperlative(t);
  if (superlative && !countryNames.length) return superlative;

  if (!countryNames.length) {
    if (/\bmountains?\b|\bpeaks?\b/i.test(t)) {
      let out = title('Famous mountains (highest 10 in my data)');
      MOUNTAINS.slice().sort((a, b) => b.height - a.height).slice(0, 10)
        .forEach((m, i) => out += body(`${i + 1}. ${formatMountain(m)}`));
      out += close('Ask about a specific mountain, or mountains in a specific country.');
      return wrap(out);
    }
    return null;
  }

  // Country-scoped
  const knownCountries = C.filter(c => countryNames.some(n => new RegExp('\\b' + escRe(n) + '\\b', 'i').test(c.name) || c.name === n));
  const namesSet = new Set(countryNames);

  if (knownCountries.length) {
    const c = knownCountries[0];
    if (!c.mountains || !c.mountains.length) {
      return wrap(title(`Mountains of ${c.name}`) +
        body(`I don't have recorded mountains for ${esc(c.name)} in my data.`));
    }
    const enriched = c.mountains.map(name => {
      const m = MOUNTAINS.find(x => x.name === name);
      return m || { name, height: null };
    }).sort((a, b) => (b.height || 0) - (a.height || 0));

    if (/\b(tallest|highest|largest|biggest)\b/i.test(t)) {
      const top = enriched[0];
      let out = title(`Highest mountain in ${c.name}`);
      out += body(`<b>${esc(top.name)}</b> — ${top.height != null ? top.height.toLocaleString() + ' m' : 'height unknown'}`);
      out += head('Ranked');
      out += lst(enriched.map((m, i) => `${i + 1}. ${m.name}${m.height != null ? ' — ' + m.height.toLocaleString() + ' m' : ''}`));
      out += close(`Ask about a specific mountain, or "highest mountain in the world".`);
      return wrap(out);
    }
    if (/\b(shortest|smallest|lowest)\b/i.test(t)) {
      const bottom = enriched[enriched.length - 1];
      let out = title(`Lowest mountain in ${c.name}`);
      out += body(`<b>${esc(bottom.name)}</b> — ${bottom.height != null ? bottom.height.toLocaleString() + ' m' : 'height unknown'}`);
      out += close('Ask about a specific mountain.');
      return wrap(out);
    }
    let out = title(`Mountains in ${c.name}`);
    out += body(`${esc(c.name)} has <b>${enriched.length}</b> notable mountains in my data:`);
    out += lst(enriched.map(m => `${m.name}${m.height != null ? ' — ' + m.height.toLocaleString() + ' m' : ''}`));
    out += close(`Ask "highest mountain in ${c.name}" for a ranked answer.`);
    return wrap(out);
  }

  // Country not in DB but referenced in mountain data
  const scoped = MOUNTAINS.filter(m => m.countries.some(cn => namesSet.has(cn)));
  if (scoped.length) {
    const countryLabel = countryNames[0];
    const sorted = scoped.slice().sort((a, b) => b.height - a.height);
    if (/\b(tallest|highest|largest|biggest)\b/i.test(t)) {
      let out = title(`Highest mountain in ${countryLabel}`);
      out += body(formatMountain(sorted[0]));
      out += head('Ranked');
      out += lst(sorted.map((m, i) => `${i + 1}. ${m.name} — ${m.height.toLocaleString()} m`));
      return wrap(out);
    }
    let out = title(`Mountains in ${countryLabel}`);
    out += lst(sorted.map(m => `${m.name} — ${m.height.toLocaleString()} m`));
    return wrap(out);
  }

  return wrap(title('Mountains') + body(`I don't have mountain data for <b>${esc(countryNames[0])}</b> yet.`));
}

// ─── CLIFFS ───────────────────────────────────────────────

function formatCliff(cl) {
  return `<b>${esc(cl.name)}</b> — ${cl.cliffDrop.toLocaleString()} m (${esc(cl.type)}, ${esc(cl.country)})`;
}

function handleCliffSuperlative(t) {
  const isTallest = /\b(tallest|highest|largest|biggest)\b/i.test(t);
  const isShortest = /\b(shortest|smallest|lowest)\b/i.test(t);
  if (!isTallest && !isShortest) return null;
  const sorted = CLIFFS.slice().sort((a, b) => isTallest ? b.cliffDrop - a.cliffDrop : a.cliffDrop - b.cliffDrop);
  const top = sorted.slice(0, 5);
  let out = title(`${isTallest ? 'Tallest' : 'Shortest'} cliffs in the world`);
  out += body('Measured by <i>sheer cliff face</i> height, not elevation above sea level.');
  top.forEach((cl, i) => out += body(`${i + 1}. ${formatCliff(cl)}`));
  out += close('Ask about cliffs in a specific country, or a specific cliff by name.');
  return wrap(out);
}

function handleCliffSpecific(t, cl) {
  let out = title(cl.name);
  out += body(`Cliff face height: <b>${cl.cliffDrop.toLocaleString()} m</b>`);
  out += body(`Type: <b>${esc(cl.type)}</b> · Country: <b>${esc(cl.country)}</b> · Location: <b>${esc(cl.location)}</b>`);
  if (cl.note) out += body(esc(cl.note));
  out += close('Ask for the world\'s tallest cliffs, or cliffs in a specific country.');
  return wrap(out);
}

function handleCliffs(t, countryNames) {
  const superlative = handleCliffSuperlative(t);
  if (superlative && !countryNames.length) return superlative;

  const scoped = countryNames.length
    ? CLIFFS.filter(cl => countryNames.some(n => new RegExp('\\b' + escRe(n) + '\\b', 'i').test(cl.country) || cl.country === n))
    : [];

  if (scoped.length) {
    const label = countryNames[0];
    const sorted = scoped.slice().sort((a, b) => b.cliffDrop - a.cliffDrop);
    if (/\b(tallest|highest|largest|biggest)\b/i.test(t)) {
      let out = title(`Tallest cliff in ${label}`);
      out += body(formatCliff(sorted[0]));
      if (sorted.length > 1) {
        out += head('Ranked');
        out += lst(sorted.map((cl, i) => `${i + 1}. ${cl.name} — ${cl.cliffDrop.toLocaleString()} m`));
      }
      return wrap(out);
    }
    let out = title(`Cliffs in ${label}`);
    out += lst(sorted.map(cl => `${cl.name} — ${cl.cliffDrop.toLocaleString()} m (${cl.type})`));
    return wrap(out);
  }

  if (countryNames.length) return wrap(title('Cliffs') + body(`I don't have cliff data for <b>${esc(countryNames[0])}</b> yet.`));

  // No country, no superlative → general list
  if (/\bcliffs?\b/i.test(t)) {
    let out = title('Famous cliffs (highest in my data)');
    CLIFFS.slice().sort((a, b) => b.cliffDrop - a.cliffDrop).slice(0, 8)
      .forEach((cl, i) => out += body(`${i + 1}. ${formatCliff(cl)}`));
    out += close('Ask about a specific cliff, or cliffs in a country like Ireland or the UK.');
    return wrap(out);
  }
  return null;
}

// ─── SEAS ─────────────────────────────────────────────────

function formatSea(s) {
  return `<b>${esc(s.name)}</b> — area ${s.area.toLocaleString()} km², max depth ${s.maxDepth.toLocaleString()} m (${esc(s.ocean)})`;
}

function handleSeaSuperlative(t) {
  const isLargest = /\b(largest|biggest|most)\b/i.test(t);
  const isSmallest = /\b(smallest|least)\b/i.test(t);
  const isDeepest = /\b(deepest|deep)\b/i.test(t);
  const isShallowest = /\b(shallow|shallowest)\b/i.test(t);

  if (!isLargest && !isSmallest && !isDeepest && !isShallowest) return null;

  let metric = 'area', label = 'largest', dir = -1;
  if (isDeepest) { metric = 'maxDepth'; label = 'deepest'; }
  else if (isShallowest) { metric = 'maxDepth'; label = 'shallowest'; dir = 1; }
  else if (isSmallest) { metric = 'area'; label = 'smallest'; dir = 1; }
  else { metric = 'area'; label = 'largest'; }

  const sorted = SEAS.filter(s => s[metric] != null).slice().sort((a, b) => dir === -1 ? b[metric] - a[metric] : a[metric] - b[metric]);
  const top = sorted.slice(0, 5);

  let out = title(`${label.charAt(0).toUpperCase() + label.slice(1)} seas (by ${metric === 'area' ? 'area' : 'maximum depth'})`);
  top.forEach((s, i) => {
    const val = metric === 'area' ? `${s.area.toLocaleString()} km²` : `${s.maxDepth.toLocaleString()} m deep`;
    out += body(`${i + 1}. <b>${esc(s.name)}</b> — ${val}`);
  });
  out += close('Ask about a specific sea, or seas of a specific country.');
  return wrap(out);
}

function handleSeaSpecific(t, s) {
  let out = title(s.name);
  out += body(`Area: <b>${s.area.toLocaleString()} km²</b>`);
  out += body(`Average depth: <b>${s.avgDepth.toLocaleString()} m</b> · Maximum depth: <b>${s.maxDepth.toLocaleString()} m</b>`);
  out += body(`Ocean: <b>${esc(s.ocean)}</b> · Continent: <b>${esc(s.continent)}</b>`);
  out += body(`Bordering countries: <b>${esc(s.countries.join(', '))}</b>`);
  if (s.note) out += body(esc(s.note));
  out += close('Ask for largest/deepest seas, or seas around a specific country.');
  return wrap(out);
}

function handleSeas(t, countryNames) {
  // "which sea is between X and Y"
  if (/\bbetween\b/i.test(t) && countryNames.length >= 2) {
    const candidates = SEAS.filter(s =>
      countryNames.every(n => s.countries.some(cn => new RegExp('\\b' + escRe(n) + '\\b', 'i').test(cn) || cn === n))
    );
    if (candidates.length) {
      let out = title(`Seas between ${countryNames.slice(0, 2).join(' and ')}`);
      out += lst(candidates.map(s => `${s.name} — borders ${s.countries.length} countries`));
      return wrap(out);
    }
    return wrap(title('Sea between two countries') +
      body(`I don't have a sea in my data that directly borders both <b>${esc(countryNames[0])}</b> and <b>${esc(countryNames[1])}</b>.`));
  }

  const superlative = handleSeaSuperlative(t);
  if (superlative && !countryNames.length) return superlative;

  if (countryNames.length) {
    const scoped = SEAS.filter(s =>
      countryNames.some(n => s.countries.some(cn => new RegExp('\\b' + escRe(n) + '\\b', 'i').test(cn) || cn === n))
    );
    if (!scoped.length) {
      return wrap(title('Seas') + body(`I don't have seas bordering <b>${esc(countryNames[0])}</b> in my data.`));
    }
    const label = countryNames[0];
    let out = title(`Seas around ${label}`);
    out += lst(scoped.map(s => `${s.name} — ${s.area.toLocaleString()} km² (${s.ocean})`));
    out += close('Ask about a specific sea, or "largest sea in the world".');
    return wrap(out);
  }

  // No country, no superlative → general list
  if (/\bseas?\b|\boceans?\b/i.test(t)) {
    let out = title('Major seas of the world (largest 8 in my data)');
    SEAS.slice().sort((a, b) => b.area - a.area).slice(0, 8)
      .forEach((s, i) => out += body(`${i + 1}. ${formatSea(s)}`));
    out += close('Ask about a specific sea, or "deepest sea in the world".');
    return wrap(out);
  }
  return null;
}

// ─── RIVERS ───────────────────────────────────────────────

function handleRiverSuperlative(t, isLongest) {
  const sorted = RIVERS.slice().sort((a, b) => isLongest ? b.length - a.length : a.length - b.length);
  const top = sorted.slice(0, 5);
  let out = title(`${isLongest ? 'Longest' : 'Shortest'} rivers in the world`);
  top.forEach((r, i) => out += body(`${i + 1}. <b>${esc(r.name)}</b> — ${r.length.toLocaleString()} km (${esc(r.continent)})`));
  out += close('Ask about rivers in a specific country, or any other geography question.');
  return wrap(out);
}

function handleRivers(t, countryNames) {
  const isHowMany = /\bhow\s+many\s+rivers\b/i.test(t);
  const wantsLongest = /\b(longest|largest|biggest)\b/i.test(t);
  const wantsShortest = /\b(shortest|smallest)\b/i.test(t);
  const isSuperlative = wantsLongest || wantsShortest;
  const isWorld = /\b(world|worldwide|global|on\s+earth)\b/i.test(t) && !countryNames.length;

  if (isWorld) {
    const sorted = RIVERS.slice().sort((a, b) => b.length - a.length);
    const r = sorted[0];
    return wrap(
      title(`Longest river in the world`) +
      body(`The <b>${esc(r.name)}</b> is the longest river in the world at about <b>${r.length.toLocaleString()} km</b>. It flows through ${esc(r.countries.join(', '))}.`) +
      close('Want the top 5 longest rivers, or rivers of a specific country?')
    );
  }

  if (!countryNames.length) {
    if (/\brivers?\b/i.test(t) && isSuperlative) return handleRiverSuperlative(t, wantsLongest);
    return null;
  }

  const c = C.find(x => countryNames.some(n => new RegExp('\\b' + escRe(n) + '\\b', 'i').test(x.name)));
  if (!c) return wrap(title('Rivers') + body(`I don't have a river list for <b>${esc(countryNames[0])}</b>.`));
  if (!c.rivers || !c.rivers.length) {
    return wrap(title(`Rivers of ${c.name}`) + body(`I don't have a list of major rivers for ${esc(c.name)} in my data.`));
  }

  if (isSuperlative) {
    const enriched = c.rivers.map(name => {
      const r = RIVERS.find(r => r.name.toLowerCase() === name.toLowerCase());
      return { name, length: r ? r.length : null };
    });
    const known = enriched.filter(x => x.length != null).sort((a, b) => wantsLongest ? b.length - a.length : a.length - b.length);
    const unknown = enriched.filter(x => x.length == null);

    if (known.length) {
      const top = known[0];
      let out = title(`${wantsLongest ? 'Longest' : 'Shortest'} river in ${c.name}`);
      out += body(`The <b>${esc(top.name)}</b> is the ${wantsLongest ? 'longest' : 'shortest'} among ${esc(c.name)}'s major rivers in my records, at about <b>${top.length.toLocaleString()} km</b> (total length).`);
      if (known.length > 1) {
        out += head('Ranked by known total length');
        out += lst(known.map((r, i) => `${i + 1}. ${r.name} — ${r.length.toLocaleString()} km`));
      }
      if (unknown.length) {
        out += head('Other rivers (length not recorded)');
        out += body(unknown.map(r => r.name).join(', ') + '.');
      }
      return wrap(out);
    }
    return wrap(title(`Rivers of ${c.name}`) + body(`I don't have length data for ${esc(c.name)}'s rivers.`) + lst(c.rivers));
  }

  let out = title(`Rivers in ${c.name}`);
  out += body(`${esc(c.name)} has <b>${c.rivers.length}</b> major rivers in my records:`);
  out += lst(c.rivers);
  if (isHowMany) out += body(`So the answer is: <b>${c.rivers.length}</b>.`);
  out += close('Ask about a specific river, or "the longest river in the world".');
  return wrap(out);
}

// ─── Country-level superlatives ───────────────────────────

function formatMetric(value, metric) {
  if (metric === 'population') return value.toLocaleString() + ' people';
  if (metric === 'populationDensity') return value.toLocaleString() + ' people/km²';
  if (metric === 'area') return value.toLocaleString() + ' km²';
  if (metric === 'gdpPerCapita') return '$' + value.toLocaleString();
  if (metric === 'gdp' || metric === 'gnp') return fmtBig(value);
  if (metric === 'hdi') return value.toFixed(3);
  return String(value);
}

function handleSuperlative(t) {
  const isLargest = /\b(largest|biggest|most|highest|richest|longest|tallest|greatest)\b/i.test(t);
  const isSmallest = /\b(smallest|least|lowest|poorest|shortest)\b/i.test(t);
  if (!isLargest && !isSmallest) return null;

  if (/\brivers?\b|\bmountains?\b|\bcliffs?\b|\bseas?\b/i.test(t) && findGeoCountryNames(t).length) return null;

  let metric = null, label = '';
  if (/\bpopulation\s+density\b/i.test(t)) { metric = 'populationDensity'; label = 'population density'; }
  else if (/\bpopulous\b|\bpopulation\b/i.test(t)) { metric = 'population'; label = 'population'; }
  else if (/\barea\b|\bsize\b|\bland\b|\bbig\b/i.test(t) && /\bcountr/i.test(t)) { metric = 'area'; label = 'area'; }
  else if (/\bgdp\s*(?:per\s+capita|per\s+person)\b/i.test(t)) { metric = 'gdpPerCapita'; label = 'GDP per capita'; }
  else if (/\bgdp\b/i.test(t)) { metric = 'gdp'; label = 'GDP'; }
  else if (/\bgnp\b/i.test(t)) { metric = 'gnp'; label = 'GNP'; }
  else if (/\bhdi\b/i.test(t)) { metric = 'hdi'; label = 'HDI'; }
  else if (/\brivers?\b/i.test(t)) return handleRiverSuperlative(t, isLargest);

  if (!metric) {
    if (/\bcountr/i.test(t)) {
      if (/\bpopulous\b|\bpeople\b/i.test(t)) { metric = 'population'; label = 'population'; }
      else { metric = 'area'; label = 'area'; }
    } else return null;
  }

  const sorted = C.filter(c => c[metric] != null).slice().sort((a, b) => isLargest ? b[metric] - a[metric] : a[metric] - b[metric]);
  const top = sorted.slice(0, 5);
  let out = title(`Top ${top.length} countries by ${label} (${isLargest ? 'highest' : 'lowest'})`);
  top.forEach((c, i) => out += body(`${i + 1}. <b>${esc(c.name)}</b> — ${formatMetric(c[metric], metric)}`));
  out += close(`Ask about any of these countries, or compare two of them.`);
  return wrap(out);
}

// ─── Comparison ───────────────────────────────────────────

function handleComparison(a, b) {
  let out = title(`${a.name} vs ${b.name}`);
  const rows = [
    ['Capital', a.capital, b.capital],
    ['Population', a.population.toLocaleString(), b.population.toLocaleString()],
    ['Population density', a.populationDensity != null ? a.populationDensity.toLocaleString() + ' /km²' : '—', b.populationDensity != null ? b.populationDensity.toLocaleString() + ' /km²' : '—'],
    ['Area', a.area.toLocaleString() + ' km²', b.area.toLocaleString() + ' km²'],
    ['GDP', fmtBig(a.gdp), fmtBig(b.gdp)],
    ['GDP per capita', a.gdpPerCapita ? '$' + a.gdpPerCapita.toLocaleString() : '—', b.gdpPerCapita ? '$' + b.gdpPerCapita.toLocaleString() : '—'],
    ['GDP growth', a.gdpGrowth + '%', b.gdpGrowth + '%'],
    ['HDI', a.hdi.toFixed(3), b.hdi.toFixed(3)],
    ['Currency', a.currency || '—', b.currency || '—'],
    ['Continent', a.continent, b.continent],
  ];
  out += '<div class="xetex-table-wrap"><table class="xetex-table xetex-compare-table">' +
    '<thead><tr><th>Attribute</th><th>' + esc(a.name) + '</th><th>' + esc(b.name) + '</th></tr></thead><tbody>';
  for (const [attr, va, vb] of rows) out += '<tr><td>' + esc(attr) + '</td><td>' + esc(String(va)) + '</td><td>' + esc(String(vb)) + '</td></tr>';
  out += '</tbody></table></div>';

  const popWinner  = a.population > b.population ? a : b;
  const areaWinner = a.area > b.area ? a : b;
  const gdpWinner  = a.gdp > b.gdp ? a : b;
  const hdiWinner  = a.hdi > b.hdi ? a : b;
  out += head('Quick summary');
  out += lst([
    `${popWinner.name} has the larger population.`,
    `${areaWinner.name} covers more land area.`,
    `${gdpWinner.name} has the larger GDP.`,
    `${hdiWinner.name} has the higher Human Development Index.`,
  ]);
  out += close('Want history, culture, or geography for either country?');
  return wrap(out);
}

// ─── Attributes ───────────────────────────────────────────

function handleAttribute(c, attr) {
  const value = attr.fmt(c);
  let out = title(`${attr.label} of ${c.name}`);
  if (attr.long) out += body(esc(value || 'No information available yet.'));
  else if (attr.list) {
    if (!value || !value.length) out += body(`${esc(c.name)} has no recorded ${attr.label.toLowerCase()} in my data.`);
    else { out += body(`${esc(c.name)} has ${value.length} recorded ${attr.label.toLowerCase()}:`); out += lst(value); }
  } else out += body(`<b>${esc(String(value || 'unknown'))}</b>`);
  out += close(`Ask more about ${c.name}, or compare it with another country.`);
  return wrap(out);
}

function handleMultiAttribute(countries, attr) {
  let out = title(`${attr.label} — ${countries.map(c => c.name).join(' & ')}`);
  for (const c of countries) {
    const value = attr.fmt(c);
    out += head(c.name);
    if (attr.long) out += body(esc(value || 'No information available yet.'));
    else if (attr.list) {
      if (!value || !value.length) out += body(`No recorded ${attr.label.toLowerCase()} in my data.`);
      else { out += body(`${value.length} recorded ${attr.label.toLowerCase()}:`); out += lst(value); }
    } else out += body(`<b>${esc(String(value || 'unknown'))}</b>`);
  }
  out += close('Ask about a specific one for more detail.');
  return wrap(out);
}

// ─── Overview ─────────────────────────────────────────────

function handleOverview(c) {
  let out = title(c.name);
  out += body(c.history || 'No history recorded.');
  const rows = [
    ['Capital', c.capital],
    ['Continent', c.continent],
    ['Population', c.population.toLocaleString()],
    ['Area', c.area.toLocaleString() + ' km²'],
    ['GDP', fmtBig(c.gdp)],
    ['HDI', c.hdi ? c.hdi.toFixed(3) : '—'],
    ['Currency', c.currency],
    ['Languages', c.languages.join(', ')],
  ];
  out += head('Key facts');
  out += '<div class="xetex-table-wrap"><table class="xetex-table"><tbody>';
  for (const [k, v] of rows) out += '<tr><td>' + esc(k) + '</td><td>' + esc(String(v)) + '</td></tr>';
  out += '</tbody></table></div>';
  if (c.culture) { out += head('Culture'); out += body(esc(c.culture)); }
  if (c.events && c.events.length) { out += head('Major events'); out += lst(c.events.slice(0, 5)); }
  out += close(`Ask for its history, geography, or compare it with another country.`);
  return wrap(out);
}

// ─── Main handler ─────────────────────────────────────────

function countryHandle(text) {
  const t = String(text || '').trim();
  if (!t) return null;

  const countries = findAllCountries(t);
  const geoCountryNames = findGeoCountryNames(t);

  // 1. Comparison
  if (countries.length >= 2 && /\b(compare|comparison|vs\.?|versus|better|worse|bigger|smaller|more|less|than|and)\b/i.test(t) && !/\bhistory\b|\bculture\b|\bindependence\b/i.test(t)) {
    return handleComparison(countries[0], countries[1]);
  }

  // 2. Specific entity lookups (by exact name)
  const specMountain = findMountainInText(t);
  if (specMountain && /\b(how\s+tall|height|about|what|where|describe|tell|info)\b/i.test(t)) return handleMountainSpecific(t, specMountain);
  const specCliff = findCliffInText(t);
  if (specCliff && /\b(how\s+tall|height|about|what|where|describe|tell|info)\b/i.test(t)) return handleCliffSpecific(t, specCliff);
  const specSea = findSeaInText(t);
  if (specSea && /\b(how\s+(?:deep|big|large)|depth|area|about|what|where|describe|tell|info)\b/i.test(t)) return handleSeaSpecific(t, specSea);

  // 3. Rivers
  if (/\brivers?\b/i.test(t)) {
    const r = handleRivers(t, geoCountryNames);
    if (r) return r;
  }

  // 4. Mountains
  if (/\bmountains?\b|\bpeaks?\b/i.test(t)) {
    const r = handleMountains(t, geoCountryNames);
    if (r) return r;
  }

  // 5. Cliffs
  if (/\bcliffs?\b/i.test(t)) {
    const r = handleCliffs(t, geoCountryNames);
    if (r) return r;
  }

  // 6. Seas
  if (/\bseas?\b|\boceans?\b/i.test(t)) {
    const r = handleSeas(t, geoCountryNames);
    if (r) return r;
  }

  // 7. Country superlative
  if (/\b(largest|biggest|smallest|most|least|highest|lowest|richest|poorest)\b/i.test(t)) {
    const sup = handleSuperlative(t);
    if (sup) return sup;
  }

  // 8. Country attributes
  if (countries.length >= 1) {
    if (countries.length === 2 && !/\b(compare|vs|versus)\b/i.test(t)) {
      for (const a of ATTRS) if (a.re.test(t)) return handleMultiAttribute(countries, a);
    }
    const c = countries[0];
    for (const a of ATTRS) if (a.re.test(t)) return handleAttribute(c, a);
    if (/\b(tell\s+me\s+about|about|facts?\s+(?:about|on)|info(?:rmation)?\s+(?:about|on)|describe|overview|profile|who\s+is|what\s+is)\b/i.test(t)) return handleOverview(c);
  }

  // 9. Fallback
  if (countries.length === 1) return handleOverview(countries[0]);

  return wrap(
    title('Country / geography query') +
    body('I couldn\'t read that as a geography question. Try: <b>capital of France</b>, <b>tallest mountain in the world</b>, <b>seas around Bangladesh</b>, <b>cliffs in Ireland</b>, or <b>USA vs China</b>.')
  );
}

// ─── Register tool ────────────────────────────────────────

if (W.Xenon && W.Xenon.Tools && typeof W.Xenon.Tools.register === 'function') {
  W.Xenon.Tools.register({
    name: 'country',
    aliases: ['countries'],
    summary: 'Countries, rivers, mountains, cliffs and seas',
    usage: '/country <query>',
    example: '/country tallest mountain in the world',
    run: (a) => countryHandle(a),
  });
}

W.isCountryQuery = isCountryQuery;
W.countryHandle   = countryHandle;
W.findAllCountries = findAllCountries;

})(window);