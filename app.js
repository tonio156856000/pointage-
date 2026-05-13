// ═══════════════════════════════════════════════
//  CONSTANTES & DONNÉES
// ═══════════════════════════════════════════════
const DATA_KEY     = 'pointage_data';
const SETTINGS_KEY = 'pointage_settings';

const JOURS_COURT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const JOURS_FULL  = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const MOIS_COURT  = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc'];
const MOIS_FULL   = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

let data = {};
let settings = {
  heureArrivee : '08:00',
  heureDepart  : '17:00',
  pauseMin     : 30,
  weeklyHours  : 35
};

// ─── STRUCTURE D'UNE ENTRÉE ───
// {
//   arrivee     : "08:00",
//   depart      : "17:00",
//   pauseMin    : 30,
//   typeJournee : "normal",   // normal|conge|sans-solde|formation|maladie|ferie|rtt
//   client      : "AI",
//   nomClient   : "BOUTIN",
//   chantier    : "25-6028",
//   pTraj       : 0,
//   gTraj       : 0,
//   repas       : 0,
//   nuit        : 0,
//   deplacement : 0,
//   ticketResto : 0,
//   vehicule    : 0
// }

// ═══════════════════════════════════════════════
//  PERSISTANCE
// ═══════════════════════════════════════════════
function loadData() {
  const d = localStorage.getItem(DATA_KEY);
  if (d) data = JSON.parse(d);
  const s = localStorage.getItem(SETTINGS_KEY);
  if (s) settings = { ...settings, ...JSON.parse(s) };
}
function saveData() { localStorage.setItem(DATA_KEY, JSON.stringify(data)); }
function savePersistSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }

// ═══════════════════════════════════════════════
//  HELPERS TEMPS
// ═══════════════════════════════════════════════
function todayKey() { return new Date().toISOString().split('T')[0]; }

function calcRawMinutes(arrivee, depart) {
  if (!arrivee || !depart) return null;
  const [ah, am] = arrivee.split(':').map(Number);
  const [dh, dm] = depart.split(':').map(Number);
  const total = (dh * 60 + dm) - (ah * 60 + am);
  return total > 0 ? total : null;
}

function calcNetMinutes(entry) {
  const raw = calcRawMinutes(entry.arrivee, entry.depart);
  if (raw === null) return null;
  const net = raw - (entry.pauseMin || 0);
  return net > 0 ? net : 0;
}

function fmtHHMM(totalMin) {
  if (totalMin === null || totalMin === undefined) return '--h--';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function toDecimal(minutes) {
  if (!minutes) return 0;
  return Math.round((minutes / 60) * 4) / 4;
}

function getWeekDates(date) {
  const d = date ? new Date(date + 'T12:00:00') : new Date();
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd.toISOString().split('T')[0];
  });
}

function getWeekNumber(d) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
}

function formatDateFR(d) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

// ═══════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ═══════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════
function showPage(pageId, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  btn.classList.add('active');
  if (pageId === 'historique') renderHistory();
  if (pageId === 'stats')      renderStats();
  if (pageId === 'settings')   renderSettingsPage();
}

// ═══════════════════════════════════════════════
//  POINTAGE RAPIDE
// ═══════════════════════════════════════════════
function pointer(type) {
  const now    = new Date();
  const key    = todayKey();
  const heure  = now.toTimeString().slice(0, 5);

  if (!data[key]) data[key] = { typeJournee: 'normal', pauseMin: settings.pauseMin };

  if (type === 'arrivee') {
    if (data[key].arrivee && !confirm(`Arrivée déjà pointée à ${data[key].arrivee}. Remplacer ?`)) return;
    data[key].arrivee = heure;
    showToast(`✅ Arrivée pointée à ${heure}`);
  } else {
    if (!data[key].arrivee) { showToast('⚠️ Pointe d\'abord ton arrivée !'); return; }
    if (data[key].depart && !confirm(`Départ déjà pointé à ${data[key].depart}. Remplacer ?`)) return;
    data[key].depart = heure;
    showToast(`✅ Départ pointé à ${heure}`);
  }

  saveData();
  if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
  updateAccueil();
}

// ═══════════════════════════════════════════════
//  MISE À JOUR PAGE ACCUEIL
// ═══════════════════════════════════════════════
function updateAccueil() {
  const key   = todayKey();
  const today = data[key] || {};
  const now   = new Date();

  // Date
  document.getElementById('date-today').textContent =
    `${JOURS_FULL[now.getDay()]} ${now.getDate()} ${MOIS_FULL[now.getMonth()]} ${now.getFullYear()}`;

  // Statut
  const card   = document.getElementById('status-card');
  const icon   = document.getElementById('status-icon');
  const text   = document.getElementById('status-text');
  const timeEl = document.getElementById('status-time');

  if (today.depart) {
    card.className = 'status-card done';
    icon.textContent = '✅';
    text.textContent = 'Journée terminée !';
    const net = calcNetMinutes(today);
    timeEl.textContent = net !== null ? `${fmtHHMM(net)} travaillées (net)` : '';
  } else if (today.arrivee) {
    card.className = 'status-card working';
    icon.textContent = '💼';
    text.textContent = 'En cours de travail';
    const [ah, am] = today.arrivee.split(':').map(Number);
    const elapsed = (now.getHours() * 60 + now.getMinutes()) - (ah * 60 + am) - (today.pauseMin || 0);
    timeEl.textContent = elapsed >= 0 ? `Temps net estimé : ${fmtHHMM(elapsed)}` : '';
  } else {
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    card.className = 'status-card';
    icon.textContent = isWeekend ? '😎' : '⏰';
    text.textContent = isWeekend ? 'Bon week-end !' : 'Non pointé';
    timeEl.textContent = isWeekend ? 'Pas de travail aujourd\'hui' : '';
  }

  // Boutons
  document.getElementById('btn-arrive').disabled = !!today.arrivee;
  document.getElementById('btn-depart').disabled = !today.arrivee || !!today.depart;
  document.getElementById('btn-arrive-sub').textContent = today.arrivee ? today.arrivee : 'Pointer';
  document.getElementById('btn-depart-sub').textContent = today.depart  ? today.depart  : 'Pointer';

  // Résumé
  document.getElementById('today-arrive').textContent = today.arrivee || '--:--';
  document.getElementById('today-depart').textContent = today.depart  || '--:--';
  const pauseMin = today.pauseMin !== undefined ? today.pauseMin : settings.pauseMin;
  document.getElementById('today-pause').textContent = pauseMin ? `${pauseMin} min` : 'Aucune';
  document.getElementById('today-pause').className = 'summary-val' + (pauseMin ? '' : ' muted');
  const net = calcNetMinutes(today);
  document.getElementById('today-total').textContent = fmtHHMM(net);

  // Client
  const clientRow = document.getElementById('today-client-row');
  if (today.client || today.nomClient) {
    clientRow.style.display = 'flex';
    document.getElementById('today-client').textContent =
      [today.client, today.nomClient].filter(Boolean).join(' — ');
  } else {
    clientRow.style.display = 'none';
  }

  updateWeek();
}

function updateWeek() {
  const weekDates = getWeekDates().slice(0, 5); // lun-ven
  const todayStr  = todayKey();
  let totalMin    = 0;

  const html = weekDates.map(date => {
    const entry = data[date] || {};
    const net   = calcNetMinutes(entry);
    if (net) totalMin += net;
    const d      = new Date(date + 'T12:00:00');
    let dotClass = 'week-day-dot';
    if (net)            dotClass += ' done';
    else if (entry.arrivee) dotClass += ' partial';
    if (date === todayStr) dotClass += ' today';
    const label = net ? `${toDecimal(net)}` : (entry.arrivee ? '…' : '');
    return `<div class="week-day">
      <div class="week-day-name">${JOURS_COURT[d.getDay()]}</div>
      <div class="${dotClass}">${label}</div>
    </div>`;
  }).join('');

  document.getElementById('week-days').innerHTML = html;
  document.getElementById('week-hours').textContent = fmtHHMM(totalMin);

  const target = settings.weeklyHours * 60;
  document.getElementById('week-target-label').textContent = fmtHHMM(target);
  const pct = Math.min(100, (totalMin / target) * 100);
  const bar = document.getElementById('week-bar');
  bar.style.width = pct + '%';
  bar.style.background = pct >= 100 ? 'var(--success)' : 'var(--primary)';
}

// ═══════════════════════════════════════════════
//  ÉDITEUR DE JOURNÉE
// ═══════════════════════════════════════════════
let editorDate = null;

function openEditor(date) {
  editorDate = date;
  const entry = data[date] || {};
  const d     = new Date(date + 'T12:00:00');

  document.getElementById('sheet-title').textContent =
    `${JOURS_FULL[d.getDay()]} ${d.getDate()} ${MOIS_FULL[d.getMonth()]}`;

  document.getElementById('ed-arrivee').value    = entry.arrivee    || settings.heureArrivee;
  document.getElementById('ed-depart').value     = entry.depart     || settings.heureDepart;
  document.getElementById('ed-pause').value      = entry.pauseMin   !== undefined ? entry.pauseMin : settings.pauseMin;
  document.getElementById('ed-type').value       = entry.typeJournee || 'normal';
  document.getElementById('ed-client').value     = entry.client     || '';
  document.getElementById('ed-nom-client').value = entry.nomClient  || '';
  document.getElementById('ed-chantier').value   = entry.chantier   || '';
  document.getElementById('ed-ptraj').value      = entry.pTraj      || '';
  document.getElementById('ed-gtraj').value      = entry.gTraj      || '';
  document.getElementById('ed-repas').value      = entry.repas      || '';
  document.getElementById('ed-nuit').value       = entry.nuit       || '';
  document.getElementById('ed-deplacement').value = entry.deplacement || '';
  document.getElementById('ed-ticket').value     = entry.ticketResto || '';
  document.getElementById('ed-vehicule').value   = entry.vehicule   || '';

  updateNetPreview();

  document.getElementById('sheet-overlay').classList.add('show');
  document.getElementById('bottom-sheet').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeEditor() {
  document.getElementById('sheet-overlay').classList.remove('show');
  document.getElementById('bottom-sheet').classList.remove('show');
  document.body.style.overflow = '';
  editorDate = null;
}

function updateNetPreview() {
  const arrivee = document.getElementById('ed-arrivee').value;
  const depart  = document.getElementById('ed-depart').value;
  const pause   = parseInt(document.getElementById('ed-pause').value) || 0;
  const raw     = calcRawMinutes(arrivee, depart);
  const el      = document.getElementById('net-time-preview');
  if (raw !== null) {
    const net = Math.max(0, raw - pause);
    el.textContent = `Temps net : ${fmtHHMM(net)} (${toDecimal(net)}h)`;
    el.style.color = 'var(--success)';
  } else {
    el.textContent = 'Temps net : --';
    el.style.color = 'var(--text-muted)';
  }
}

function saveEditor() {
  if (!editorDate) return;

  if (!data[editorDate]) data[editorDate] = {};
  const entry = data[editorDate];

  entry.arrivee     = document.getElementById('ed-arrivee').value    || null;
  entry.depart      = document.getElementById('ed-depart').value     || null;
  entry.pauseMin    = parseInt(document.getElementById('ed-pause').value)         || 0;
  entry.typeJournee = document.getElementById('ed-type').value;
  entry.client      = document.getElementById('ed-client').value.trim().toUpperCase() || null;
  entry.nomClient   = document.getElementById('ed-nom-client').value.trim().toUpperCase() || null;
  entry.chantier    = document.getElementById('ed-chantier').value.trim()          || null;
  entry.pTraj       = parseFloat(document.getElementById('ed-ptraj').value)        || 0;
  entry.gTraj       = parseFloat(document.getElementById('ed-gtraj').value)        || 0;
  entry.repas       = parseFloat(document.getElementById('ed-repas').value)        || 0;
  entry.nuit        = parseFloat(document.getElementById('ed-nuit').value)         || 0;
  entry.deplacement = parseFloat(document.getElementById('ed-deplacement').value)  || 0;
  entry.ticketResto = parseFloat(document.getElementById('ed-ticket').value)       || 0;
  entry.vehicule    = parseFloat(document.getElementById('ed-vehicule').value)     || 0;

  saveData();
  closeEditor();
  showToast('✅ Journée enregistrée !');
  if (navigator.vibrate) navigator.vibrate(60);
  updateAccueil();
}

// ═══════════════════════════════════════════════
//  HISTORIQUE
// ═══════════════════════════════════════════════
function renderHistory() {
  const list    = document.getElementById('history-list');
  const entries = Object.entries(data).sort((a, b) => b[0].localeCompare(a[0]));

  if (!entries.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><p>Aucun pointage enregistré</p></div>`;
    return;
  }

  list.innerHTML = entries.map(([date, entry]) => {
    const d   = new Date(date + 'T12:00:00');
    const net = calcNetMinutes(entry);

    const fraisHtml = buildFraisChips(entry);
    const typeHtml  = buildTypeChip(entry.typeJournee);

    const clientStr = [entry.client, entry.nomClient].filter(Boolean).join(' — ');
    const chantierStr = entry.chantier ? ` · ${entry.chantier}` : '';

    return `
    <div class="history-item" onclick="openEditor('${date}')">
      <div class="history-top">
        <div class="history-date-col">
          <span class="history-day-name">${JOURS_COURT[d.getDay()]}</span>
          <span class="history-day-num">${d.getDate()}</span>
          <span class="history-month">${MOIS_COURT[d.getMonth()]}</span>
        </div>
        <div class="history-middle">
          <div class="history-times">
            <span class="time-chip arrivee">${entry.arrivee || '--:--'}</span>
            <span class="time-arrow">→</span>
            <span class="time-chip depart">${entry.depart || '--:--'}</span>
            ${entry.pauseMin ? `<span class="time-chip pause">-${entry.pauseMin}min</span>` : ''}
          </div>
          ${clientStr ? `<div class="history-client"><strong>${clientStr}</strong>${chantierStr}</div>` : ''}
        </div>
        <div class="history-dur ${net ? '' : 'incomplete'}">
          ${net !== null ? fmtHHMM(net) : (entry.arrivee ? '…' : '?')}
        </div>
      </div>
      ${(fraisHtml || typeHtml) ? `<div class="history-frais">${typeHtml}${fraisHtml}</div>` : ''}
    </div>`;
  }).join('');
}

function buildTypeChip(type) {
  if (!type || type === 'normal') return '';
  const labels = {
    'conge': '🌴 Congé', 'sans-solde': '⛔ Sans solde',
    'formation': '📚 Formation', 'maladie': '🤒 Maladie',
    'ferie': '🎉 Férié', 'rtt': '🔵 RTT'
  };
  return `<span class="type-chip type-${type}">${labels[type] || type}</span>`;
}

function buildFraisChips(entry) {
  const frais = [];
  if (entry.pTraj)       frais.push(`P.Traj ×${entry.pTraj}`);
  if (entry.gTraj)       frais.push(`G.Traj ×${entry.gTraj}`);
  if (entry.repas)       frais.push(`Repas ${entry.repas}€`);
  if (entry.nuit)        frais.push(`Nuit ${entry.nuit}€`);
  if (entry.deplacement) frais.push(`Dépl. ${entry.deplacement}€`);
  if (entry.ticketResto) frais.push(`T.Resto ${entry.ticketResto}€`);
  if (entry.vehicule)    frais.push(`Véhicule ${entry.vehicule}€`);
  return frais.map(f => `<span class="frais-chip">${f}</span>`).join('');
}

// ═══════════════════════════════════════════════
//  STATISTIQUES
// ═══════════════════════════════════════════════
function renderStats() {
  const content   = document.getElementById('stats-content');
  const completed = Object.entries(data).filter(([, e]) => e.arrivee && e.depart);

  if (completed.length < 2) {
    content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><p>Pas encore assez de données</p></div>`;
    return;
  }

  const nets      = completed.map(([, e]) => calcNetMinutes(e)).filter(Boolean);
  const totalMin  = nets.reduce((a, b) => a + b, 0);
  const avgMin    = Math.round(totalMin / nets.length);
  const maxMin    = Math.max(...nets);

  // Frais totaux
  const totals = { pTraj:0, gTraj:0, repas:0, nuit:0, deplacement:0, ticketResto:0, vehicule:0 };
  Object.values(data).forEach(e => {
    totals.pTraj       += e.pTraj       || 0;
    totals.gTraj       += e.gTraj       || 0;
    totals.repas       += e.repas       || 0;
    totals.nuit        += e.nuit        || 0;
    totals.deplacement += e.deplacement || 0;
    totals.ticketResto += e.ticketResto || 0;
    totals.vehicule    += e.vehicule    || 0;
  });

  // Bar chart par semaine
  const byWeek = {};
  completed.forEach(([date, entry]) => {
    const d   = new Date(date + 'T12:00:00');
    const key = `S${getWeekNumber(d)}`;
    if (!byWeek[key]) byWeek[key] = 0;
    byWeek[key] += calcNetMinutes(entry) || 0;
  });
  const weekEntries = Object.entries(byWeek).slice(-5);
  const maxWeek = Math.max(...weekEntries.map(([,v]) => v), settings.weeklyHours * 60);

  const barsHtml = weekEntries.map(([week, min]) => {
    const pct   = (min / maxWeek) * 100;
    const color = min >= settings.weeklyHours * 60 ? 'var(--success)' : 'var(--primary)';
    return `<div class="bar-col">
      <div class="bar-val">${fmtHHMM(min)}</div>
      <div class="bar-fill" style="height:${pct}%;background:${color}"></div>
      <div class="bar-week-label">${week}</div>
    </div>`;
  }).join('');

  const fmt2 = v => v % 1 === 0 ? v.toString() : v.toFixed(2);

  content.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value">${completed.length}</div><div class="stat-label">Jours pointés</div></div>
      <div class="stat-card"><div class="stat-value">${fmtHHMM(avgMin)}</div><div class="stat-label">Moyenne / jour</div></div>
      <div class="stat-card"><div class="stat-value">${fmtHHMM(totalMin)}</div><div class="stat-label">Total cumulé</div></div>
      <div class="stat-card"><div class="stat-value">${fmtHHMM(maxMin)}</div><div class="stat-label">Meilleure journée</div></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Heures nettes par semaine</div>
      <div class="bar-chart">${barsHtml}</div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Totaux frais & déplacements</div>
      <div class="frais-totals">
        <div class="frais-total-item"><span>Petit Trajet</span><strong>×${fmt2(totals.pTraj)}</strong></div>
        <div class="frais-total-item"><span>Grand Trajet</span><strong>×${fmt2(totals.gTraj)}</strong></div>
        <div class="frais-total-item"><span>Forfait Repas</span><strong>${fmt2(totals.repas)} €</strong></div>
        <div class="frais-total-item"><span>Forfait Nuit</span><strong>${fmt2(totals.nuit)} €</strong></div>
        <div class="frais-total-item"><span>Déplacement</span><strong>${fmt2(totals.deplacement)} €</strong></div>
        <div class="frais-total-item"><span>Ticket Resto</span><strong>${fmt2(totals.ticketResto)} €</strong></div>
        <div class="frais-total-item"><span>Véhicule</span><strong>${fmt2(totals.vehicule)} €</strong></div>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════
//  PARAMÈTRES
// ═══════════════════════════════════════════════
function renderSettingsPage() {
  document.getElementById('set-heure-arrivee').value = settings.heureArrivee;
  document.getElementById('set-heure-depart').value  = settings.heureDepart;
  document.getElementById('set-pause').value         = settings.pauseMin;
  document.getElementById('set-weekly-hours').value  = settings.weeklyHours;
  document.getElementById('shortcut-matin').textContent = settings.heureArrivee;
  document.getElementById('shortcut-soir').textContent  = settings.heureDepart;
}

function saveSettings() {
  settings.heureArrivee = document.getElementById('set-heure-arrivee').value;
  settings.heureDepart  = document.getElementById('set-heure-depart').value;
  settings.pauseMin     = parseInt(document.getElementById('set-pause').value) || 0;
  settings.weeklyHours  = parseInt(document.getElementById('set-weekly-hours').value) || 35;
  savePersistSettings();
  document.getElementById('shortcut-matin').textContent = settings.heureArrivee;
  document.getElementById('shortcut-soir').textContent  = settings.heureDepart;
  showToast('✅ Paramètres enregistrés !');
  updateAccueil();
}

// ═══════════════════════════════════════════════
//  EXPORT CSV — FORMAT FEUILLE D'HEURES
// ═══════════════════════════════════════════════
function exportCSV() {
  // Grouper par semaine (lun-dim)
  const allDates = Object.keys(data).sort();
  if (!allDates.length) { showToast('⚠️ Aucune donnée à exporter'); return; }

  const weekGroups = {};
  allDates.forEach(date => {
    const d    = new Date(date + 'T12:00:00');
    const mon  = new Date(d);
    mon.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
    const wKey = mon.toISOString().split('T')[0];
    if (!weekGroups[wKey]) weekGroups[wKey] = {};
    weekGroups[wKey][date] = data[date];
  });

  const SEP = ';'; // Séparateur CSV français (compatible Excel)
  let csv = '';

  Object.entries(weekGroups).sort().forEach(([mondayDate, weekData]) => {
    const d   = new Date(mondayDate + 'T12:00:00');
    const wn  = getWeekNumber(d);

    csv += `Semaine${SEP}${wn}\n`;
    csv += `Date${SEP}Jour${SEP}Client${SEP}Nom Client${SEP}N° Chantier${SEP}Travail${SEP}P.Traj${SEP}G.Traj${SEP}Type${SEP}Forfait Repas${SEP}Forfait Nuit${SEP}Déplacement${SEP}Ticket Resto${SEP}Véhicule\n`;

    // 7 jours de la semaine
    const weekDates = getWeekDates(mondayDate);
    let totTravail=0, totPTraj=0, totGTraj=0, totRepas=0, totNuit=0, totDepl=0, totTicket=0, totVehicule=0;

    weekDates.forEach(date => {
      const e  = weekData[date] || {};
      const dd = new Date(date + 'T12:00:00');
      const net = calcNetMinutes(e);
      const netDec = net ? toDecimal(net).toString().replace('.', ',') : '';

      if (net) totTravail += net;
      totPTraj    += e.pTraj       || 0;
      totGTraj    += e.gTraj       || 0;
      totRepas    += e.repas       || 0;
      totNuit     += e.nuit        || 0;
      totDepl     += e.deplacement || 0;
      totTicket   += e.ticketResto || 0;
      totVehicule += e.vehicule    || 0;

      const typeLabel = {
        'normal':'', 'conge':'congé', 'sans-solde':'sans solde',
        'formation':'formation', 'maladie':'maladie',
        'ferie':'férié', 'rtt':'RTT'
      }[e.typeJournee || 'normal'] || '';

      csv += [
        formatDateFR(dd),
        JOURS_FULL[dd.getDay()],
        e.client      || '',
        e.nomClient   || '',
        e.chantier    || '',
        netDec,
        (e.pTraj || 0).toString().replace('.', ','),
        (e.gTraj || 0).toString().replace('.', ','),
        typeLabel,
        (e.repas       || 0).toString().replace('.', ','),
        (e.nuit        || 0).toString().replace('.', ','),
        (e.deplacement || 0).toString().replace('.', ','),
        (e.ticketResto || 0).toString().replace('.', ','),
        (e.vehicule    || 0).toString().replace('.', ',')
      ].join(SEP) + '\n';
    });

    // Totaux
    const fmtT = v => v ? toDecimal(v).toString().replace('.', ',') : '0';
    const fmtN = v => v ? v.toString().replace('.', ',') : '0';
    csv += `${SEP}TOTAL${SEP}${SEP}${SEP}${SEP}${fmtT(totTravail)}${SEP}${fmtN(totPTraj)}${SEP}${fmtN(totGTraj)}${SEP}${SEP}${fmtN(totRepas)}${SEP}${fmtN(totNuit)}${SEP}${fmtN(totDepl)}${SEP}${fmtN(totTicket)}${SEP}${fmtN(totVehicule)}\n\n`;
  });

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `feuille_heures_${todayKey()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 Export téléchargé !');
}

// ═══════════════════════════════════════════════
//  EFFACER
// ═══════════════════════════════════════════════
function clearAllData() {
  if (confirm('Effacer tous les pointages ? Cette action est irréversible.')) {
    data = {};
    saveData();
    updateAccueil();
    showToast('🗑 Données effacées');
  }
}

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Toast
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'toast';
  document.body.appendChild(toast);

  loadData();
  updateAccueil();

  // Calcul temps net en live dans l'éditeur
  ['ed-arrivee', 'ed-depart', 'ed-pause'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateNetPreview);
  });

  // Refresh live toutes les 30s
  setInterval(() => {
    const key = todayKey();
    if (data[key]?.arrivee && !data[key]?.depart) updateAccueil();
  }, 30000);

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }
});
