const DATA_KEY     = 'pointage_data';
const SETTINGS_KEY = 'pointage_settings';
const CLIENTS_KEY  = 'pointage_clients';

const JOURS_COURT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const JOURS_FULL  = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const MOIS_COURT  = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc'];
const MOIS_FULL   = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

let data        = {};
let settings    = { heureArrivee:'08:00', heureDepart:'17:00', pauseMin:30, weeklyHours:35 };
let savedClients = []; // [{client, nomClient, chantier}]
let currentDate = todayKey();

// ═══ PERSISTANCE ═══
function loadData() {
  const d = localStorage.getItem(DATA_KEY);     if (d) data = JSON.parse(d);
  const s = localStorage.getItem(SETTINGS_KEY); if (s) settings = { ...settings, ...JSON.parse(s) };
  const c = localStorage.getItem(CLIENTS_KEY);  if (c) savedClients = JSON.parse(c);
}
function saveData()            { localStorage.setItem(DATA_KEY,     JSON.stringify(data));         }
function savePersistSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));     }
function saveClients()         { localStorage.setItem(CLIENTS_KEY,  JSON.stringify(savedClients)); }

// ═══ GESTION CLIENTS FAVORIS ═══
function addClientToFavoris(client, nomClient, chantier) {
  if (!client && !nomClient && !chantier) return;
  const exists = savedClients.find(c =>
    c.client === client && c.nomClient === nomClient && c.chantier === chantier);
  if (!exists) {
    savedClients.unshift({ client, nomClient, chantier });
    if (savedClients.length > 20) savedClients.pop(); // max 20
    saveClients();
    renderFavorisChips();
    updateDatalistClients();
  }
}

function renderFavorisChips() {
  const container = document.getElementById('clients-favoris');
  if (!container) return;
  if (!savedClients.length) { container.innerHTML = ''; return; }
  container.innerHTML = savedClients.map((c, i) => {
    const label = [c.client, c.nomClient, c.chantier].filter(Boolean).join(' · ');
    return `<button class="favori-chip" onclick="selectClient(${i})">${label}</button>`;
  }).join('');
}

function selectClient(index) {
  const c = savedClients[index];
  if (!c) return;
  document.getElementById('f-client').value     = c.client     || '';
  document.getElementById('f-nom-client').value = c.nomClient  || '';
  document.getElementById('f-chantier').value   = c.chantier   || '';
  autoSave();
  showToast(`✅ ${[c.client, c.nomClient, c.chantier].filter(Boolean).join(' · ')}`);
}

function updateDatalistClients() {
  const clients   = [...new Set(savedClients.map(c => c.client).filter(Boolean))];
  const nomClients = [...new Set(savedClients.map(c => c.nomClient).filter(Boolean))];
  const chantiers = [...new Set(savedClients.map(c => c.chantier).filter(Boolean))];

  document.getElementById('list-client').innerHTML =
    clients.map(v => `<option value="${v}">`).join('');
  document.getElementById('list-nom-client').innerHTML =
    nomClients.map(v => `<option value="${v}">`).join('');
  document.getElementById('list-chantier').innerHTML =
    chantiers.map(v => `<option value="${v}">`).join('');
}

function suggestClient() {
  // Auto-remplir nomClient si le code client est connu
  const val = document.getElementById('f-client').value.trim().toUpperCase();
  const match = savedClients.find(c => c.client === val);
  if (match && !document.getElementById('f-nom-client').value) {
    document.getElementById('f-nom-client').value = match.nomClient || '';
  }
}

function onChantierInput() {
  // Auto-remplir client + nomClient si le chantier est connu
  const val = document.getElementById('f-chantier').value.trim();
  const match = savedClients.find(c => c.chantier === val);
  if (match) {
    if (!document.getElementById('f-client').value)
      document.getElementById('f-client').value = match.client || '';
    if (!document.getElementById('f-nom-client').value)
      document.getElementById('f-nom-client').value = match.nomClient || '';
  }
}

// ═══ HELPERS ═══
function todayKey() { return new Date().toISOString().split('T')[0]; }

function calcNetMinutes(arrivee, depart, pauseMin) {
  if (!arrivee || !depart) return null;
  const [ah,am] = arrivee.split(':').map(Number);
  const [dh,dm] = depart.split(':').map(Number);
  const raw = (dh*60+dm) - (ah*60+am);
  if (raw <= 0) return null;
  return Math.max(0, raw - (pauseMin || 0));
}

function fmtHHMM(min) {
  if (min === null || min === undefined) return '--h--';
  return `${Math.floor(min/60)}h${String(min%60).padStart(2,'0')}`;
}

function toDecimal(min) {
  return Math.round((min/60)*4)/4;
}

function getWeekMondayDates() {
  const d   = new Date();
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day===0 ? 6 : day-1));
  return Array.from({length:5}, (_,i) => {
    const dd = new Date(mon); dd.setDate(mon.getDate()+i);
    return dd.toISOString().split('T')[0];
  });
}

function getWeekDates7(mondayDate) {
  const mon = new Date(mondayDate+'T12:00:00');
  return Array.from({length:7}, (_,i) => {
    const dd = new Date(mon); dd.setDate(mon.getDate()+i);
    return dd.toISOString().split('T')[0];
  });
}

function getWeekNumber(d) {
  const jan = new Date(d.getFullYear(),0,1);
  return Math.ceil((((d-jan)/86400000)+jan.getDay()+1)/7);
}

function formatDateFR(d) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

// ═══ TOAST ═══
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ═══ NAVIGATION ═══
function showPage(pageId, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-'+pageId).classList.add('active');
  btn.classList.add('active');
  if (pageId === 'historique') renderHistory();
  if (pageId === 'stats')      renderStats();
  if (pageId === 'settings')   renderSettingsPage();
}

// ═══ POINTAGE RAPIDE ═══
function pointer(type) {
  const heure = new Date().toTimeString().slice(0,5);
  const key   = currentDate;
  if (!data[key]) data[key] = { pauseMin: settings.pauseMin, typeJournee:'normal' };

  if (type === 'arrivee') {
    if (data[key].arrivee && !confirm(`Arrivée déjà à ${data[key].arrivee}. Remplacer ?`)) return;
    data[key].arrivee = heure;
    document.getElementById('f-arrivee').value = heure;
    showToast(`✅ Arrivée : ${heure}`);
  } else {
    if (!data[key].arrivee) { showToast('⚠️ Pointe d\'abord ton arrivée !'); return; }
    if (data[key].depart && !confirm(`Départ déjà à ${data[key].depart}. Remplacer ?`)) return;
    data[key].depart = heure;
    document.getElementById('f-depart').value = heure;
    showToast(`✅ Départ : ${heure}`);
  }

  saveData();
  if (navigator.vibrate) navigator.vibrate([50,30,50]);
  updateBanner();
  updateButtons();
  updateWeek();
}

// ═══ REMPLIR LES CHAMPS DEPUIS LES DONNÉES ═══
function fillFields(date) {
  const e = data[date] || {};
  document.getElementById('f-arrivee').value     = e.arrivee     || '';
  document.getElementById('f-depart').value      = e.depart      || '';
  document.getElementById('f-pause').value       = e.pauseMin    !== undefined ? e.pauseMin : settings.pauseMin;
  document.getElementById('f-type').value        = e.typeJournee || 'normal';
  document.getElementById('f-client').value      = e.client      || '';
  document.getElementById('f-nom-client').value  = e.nomClient   || '';
  document.getElementById('f-chantier').value    = e.chantier    || '';
  document.getElementById('f-ptraj').value       = e.pTraj       || '';
  document.getElementById('f-gtraj').value       = e.gTraj       || '';
  document.getElementById('f-repas').value       = e.repas       || '';
  document.getElementById('f-nuit').value        = e.nuit        || '';
  document.getElementById('f-deplacement').value = e.deplacement || '';
  document.getElementById('f-ticket').value      = e.ticketResto || '';
  document.getElementById('f-vehicule').value    = e.vehicule    || '';
}

// ═══ AUTO-SAVE (appelé à chaque changement de champ) ═══
function autoSave() {
  const key = currentDate;
  if (!data[key]) data[key] = {};
  const e = data[key];

  e.arrivee     = document.getElementById('f-arrivee').value     || null;
  e.depart      = document.getElementById('f-depart').value      || null;
  e.pauseMin    = parseInt(document.getElementById('f-pause').value)         || 0;
  e.typeJournee = document.getElementById('f-type').value;
  e.client      = document.getElementById('f-client').value.trim().toUpperCase()    || null;
  e.nomClient   = document.getElementById('f-nom-client').value.trim().toUpperCase() || null;
  e.chantier    = document.getElementById('f-chantier').value.trim()                || null;
  e.pTraj       = parseFloat(document.getElementById('f-ptraj').value)       || 0;
  e.gTraj       = parseFloat(document.getElementById('f-gtraj').value)       || 0;
  e.repas       = parseFloat(document.getElementById('f-repas').value)       || 0;
  e.nuit        = parseFloat(document.getElementById('f-nuit').value)        || 0;
  e.deplacement = parseFloat(document.getElementById('f-deplacement').value) || 0;
  e.ticketResto = parseFloat(document.getElementById('f-ticket').value)      || 0;
  e.vehicule    = parseFloat(document.getElementById('f-vehicule').value)    || 0;

  // Enregistrer combo client/chantier dans les favoris
  if (e.client || e.nomClient || e.chantier) {
    addClientToFavoris(e.client, e.nomClient, e.chantier);
  }

  saveData();
  updateBanner();
  updateButtons();
  updateWeek();
}

// ═══ BANNIÈRE TEMPS NET ═══
function updateBanner() {
  const key     = currentDate;
  const e       = data[key] || {};
  const arrivee = document.getElementById('f-arrivee').value || e.arrivee;
  const depart  = document.getElementById('f-depart').value  || e.depart;
  const pause   = parseInt(document.getElementById('f-pause').value) || e.pauseMin || settings.pauseMin;
  const banner  = document.getElementById('net-banner');
  const icon    = document.getElementById('net-icon');
  const label   = document.getElementById('net-label');
  const value   = document.getElementById('net-value');

  const net = calcNetMinutes(arrivee, depart, pause);

  if (e.depart || depart) {
    banner.className = 'net-banner done';
    icon.textContent  = '✅';
    label.textContent = 'Temps net :';
    value.textContent = net !== null ? `${fmtHHMM(net)} (${toDecimal(net)}h)` : '--';
  } else if (e.arrivee || arrivee) {
    banner.className = 'net-banner working';
    icon.textContent  = '💼';
    const now     = new Date();
    const [ah,am] = (arrivee||'00:00').split(':').map(Number);
    const elapsed = Math.max(0, (now.getHours()*60+now.getMinutes()) - (ah*60+am) - pause);
    label.textContent = 'En cours :';
    value.textContent = fmtHHMM(elapsed);
  } else {
    const isWeekend = new Date().getDay()===0 || new Date().getDay()===6;
    banner.className = 'net-banner';
    icon.textContent  = isWeekend ? '😎' : '⏰';
    label.textContent = isWeekend ? 'Bon week-end !' : 'Non pointé';
    value.textContent = '';
  }
}

function updateButtons() {
  const e = data[currentDate] || {};
  const btnA = document.getElementById('btn-arrive');
  const btnD = document.getElementById('btn-depart');
  btnA.disabled = !!e.arrivee;
  btnD.disabled = !e.arrivee || !!e.depart;
  document.getElementById('btn-arrive-sub').textContent = e.arrivee ? e.arrivee : 'Appuyer pour pointer';
  document.getElementById('btn-depart-sub').textContent = e.depart  ? e.depart  : 'Appuyer pour pointer';
}

// ═══ SEMAINE ═══
function updateWeek() {
  const weekDates = getWeekMondayDates();
  const todayStr  = todayKey();
  let totalMin    = 0;

  const html = weekDates.map(date => {
    const e   = data[date] || {};
    const net = calcNetMinutes(e.arrivee, e.depart, e.pauseMin !== undefined ? e.pauseMin : settings.pauseMin);
    if (net) totalMin += net;
    const d = new Date(date+'T12:00:00');
    let cls = 'week-day-dot';
    if (net)         cls += ' done';
    else if (e.arrivee) cls += ' partial';
    if (date===todayStr) cls += ' today';
    const lbl = net ? `${toDecimal(net)}` : (e.arrivee ? '…' : '');
    return `<div class="week-day">
      <div class="week-day-name">${JOURS_COURT[d.getDay()]}</div>
      <div class="${cls}">${lbl}</div>
    </div>`;
  }).join('');

  document.getElementById('week-days').innerHTML = html;
  document.getElementById('week-hours').textContent = fmtHHMM(totalMin);
  const target = settings.weeklyHours*60;
  document.getElementById('week-target-label').textContent = fmtHHMM(target);
  const pct = Math.min(100,(totalMin/target)*100);
  const bar = document.getElementById('week-bar');
  bar.style.width      = pct+'%';
  bar.style.background = pct>=100 ? 'var(--success)' : 'var(--primary)';
}

// ═══ DATE EN-TÊTE ═══
function updateDateHeader() {
  const d = new Date();
  document.getElementById('date-today').textContent =
    `${JOURS_FULL[d.getDay()]} ${d.getDate()} ${MOIS_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

// ═══ HISTORIQUE ═══
function renderHistory() {
  const list    = document.getElementById('history-list');
  const entries = Object.entries(data).sort((a,b)=>b[0].localeCompare(a[0]));
  if (!entries.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><p>Aucun pointage enregistré</p></div>`;
    return;
  }
  list.innerHTML = entries.map(([date,e]) => {
    const d   = new Date(date+'T12:00:00');
    const net = calcNetMinutes(e.arrivee, e.depart, e.pauseMin !== undefined ? e.pauseMin : settings.pauseMin);
    const client  = [e.client,e.nomClient].filter(Boolean).join(' — ');
    const frais   = buildFraisChips(e);
    const typeChip = buildTypeChip(e.typeJournee);
    return `
    <div class="history-item" onclick="goToDate('${date}')">
      <div class="history-top">
        <div class="history-date-col">
          <span class="history-day-name">${JOURS_COURT[d.getDay()]}</span>
          <span class="history-day-num">${d.getDate()}</span>
          <span class="history-month">${MOIS_COURT[d.getMonth()]}</span>
        </div>
        <div class="history-middle">
          <div class="history-times">
            <span class="time-chip arrivee">${e.arrivee||'--:--'}</span>
            <span class="time-arrow">→</span>
            <span class="time-chip depart">${e.depart||'--:--'}</span>
            ${e.pauseMin ? `<span class="time-chip pause">-${e.pauseMin}min</span>` : ''}
          </div>
          ${client ? `<div class="history-client"><strong>${client}</strong>${e.chantier?' · '+e.chantier:''}</div>` : ''}
        </div>
        <div class="history-dur ${net?'':'incomplete'}">${net!==null?fmtHHMM(net):(e.arrivee?'…':'?')}</div>
      </div>
      ${(frais||typeChip)?`<div class="history-frais">${typeChip}${frais}</div>`:''}
    </div>`;
  }).join('');
}

function goToDate(date) {
  currentDate = date;
  fillFields(date);
  updateBanner();
  updateButtons();
  const d = new Date(date+'T12:00:00');
  document.getElementById('date-today').textContent =
    `${JOURS_FULL[d.getDay()]} ${d.getDate()} ${MOIS_FULL[d.getMonth()]} ${d.getFullYear()}`;
  document.querySelector('[data-page="accueil"]').click();
  showToast(`📅 ${JOURS_COURT[d.getDay()]} ${d.getDate()} ${MOIS_COURT[d.getMonth()]}`);
}

function buildTypeChip(type) {
  if (!type||type==='normal') return '';
  const labels = { 'conge':'🌴 Congé','sans-solde':'⛔ Sans solde','formation':'📚 Formation','maladie':'🤒 Maladie','ferie':'🎉 Férié','rtt':'🔵 RTT' };
  return `<span class="type-chip type-${type}">${labels[type]||type}</span>`;
}

function buildFraisChips(e) {
  const f = [];
  if (e.pTraj)       f.push(`P.Traj ×${e.pTraj}`);
  if (e.gTraj)       f.push(`G.Traj ×${e.gTraj}`);
  if (e.repas)       f.push(`Repas ×${e.repas}`);
  if (e.nuit)        f.push(`Nuit ×${e.nuit}`);
  if (e.deplacement) f.push(`Dépl. ×${e.deplacement}`);
  if (e.ticketResto) f.push(`T.Resto ×${e.ticketResto}`);
  if (e.vehicule)    f.push(`Véhicule ×${e.vehicule}`);
  return f.map(x=>`<span class="frais-chip">${x}</span>`).join('');
}

// ═══ STATS ═══
function renderStats() {
  const content   = document.getElementById('stats-content');
  const completed = Object.entries(data).filter(([,e])=>e.arrivee&&e.depart);
  if (completed.length<2) {
    content.innerHTML=`<div class="empty-state"><div class="empty-state-icon">📊</div><p>Pas encore assez de données</p></div>`;
    return;
  }
  const nets     = completed.map(([,e])=>calcNetMinutes(e.arrivee,e.depart,e.pauseMin!==undefined?e.pauseMin:settings.pauseMin)).filter(Boolean);
  const total    = nets.reduce((a,b)=>a+b,0);
  const avg      = Math.round(total/nets.length);
  const max      = Math.max(...nets);

  const tot = {pTraj:0,gTraj:0,repas:0,nuit:0,deplacement:0,ticketResto:0,vehicule:0};
  Object.values(data).forEach(e=>{
    tot.pTraj+=e.pTraj||0; tot.gTraj+=e.gTraj||0; tot.repas+=e.repas||0;
    tot.nuit+=e.nuit||0; tot.deplacement+=e.deplacement||0;
    tot.ticketResto+=e.ticketResto||0; tot.vehicule+=e.vehicule||0;
  });

  const byWeek={};
  completed.forEach(([date,e])=>{
    const d=new Date(date+'T12:00:00');
    const k=`S${getWeekNumber(d)}`;
    if(!byWeek[k])byWeek[k]=0;
    byWeek[k]+=calcNetMinutes(e.arrivee,e.depart,e.pauseMin!==undefined?e.pauseMin:settings.pauseMin)||0;
  });
  const weeks=Object.entries(byWeek).slice(-5);
  const maxW=Math.max(...weeks.map(([,v])=>v),settings.weeklyHours*60);

  const bars=weeks.map(([w,min])=>{
    const pct=(min/maxW)*100;
    const col=min>=settings.weeklyHours*60?'var(--success)':'var(--primary)';
    return `<div class="bar-col"><div class="bar-val">${fmtHHMM(min)}</div><div class="bar-fill" style="height:${pct}%;background:${col}"></div><div class="bar-week-label">${w}</div></div>`;
  }).join('');

  const fv=v=>v?v.toString().replace('.',','):'0';

  content.innerHTML=`
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value">${completed.length}</div><div class="stat-label">Jours pointés</div></div>
      <div class="stat-card"><div class="stat-value">${fmtHHMM(avg)}</div><div class="stat-label">Moyenne / jour</div></div>
      <div class="stat-card"><div class="stat-value">${fmtHHMM(total)}</div><div class="stat-label">Total cumulé</div></div>
      <div class="stat-card"><div class="stat-value">${fmtHHMM(max)}</div><div class="stat-label">Meilleure journée</div></div>
    </div>
    <div class="chart-card"><div class="chart-title">Heures nettes par semaine</div><div class="bar-chart">${bars}</div></div>
    <div class="chart-card"><div class="chart-title">Totaux frais & déplacements</div>
      <div class="frais-totals">
        <div class="frais-total-item"><span>Petit Trajet</span><strong>×${fv(tot.pTraj)}</strong></div>
        <div class="frais-total-item"><span>Grand Trajet</span><strong>×${fv(tot.gTraj)}</strong></div>
        <div class="frais-total-item"><span>Forfait Repas</span><strong>×${fv(tot.repas)}</strong></div>
        <div class="frais-total-item"><span>Forfait Nuit</span><strong>×${fv(tot.nuit)}</strong></div>
        <div class="frais-total-item"><span>Déplacement</span><strong>×${fv(tot.deplacement)}</strong></div>
        <div class="frais-total-item"><span>Ticket Resto</span><strong>×${fv(tot.ticketResto)}</strong></div>
        <div class="frais-total-item"><span>Véhicule</span><strong>×${fv(tot.vehicule)}</strong></div>
      </div>
    </div>`;
}

// ═══ PARAMÈTRES ═══
function renderSettingsPage() {
  document.getElementById('set-arrivee').value  = settings.heureArrivee;
  document.getElementById('set-depart').value   = settings.heureDepart;
  document.getElementById('set-pause').value    = settings.pauseMin;
  document.getElementById('set-weekly').value   = settings.weeklyHours;
  document.getElementById('shortcut-matin').textContent = settings.heureArrivee;
  document.getElementById('shortcut-soir').textContent  = settings.heureDepart;
}

function saveSettings() {
  settings.heureArrivee = document.getElementById('set-arrivee').value;
  settings.heureDepart  = document.getElementById('set-depart').value;
  settings.pauseMin     = parseInt(document.getElementById('set-pause').value)||0;
  settings.weeklyHours  = parseInt(document.getElementById('set-weekly').value)||35;
  savePersistSettings();
  showToast('✅ Paramètres enregistrés !');
  updateWeek();
}

// ═══ EXPORT CSV — FORMAT FEUILLE D'HEURES ═══
function exportCSV() {
  const allDates = Object.keys(data).sort();
  if (!allDates.length) { showToast('⚠️ Aucune donnée à exporter'); return; }

  // Grouper par semaine
  const weekGroups = {};
  allDates.forEach(date => {
    const d = new Date(date + 'T12:00:00');
    const mon = new Date(d);
    mon.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
    const k = mon.toISOString().split('T')[0];
    if (!weekGroups[k]) weekGroups[k] = {};
    weekGroups[k][date] = data[date];
  });

  const S = ';';
  const fv = v => (v || 0).toString().replace('.', ',');
  const fd = v => v ? toDecimal(v).toString().replace('.', ',') : '';
  let csv = '';

  // Récupérer nom/prénom depuis le premier client sauvegardé
  const nom    = savedClients[0]?.nomClient || '';
  const prenom = savedClients[0]?.client    || '';

  Object.entries(weekGroups).sort().forEach(([monDate, wData]) => {
    const monD   = new Date(monDate + 'T12:00:00');
    const semNum = getWeekNumber(monD);
    const moisAn = `${MOIS_FULL[monD.getMonth()]}-${monD.getFullYear()}`;

    // En-tête
    csv += `${nom}${S}${prenom}${S}${S}${moisAn}\n`;
    csv += `\n`;
    csv += `Semaine${S}${S}${S}${S}${semNum}\n`;
    csv += `Date${S}Client${S}${S}N° Chantier${S}${S}Temps${S}${S}${S}${S}${S}${S}\n`;
    csv += `${S}${S}${S}${S}${S}Travail${S}P.Traj${S}G.Traj${S}${S}${S}${S}\n`;

    let tTravail=0, tPTraj=0, tGTraj=0, tRepas=0, tNuit=0, tDepl=0, tTicket=0;

    getWeekDates7(monDate).forEach(date => {
      const e  = wData[date] || {};
      const dd = new Date(date + 'T12:00:00');
      const pause = e.pauseMin !== undefined ? e.pauseMin : settings.pauseMin;
      const net   = calcNetMinutes(e.arrivee, e.depart, pause);
      const travH = fd(net);
      if (net) tTravail += net;
      tPTraj  += e.pTraj       || 0;
      tGTraj  += e.gTraj       || 0;
      tRepas  += e.repas       || 0;
      tNuit   += e.nuit        || 0;
      tDepl   += e.deplacement || 0;
      tTicket += e.ticketResto || 0;

      const typeLabel = {
        'conge':'congé','sans-solde':'sans solde',
        'formation':'formation','maladie':'maladie',
        'ferie':'férié','rtt':'RTT'
      }[e.typeJournee || ''] || '';

      // Ligne principale du jour : nom du jour + client + heures + Forfait Repas
      csv += `${JOURS_FULL[dd.getDay()]}${S}${e.client||typeLabel}${S}${e.nomClient||''}${S}${e.chantier||''}${S}${S}${travH}${S}${fv(e.pTraj)}${S}${fv(e.gTraj)}${S}${S}Forfait${S}${fv(e.repas)}${S}Repas\n`;
      // Ligne Nuit
      csv += `${S}${S}${S}${S}${S}${S}${S}${S}${S}${S}${fv(e.nuit)}${S}Nuit\n`;
      // Ligne Déplacement
      csv += `${S}${S}${S}${S}${S}${S}${S}${S}${S}${S}${fv(e.deplacement)}${S}Déplacement\n`;
      // Ligne Ticket Resto (Autre)
      csv += `${S}${S}${S}${S}${S}${S}${S}${S}${S}Autre${S}${fv(e.ticketResto)}${S}Ticket Resto\n`;
      // Ligne Véhicule
      csv += `${S}${S}${S}${S}${S}${S}${S}${S}${S}${S}${fv(e.vehicule)}${S}Véhicule\n`;
      // Ligne date
      csv += `${formatDateFR(dd)}\n`;
      csv += `\n`;
    });

    // Totaux
    csv += `${S}${S}${S}${S}Total  Petit Trajet${S}${S}${S}${S}${S}${S}${S}${fv(tPTraj)}\n`;
    csv += `${S}${S}${S}${S}Total  Grand trajet${S}${S}${S}${S}${S}${S}${S}${fv(tGTraj)}\n`;
    csv += `${S}${S}${S}${S}Total  Heures${S}${S}${S}${S}${S}${S}${S}${fd(tTravail)}\n`;
    csv += `${S}${S}${S}${S}Total Forfait Repas${S}${S}${S}${S}${S}${S}${S}${fv(tRepas)}\n`;
    csv += `${S}${S}${S}${S}Total Forfait Nuit${S}${S}${S}${S}${S}${S}${S}${fv(tNuit)}\n`;
    csv += `${S}${S}${S}${S}Total Déplacement${S}${S}${S}${S}${S}${S}${S}${fv(tDepl)}\n`;
    csv += `${S}${S}${S}${S}Total Ticket Restaurant${S}${S}${S}${S}${S}${S}${S}${fv(tTicket)}\n`;
    csv += `\n\n`;
  });

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `feuille_heures_${todayKey()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 Export téléchargé !');
}

// ═══ EFFACER ═══
function clearAllData() {
  if (confirm('Effacer tous les pointages ? Irréversible.')) {
    data={}; saveData(); fillFields(currentDate);
    updateBanner(); updateButtons(); updateWeek();
    showToast('🗑 Données effacées');
  }
}

// ═══ INIT ═══
document.addEventListener('DOMContentLoaded', () => {
  const toast = document.createElement('div');
  toast.id='toast'; toast.className='toast';
  document.body.appendChild(toast);

  loadData();
  updateDateHeader();
  fillFields(currentDate);
  renderFavorisChips();
  updateDatalistClients();
  updateBanner();
  updateButtons();
  updateWeek();

  // Refresh live toutes les 30s
  setInterval(() => {
    const key = currentDate;
    if (data[key]?.arrivee && !data[key]?.depart) updateBanner();
  }, 30000);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }
});
