// ═══════════════════════════════════════════════
//  CONSTANTES
// ═══════════════════════════════════════════════
const DATA_KEY     = 'pointage_data';
const SETTINGS_KEY = 'pointage_settings';
const CLIENTS_KEY  = 'pointage_clients';

const JOURS_COURT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const JOURS_FULL  = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const MOIS_COURT  = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc'];
const MOIS_FULL   = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

// ═══════════════════════════════════════════════
//  ÉTAT GLOBAL
// ═══════════════════════════════════════════════
let data         = {};
let savedClients = [];
let settings     = {
  heureArrivee : '08:00',
  heureDepart  : '17:00',
  pauseMin     : 30,
  weeklyHours  : 39,      // Convention BTP : 39h
  tauxHoraire  : 0,
  seuilHS25    : 39,      // BTP : HS +25% après 39h
  seuilHS50    : 43,      // BTP : HS +50% après 43h
};
let currentDate = todayKey();

// ═══════════════════════════════════════════════
//  PERSISTANCE
// ═══════════════════════════════════════════════
function loadData() {
  const d = localStorage.getItem(DATA_KEY);     if (d) data = JSON.parse(d);
  const s = localStorage.getItem(SETTINGS_KEY); if (s) settings = { ...settings, ...JSON.parse(s) };
  const c = localStorage.getItem(CLIENTS_KEY);  if (c) savedClients = JSON.parse(c);
  // Migration : ancienne structure → missions array
  Object.keys(data).forEach(date => {
    const e = data[date];
    if (!e.missions) {
      e.missions = [{
        client: e.client || null, nomClient: e.nomClient || null,
        chantier: e.chantier || null, heures: e.heures || null,
        pTraj: e.pTraj || 0, gTraj: e.gTraj || 0
      }];
    }
  });
}
function saveData()     { localStorage.setItem(DATA_KEY,     JSON.stringify(data));         }
function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));     }
function saveClients()  { localStorage.setItem(CLIENTS_KEY,  JSON.stringify(savedClients)); }

// ═══════════════════════════════════════════════
//  HELPERS TEMPS
// ═══════════════════════════════════════════════
function todayKey() { return new Date().toISOString().split('T')[0]; }

function calcNetMinutes(arrivee, depart, pauseMin) {
  if (!arrivee || !depart) return null;
  const [ah,am] = arrivee.split(':').map(Number);
  const [dh,dm] = depart.split(':').map(Number);
  const raw = (dh*60+dm)-(ah*60+am);
  if (raw <= 0) return null;
  return Math.max(0, raw-(pauseMin||0));
}

function fmtHHMM(min) {
  if (min === null || min === undefined || isNaN(min)) return '--h--';
  return `${Math.floor(min/60)}h${String(min%60).padStart(2,'0')}`;
}

function toDecimal(min) { return Math.round((min/60)*4)/4; }

function getWeekMondayDates(refDate) {
  const d = refDate ? new Date(refDate+'T12:00:00') : new Date();
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate()-(day===0?6:day-1));
  return Array.from({length:5},(_,i)=>{
    const dd=new Date(mon); dd.setDate(mon.getDate()+i);
    return dd.toISOString().split('T')[0];
  });
}

function getWeekDates7(mondayDate) {
  const mon = new Date(mondayDate+'T12:00:00');
  return Array.from({length:7},(_,i)=>{
    const dd=new Date(mon); dd.setDate(mon.getDate()+i);
    return dd.toISOString().split('T')[0];
  });
}

function getWeekNumber(d) {
  const jan=new Date(d.getFullYear(),0,1);
  return Math.ceil((((d-jan)/86400000)+jan.getDay()+1)/7);
}

function formatDateFR(d) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function getEntryPause(e) {
  return e.pauseMin !== undefined ? e.pauseMin : settings.pauseMin;
}

// ═══════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════
function showToast(msg) {
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2500);
}

// ═══════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════
function showPage(pageId, btn) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+pageId).classList.add('active');
  btn.classList.add('active');
  if (pageId==='historique') renderHistory();
  if (pageId==='stats')      renderStats();
  if (pageId==='settings')   renderSettingsPage();
}

// ═══════════════════════════════════════════════
//  POINTAGE RAPIDE
// ═══════════════════════════════════════════════
function pointer(type) {
  const heure = new Date().toTimeString().slice(0,5);
  const key   = currentDate;
  if (!data[key]) data[key] = { pauseMin:settings.pauseMin, typeJournee:'normal', missions:[newMissionObj()] };

  if (type==='arrivee') {
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
  updateBanner(); updateButtons(); updateWeek();
}

// ═══════════════════════════════════════════════
//  MISSIONS (PLUSIEURS CHANTIERS)
// ═══════════════════════════════════════════════
function newMissionObj() {
  return { client:null, nomClient:null, chantier:null, heures:null, pTraj:0, gTraj:0 };
}

let missionCount = 0;

function addMission(data_mission) {
  missionCount++;
  const m   = data_mission || newMissionObj();
  const idx = missionCount;
  const container = document.getElementById('missions-container');
  const card = document.createElement('div');
  card.className = 'mission-card';
  card.dataset.idx = idx;
  card.innerHTML = `
    <div class="mission-header">
      <span class="mission-num">Chantier ${container.children.length+1}</span>
      <button class="mission-delete" onclick="removeMission(this)">✕</button>
    </div>
    <div class="favoris-liste" id="fav-${idx}"></div>
    <div class="field-row">
      <div class="field">
        <label>Code client</label>
        <input type="text" class="m-client" list="list-client" placeholder="AI"
          value="${m.client||''}" oninput="suggestClientMission(this)" onchange="autoSave()">
      </div>
      <div class="field flex2">
        <label>Nom client</label>
        <input type="text" class="m-nom-client" list="list-nom-client" placeholder="BOUTIN"
          value="${m.nomClient||''}" onchange="autoSave()">
      </div>
    </div>
    <div class="field-row">
      <div class="field flex2">
        <label>N° Chantier / Affaire</label>
        <input type="text" class="m-chantier" list="list-chantier" placeholder="25-6028"
          value="${m.chantier||''}" oninput="onChantierInputMission(this)" onchange="autoSave()">
      </div>
      <div class="field">
        <label>Heures</label>
        <input type="number" class="m-heures" min="0" step="0.5" placeholder="0"
          value="${m.heures||''}" onchange="autoSave()">
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>P.Traj</label>
        <input type="number" class="m-ptraj" min="0" step="1" placeholder="0"
          value="${m.pTraj||''}" onchange="autoSave()">
      </div>
      <div class="field">
        <label>G.Traj</label>
        <input type="number" class="m-gtraj" min="0" step="1" placeholder="0"
          value="${m.gTraj||''}" onchange="autoSave()">
      </div>
      <div class="field">
        <label>&nbsp;</label>
        <button class="btn-save-client-sm" onclick="saveClientFavoriMission(this)">💾</button>
      </div>
    </div>`;
  container.appendChild(card);
  renderFavorisMission(idx);
  renumberMissions();
}

function removeMission(btn) {
  const card = btn.closest('.mission-card');
  if (document.querySelectorAll('.mission-card').length <= 1) {
    showToast('⚠️ Il faut au moins un chantier'); return;
  }
  card.remove();
  renumberMissions();
  autoSave();
}

function renumberMissions() {
  document.querySelectorAll('.mission-card').forEach((card,i) => {
    card.querySelector('.mission-num').textContent = `Chantier ${i+1}`;
  });
}

function getMissions() {
  return Array.from(document.querySelectorAll('.mission-card')).map(card => ({
    client:    card.querySelector('.m-client').value.trim().toUpperCase()    || null,
    nomClient: card.querySelector('.m-nom-client').value.trim().toUpperCase() || null,
    chantier:  card.querySelector('.m-chantier').value.trim()                || null,
    heures:    parseFloat(card.querySelector('.m-heures').value)              || null,
    pTraj:     parseFloat(card.querySelector('.m-ptraj').value)               || 0,
    gTraj:     parseFloat(card.querySelector('.m-gtraj').value)               || 0,
  }));
}

// ═══════════════════════════════════════════════
//  CLIENTS FAVORIS
// ═══════════════════════════════════════════════
function addClientToFavoris(client, nomClient, chantier) {
  if (!client && !nomClient && !chantier) return false;
  const exists = savedClients.find(c =>
    c.client===client && c.nomClient===nomClient && c.chantier===chantier);
  if (exists) return false;
  savedClients.unshift({client, nomClient, chantier});
  if (savedClients.length>30) savedClients.pop();
  saveClients();
  updateDatalistClients();
  renderAllFavoris();
  return true;
}

function deleteClient(index) {
  savedClients.splice(index,1);
  saveClients();
  updateDatalistClients();
  renderAllFavoris();
  showToast('🗑 Client supprimé');
}

function renderFavorisMission(idx) {
  const container = document.getElementById('fav-'+idx);
  if (!container || !savedClients.length) return;
  container.innerHTML = savedClients.map((c,i)=>{
    const label=[c.client,c.nomClient,c.chantier].filter(Boolean).join(' · ');
    return `<div class="favori-chip">
      <span onclick="selectClientMission('${idx}',${i})">${label}</span>
      <button class="favori-delete" onclick="deleteClient(${i})">✕</button>
    </div>`;
  }).join('');
}

function renderAllFavoris() {
  document.querySelectorAll('.mission-card').forEach(card=>{
    const idx=card.dataset.idx;
    renderFavorisMission(idx);
  });
}

function selectClientMission(cardIdx, clientIdx) {
  const c    = savedClients[clientIdx];
  const card = document.querySelector(`.mission-card[data-idx="${cardIdx}"]`);
  if (!c||!card) return;
  card.querySelector('.m-client').value     = c.client    ||'';
  card.querySelector('.m-nom-client').value = c.nomClient ||'';
  card.querySelector('.m-chantier').value   = c.chantier  ||'';
  autoSave();
  showToast(`✅ ${[c.client,c.nomClient,c.chantier].filter(Boolean).join(' · ')}`);
}

function saveClientFavoriMission(btn) {
  const card      = btn.closest('.mission-card');
  const client    = card.querySelector('.m-client').value.trim().toUpperCase();
  const nomClient = card.querySelector('.m-nom-client').value.trim().toUpperCase();
  const chantier  = card.querySelector('.m-chantier').value.trim();
  if (!client && !nomClient && !chantier) { showToast('⚠️ Remplis au moins un champ'); return; }
  const added = addClientToFavoris(client, nomClient, chantier);
  showToast(added ? '✅ Client enregistré !' : 'ℹ️ Déjà dans les favoris');
}

function suggestClientMission(input) {
  const val  = input.value.trim().toUpperCase();
  const card = input.closest('.mission-card');
  const match = savedClients.find(c=>c.client===val);
  if (match && !card.querySelector('.m-nom-client').value) {
    card.querySelector('.m-nom-client').value = match.nomClient||'';
    if (!card.querySelector('.m-chantier').value)
      card.querySelector('.m-chantier').value = match.chantier||'';
  }
}

function onChantierInputMission(input) {
  const val   = input.value.trim();
  const card  = input.closest('.mission-card');
  const match = savedClients.find(c=>c.chantier===val);
  if (match) {
    if (!card.querySelector('.m-client').value)
      card.querySelector('.m-client').value = match.client||'';
    if (!card.querySelector('.m-nom-client').value)
      card.querySelector('.m-nom-client').value = match.nomClient||'';
  }
}

function updateDatalistClients() {
  const uniq = arr => [...new Set(arr.filter(Boolean))];
  document.getElementById('list-client').innerHTML =
    uniq(savedClients.map(c=>c.client)).map(v=>`<option value="${v}">`).join('');
  document.getElementById('list-nom-client').innerHTML =
    uniq(savedClients.map(c=>c.nomClient)).map(v=>`<option value="${v}">`).join('');
  document.getElementById('list-chantier').innerHTML =
    uniq(savedClients.map(c=>c.chantier)).map(v=>`<option value="${v}">`).join('');
}

// ═══════════════════════════════════════════════
//  AUTO-SAVE
// ═══════════════════════════════════════════════
function autoSave() {
  const key = currentDate;
  if (!data[key]) data[key] = {};
  const e = data[key];
  e.arrivee     = document.getElementById('f-arrivee').value    ||null;
  e.depart      = document.getElementById('f-depart').value     ||null;
  e.pauseMin    = parseInt(document.getElementById('f-pause').value)||0;
  e.typeJournee = document.getElementById('f-type').value;
  e.repas       = parseFloat(document.getElementById('f-repas').value)       ||0;
  e.nuit        = parseFloat(document.getElementById('f-nuit').value)        ||0;
  e.deplacement = parseFloat(document.getElementById('f-deplacement').value) ||0;
  e.ticketResto = parseFloat(document.getElementById('f-ticket').value)      ||0;
  e.vehicule    = parseFloat(document.getElementById('f-vehicule').value)    ||0;
  e.missions    = getMissions();
  e.note        = document.getElementById('f-note').value || null;
  saveData();
  updateBanner(); updateButtons(); updateWeek();
}

// ═══════════════════════════════════════════════
//  REMPLIR LES CHAMPS
// ═══════════════════════════════════════════════
function fillFields(date) {
  const e = data[date] || {};
  document.getElementById('f-arrivee').value     = e.arrivee    ||'';
  document.getElementById('f-depart').value      = e.depart     ||'';
  document.getElementById('f-pause').value       = e.pauseMin   !== undefined ? e.pauseMin : settings.pauseMin;
  document.getElementById('f-type').value        = e.typeJournee||'normal';
  document.getElementById('f-repas').value       = e.repas      ||'';
  document.getElementById('f-nuit').value        = e.nuit       ||'';
  document.getElementById('f-deplacement').value = e.deplacement||'';
  document.getElementById('f-ticket').value      = e.ticketResto||'';
  document.getElementById('f-vehicule').value    = e.vehicule   ||'';
  document.getElementById('f-note').value        = e.note       ||'';

  // Missions
  const container = document.getElementById('missions-container');
  container.innerHTML = '';
  missionCount = 0;
  const missions = e.missions && e.missions.length ? e.missions : [newMissionObj()];
  missions.forEach(m => addMission(m));
}

// ═══════════════════════════════════════════════
//  BANNIÈRE TEMPS NET
// ═══════════════════════════════════════════════
function updateBanner() {
  const key     = currentDate;
  const e       = data[key] || {};
  const arrivee = document.getElementById('f-arrivee').value || e.arrivee;
  const depart  = document.getElementById('f-depart').value  || e.depart;
  const pause   = parseInt(document.getElementById('f-pause').value) || getEntryPause(e);
  const banner  = document.getElementById('net-banner');
  const net     = calcNetMinutes(arrivee, depart, pause);

  // Total heures saisies dans les missions
  const missionTotal = getMissions().reduce((s,m)=>s+(m.heures||0),0);
  const missionStr   = missionTotal ? ` · réparti: ${missionTotal}h` : '';

  if (depart || e.depart) {
    banner.className='net-banner done';
    document.getElementById('net-icon').textContent='✅';
    document.getElementById('net-label').textContent='Temps net :';
    document.getElementById('net-value').textContent=net!==null?`${fmtHHMM(net)} (${toDecimal(net)}h)${missionStr}`:'--';
  } else if (arrivee || e.arrivee) {
    banner.className='net-banner working';
    document.getElementById('net-icon').textContent='💼';
    const now=new Date();
    const [ah,am]=(arrivee||'00:00').split(':').map(Number);
    const elapsed=Math.max(0,(now.getHours()*60+now.getMinutes())-(ah*60+am)-pause);
    document.getElementById('net-label').textContent='En cours :';
    document.getElementById('net-value').textContent=`${fmtHHMM(elapsed)}${missionStr}`;
  } else {
    const isWE=new Date().getDay()===0||new Date().getDay()===6;
    banner.className='net-banner';
    document.getElementById('net-icon').textContent=isWE?'😎':'⏰';
    document.getElementById('net-label').textContent=isWE?'Bon week-end !':'Non pointé';
    document.getElementById('net-value').textContent='';
  }
}

function updateButtons() {
  const e=data[currentDate]||{};
  document.getElementById('btn-arrive').disabled=!!e.arrivee;
  document.getElementById('btn-depart').disabled=!e.arrivee||!!e.depart;
  document.getElementById('btn-arrive-sub').textContent=e.arrivee||'Pointer';
  document.getElementById('btn-depart-sub').textContent=e.depart ||'Pointer';
}

// ═══════════════════════════════════════════════
//  SEMAINE
// ═══════════════════════════════════════════════
function updateWeek() {
  const weekDates=getWeekMondayDates();
  const todayStr=todayKey();
  let totalMin=0;
  const html=weekDates.map(date=>{
    const e=data[date]||{};
    const net=calcNetMinutes(e.arrivee,e.depart,getEntryPause(e));
    if(net)totalMin+=net;
    const d=new Date(date+'T12:00:00');
    let cls='week-day-dot';
    if(net)cls+=' done'; else if(e.arrivee)cls+=' partial';
    if(date===todayStr)cls+=' today';
    return `<div class="week-day">
      <div class="week-day-name">${JOURS_COURT[d.getDay()]}</div>
      <div class="${cls}">${net?toDecimal(net):(e.arrivee?'…':'')}</div>
    </div>`;
  }).join('');
  document.getElementById('week-days').innerHTML=html;
  document.getElementById('week-hours').textContent=fmtHHMM(totalMin);
  const target=settings.weeklyHours*60;
  document.getElementById('week-target-label').textContent=fmtHHMM(target);
  const pct=Math.min(100,(totalMin/target)*100);
  const bar=document.getElementById('week-bar');
  bar.style.width=pct+'%';
  bar.style.background=pct>=100?'var(--success)':'var(--primary)';
}

// ═══════════════════════════════════════════════
//  DATE EN-TÊTE
// ═══════════════════════════════════════════════
function updateDateHeader() {
  const d=new Date();
  document.getElementById('date-today').textContent=
    `${JOURS_FULL[d.getDay()]} ${d.getDate()} ${MOIS_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

// ═══════════════════════════════════════════════
//  HISTORIQUE
// ═══════════════════════════════════════════════
let historyView = 'calendrier';

function toggleHistoryView(view) {
  historyView = view;
  document.getElementById('btn-view-cal').classList.toggle('active',  view==='calendrier');
  document.getElementById('btn-view-liste').classList.toggle('active', view==='liste');
  renderHistory();
}

function historyPrevMonth() {
  if(historyMois===0){historyMois=11;historyAnnee--;}else historyMois--;
  renderHistory();
}
function historyNextMonth() {
  if(historyMois===11){historyMois=0;historyAnnee++;}else historyMois++;
  renderHistory();
}

function renderHistory() {
  document.getElementById('history-month-label').textContent =
    `${MOIS_FULL[historyMois]} ${historyAnnee}`;
  if(historyView==='calendrier') renderCalendar();
  else renderHistoryList();
}

// ── Vue Calendrier ────────────────────────────
function renderCalendar() {
  const container = document.getElementById('history-list');
  const today = todayKey();

  // Bornes du mois
  const firstDay = new Date(historyAnnee, historyMois, 1);
  const lastDay  = new Date(historyAnnee, historyMois+1, 0);

  // Lundi de la première semaine
  const startDow  = firstDay.getDay();
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate()-(startDow===0?6:startDow-1));

  // Dimanche de la dernière semaine
  const endDow  = lastDay.getDay();
  const endDate = new Date(lastDay);
  endDate.setDate(lastDay.getDate()+(endDow===0?0:7-endDow));

  const dayNames = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  let html = '<div class="cal-grid">';
  html += dayNames.map(d=>`<div class="cal-head">${d}</div>`).join('');

  let cur = new Date(startDate);
  while(cur <= endDate) {
    const dateStr = cur.toISOString().split('T')[0];
    const e = data[dateStr] || {};
    const isCurMonth = cur.getMonth()===historyMois && cur.getFullYear()===historyAnnee;
    const isToday    = dateStr===today;
    const isWE       = cur.getDay()===0||cur.getDay()===6;
    const net        = calcNetMinutes(e.arrivee,e.depart,getEntryPause(e));

    let cls = 'cal-day';
    if(!isCurMonth) cls += ' cal-other';
    if(isToday)     cls += ' cal-today';
    if(isWE && !net && !(e.typeJournee && e.typeJournee!=='normal')) cls += ' cal-we';

    if(net)                                             cls += ' cal-worked';
    else if(e.arrivee)                                  cls += ' cal-partial';
    else if(e.typeJournee && e.typeJournee!=='normal')  cls += ` cal-abs cal-abs-${e.typeJournee}`;

    const missions = isCurMonth ? (e.missions||[]).filter(m=>m.chantier||m.client) : [];
    const mHtml = missions.slice(0,2).map(m=>{
      const lbl = m.chantier || m.client || '';
      return `<div class="cal-chip">${lbl}</div>`;
    }).join('');
    const moreHtml = missions.length>2 ? `<div class="cal-more">+${missions.length-2}</div>` : '';
    const durHtml  = net&&isCurMonth ? `<div class="cal-dur">${toDecimal(net)}h</div>` : '';
    const typeIcon = !net&&e.typeJournee&&e.typeJournee!=='normal'&&isCurMonth ?
      ({'conge':'🌴','sans-solde':'⛔','formation':'📚','maladie':'🤒','ferie':'🎉','rtt':'🔵'}[e.typeJournee]||'') : '';

    html += `<div class="${cls}"${isCurMonth?` onclick="goToDate('${dateStr}')"`:''}>
      <div class="cal-num">${cur.getDate()}</div>
      ${typeIcon?`<div class="cal-type-icon">${typeIcon}</div>`:''}
      ${mHtml}${moreHtml}
      ${durHtml}
    </div>`;

    cur.setDate(cur.getDate()+1);
  }
  html += '</div>';

  // Résumé mensuel
  const mEntries = Object.entries(data).filter(([d])=>{
    const dd=new Date(d+'T12:00:00'); return dd.getMonth()===historyMois&&dd.getFullYear()===historyAnnee;
  });
  const worked   = mEntries.filter(([,e])=>e.arrivee&&e.depart).length;
  const totalMin = mEntries.reduce((s,[,e])=>s+(calcNetMinutes(e.arrivee,e.depart,getEntryPause(e))||0),0);

  if(worked>0) html += `<div class="cal-summary">
    <span>📅 ${worked} jour${worked>1?'s':''} pointé${worked>1?'s':''}</span>
    <span>⏱ ${fmtHHMM(totalMin)} total</span>
  </div>`;

  html += `<div class="cal-legend">
    <span class="cal-legend-item"><i class="cld cld-worked"></i>Pointé</span>
    <span class="cal-legend-item"><i class="cld cld-partial"></i>En cours</span>
    <span class="cal-legend-item"><i class="cld cld-abs"></i>Absence</span>
    <span class="cal-legend-item"><i class="cld cld-we"></i>Week-end</span>
  </div>`;

  container.innerHTML = html;
}

// ── Vue Liste ─────────────────────────────────
function renderHistoryList() {
  const list = document.getElementById('history-list');

  const entries = Object.entries(data)
    .filter(([date])=>{
      const d=new Date(date+'T12:00:00');
      return d.getMonth()===historyMois&&d.getFullYear()===historyAnnee;
    })
    .sort((a,b)=>b[0].localeCompare(a[0]));

  if(!entries.length){
    list.innerHTML=`<div class="empty-state"><div class="empty-state-icon">📋</div><p>Aucun pointage ce mois</p></div>`;
    return;
  }

  const byWeek={};
  entries.forEach(([date,e])=>{
    const d=new Date(date+'T12:00:00');
    const mon=new Date(d); mon.setDate(d.getDate()-(d.getDay()===0?6:d.getDay()-1));
    const wk=mon.toISOString().split('T')[0];
    if(!byWeek[wk])byWeek[wk]=[];
    byWeek[wk].push([date,e]);
  });

  let html='';
  Object.entries(byWeek).sort((a,b)=>b[0].localeCompare(a[0])).forEach(([monDate,wEntries])=>{
    let weekMin=0;
    wEntries.forEach(([,e])=>{ const net=calcNetMinutes(e.arrivee,e.depart,getEntryPause(e)); if(net)weekMin+=net; });
    const mon=new Date(monDate+'T12:00:00');
    const sun=new Date(mon); sun.setDate(mon.getDate()+6);
    html+=`<div class="week-group-header">
      <span>Sem. ${getWeekNumber(mon)} · ${mon.getDate()}/${mon.getMonth()+1} – ${sun.getDate()}/${sun.getMonth()+1}</span>
      <span class="week-group-total">${fmtHHMM(weekMin)}</span>
    </div>`;
    wEntries.forEach(([date,e])=>{
      const d=new Date(date+'T12:00:00');
      const net=calcNetMinutes(e.arrivee,e.depart,getEntryPause(e));
      const mHtml=(e.missions||[]).filter(m=>m.client||m.chantier).map(m=>{
        const lbl=[m.client,m.nomClient,m.chantier].filter(Boolean).join(' · ');
        const h=m.heures?` — ${m.heures}h`:'';
        return `<div class="history-mission">${lbl}${h}</div>`;
      }).join('');
      const fraisHtml=buildFraisChips(e);
      const typeChip=buildTypeChip(e.typeJournee);
      const noteHtml=e.note?`<div class="history-note">📝 ${e.note}</div>`:'';
      html+=`
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
              ${e.pauseMin?`<span class="time-chip pause">-${e.pauseMin}min</span>`:''}
            </div>
            ${mHtml}${noteHtml}
          </div>
          <div class="history-dur ${net?'':'incomplete'}">${net!==null?fmtHHMM(net):(e.arrivee?'…':'?')}</div>
        </div>
        ${(fraisHtml||typeChip)?`<div class="history-frais">${typeChip}${fraisHtml}</div>`:''}
      </div>`;
    });
  });
  list.innerHTML=html;
}

function goToDate(date) {
  currentDate = date;
  fillFields(date);
  updateBanner(); updateButtons();
  const d = new Date(date+'T12:00:00');
  document.getElementById('date-today').textContent =
    `${JOURS_FULL[d.getDay()]} ${d.getDate()} ${MOIS_FULL[d.getMonth()]} ${d.getFullYear()}`;
  const pastBanner = document.getElementById('past-date-banner');
  pastBanner.style.display = date !== todayKey() ? 'flex' : 'none';
  document.querySelector('[data-page="accueil"]').click();
  showToast(`📅 ${JOURS_FULL[d.getDay()]} ${d.getDate()} ${MOIS_COURT[d.getMonth()]}`);
}

function goToToday() {
  currentDate = todayKey();
  fillFields(currentDate);
  updateBanner(); updateButtons(); updateWeek();
  const d = new Date();
  document.getElementById('date-today').textContent =
    `${JOURS_FULL[d.getDay()]} ${d.getDate()} ${MOIS_FULL[d.getMonth()]} ${d.getFullYear()}`;
  document.getElementById('past-date-banner').style.display = 'none';
  showToast('📅 Retour à aujourd\'hui');
}

function buildTypeChip(type) {
  if(!type||type==='normal')return'';
  const labels={'conge':'🌴 Congé','sans-solde':'⛔ Sans solde','formation':'📚 Formation','maladie':'🤒 Maladie','ferie':'🎉 Férié','rtt':'🔵 RTT'};
  return `<span class="type-chip type-${type}">${labels[type]||type}</span>`;
}
function buildFraisChips(e) {
  const f=[];
  if(e.repas)       f.push(`Repas ×${e.repas}`);
  if(e.nuit)        f.push(`Nuit ×${e.nuit}`);
  if(e.deplacement) f.push(`Dépl. ×${e.deplacement}`);
  if(e.ticketResto) f.push(`T.Resto ×${e.ticketResto}`);
  if(e.vehicule)    f.push(`Véhicule ×${e.vehicule}`);
  // Trajets depuis missions
  const pT=((e.missions||[]).reduce((s,m)=>s+(m.pTraj||0),0));
  const gT=((e.missions||[]).reduce((s,m)=>s+(m.gTraj||0),0));
  if(pT) f.push(`P.Traj ×${pT}`);
  if(gT) f.push(`G.Traj ×${gT}`);
  return f.map(x=>`<span class="frais-chip">${x}</span>`).join('');
}

// ═══════════════════════════════════════════════
//  STATS & SALAIRE
// ═══════════════════════════════════════════════
let statsMois  = new Date().getMonth();
let statsAnnee = new Date().getFullYear();
let historyMois  = new Date().getMonth();
let historyAnnee = new Date().getFullYear();

function calcSalaireMois(year, month) {
  // Grouper les heures par semaine ISO
  const semaines = {};
  Object.entries(data).forEach(([date,e])=>{
    const d=new Date(date+'T12:00:00');
    if(d.getFullYear()!==year||d.getMonth()!==month) return;
    const wk=`${year}-S${String(getWeekNumber(d)).padStart(2,'0')}`;
    if(!semaines[wk])semaines[wk]=0;
    const net=calcNetMinutes(e.arrivee,e.depart,getEntryPause(e));
    if(net)semaines[wk]+=net/60;
  });

  let hNormal=0, hHS25=0, hHS50=0;
  Object.values(semaines).forEach(h=>{
    hNormal += Math.min(h, settings.seuilHS25);
    hHS25   += Math.max(0, Math.min(h-settings.seuilHS25, settings.seuilHS50-settings.seuilHS25));
    hHS50   += Math.max(0, h-settings.seuilHS50);
  });

  const rate   = settings.tauxHoraire||0;
  const base   = hNormal*rate;
  const hs25   = hHS25*rate*1.25;
  const hs50   = hHS50*rate*1.50;
  const total  = base+hs25+hs50;
  const totalH = hNormal+hHS25+hHS50;

  return {hNormal, hHS25, hHS50, totalH, base, hs25, hs50, total, semaines};
}

// ─── Helpers graphiques ───────────────────────
function fmtH(h) {
  if(!h) return '0h00';
  return `${Math.floor(h)}h${String(Math.round((h%1)*60)).padStart(2,'0')}`;
}

function svgBars(items, targetH) {
  // items = [{label, value (minutes), color?}]
  if (!items.length) return '';
  const W=320, H=110, pad=10, bottom=22, barGap=4;
  const maxVal = Math.max(...items.map(i=>i.value), targetH*60||1);
  const bw = (W - pad*2) / items.length - barGap;
  const targetY = H - bottom - (targetH*60/maxVal)*(H-bottom-8);

  const bars = items.map((item,i)=>{
    const x = pad + i*(bw+barGap);
    const bh = Math.max(2, (item.value/maxVal)*(H-bottom-8));
    const y  = H - bottom - bh;
    const col = item.color || (item.value >= targetH*60 ? '#10b981' : '#2563eb');
    const lbl = item.value ? fmtH(item.value/60) : '';
    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="4" fill="${col}" opacity=".9"/>
      <text x="${(x+bw/2).toFixed(1)}" y="${(y-3).toFixed(1)}" text-anchor="middle" font-size="8" fill="${col}" font-weight="bold">${lbl}</text>
      <text x="${(x+bw/2).toFixed(1)}" y="${(H-5).toFixed(1)}" text-anchor="middle" font-size="9" fill="#94a3b8">${item.label}</text>`;
  }).join('');

  const target = targetH ? `<line x1="${pad}" y1="${targetY.toFixed(1)}" x2="${W-pad}" y2="${targetY.toFixed(1)}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4,3"/>
    <text x="${W-pad+2}" y="${(targetY+4).toFixed(1)}" font-size="8" fill="#f59e0b">${targetH}h</text>` : '';

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg">${bars}${target}</svg>`;
}

function svgDonut(segments, cx=70, cy=70, r=50, sw=18) {
  if(!segments.length) return '';
  const total = segments.reduce((s,seg)=>s+seg.value,0);
  if(!total) return '';
  const circ = 2*Math.PI*r;
  let angle = -Math.PI/2;
  const arcs = segments.map(seg=>{
    const pct   = seg.value/total;
    const sweep = pct*2*Math.PI;
    const x1 = cx+r*Math.cos(angle);
    const y1 = cy+r*Math.sin(angle);
    angle   += sweep;
    const x2 = cx+r*Math.cos(angle);
    const y2 = cy+r*Math.sin(angle);
    const lg = sweep>Math.PI?1:0;
    return `<path d="M${cx} ${cy} L${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${lg} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${seg.color}" opacity=".85"/>`;
  }).join('');
  return `<svg viewBox="0 0 140 140" width="130" xmlns="http://www.w3.org/2000/svg">
    ${arcs}
    <circle cx="${cx}" cy="${cy}" r="${r-sw}" fill="white"/>
  </svg>`;
}

const CHART_COLORS = ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16'];

// ─── Render Stats ─────────────────────────────
function renderStats() {
  const content   = document.getElementById('stats-content');
  const completed = Object.entries(data).filter(([,e])=>e.arrivee&&e.depart);
  const fmt2      = v=>v.toFixed(2).replace('.',',');

  // ── Salaire mensuel ──
  const sal   = calcSalaireMois(statsAnnee, statsMois);
  const prevM = statsMois===0?11:statsMois-1, prevY=statsMois===0?statsAnnee-1:statsAnnee;
  const nextM = statsMois===11?0:statsMois+1, nextY=statsMois===11?statsAnnee+1:statsAnnee;
  const hasRate = settings.tauxHoraire>0;

  const salaireBlock=`
  <div class="chart-section-title">💶 Salaire — ${MOIS_FULL[statsMois]} ${statsAnnee}</div>
  <div class="month-nav">
    <button onclick="changeMonth(${prevM},${prevY})">‹</button>
    <span>${MOIS_FULL[statsMois]} ${statsAnnee}</span>
    <button onclick="changeMonth(${nextM},${nextY})">›</button>
  </div>
  <div class="sal-card">
    <div class="sal-row"><span>Heures normales (≤${settings.seuilHS25}h/sem)</span><span class="sal-val">${fmtH(sal.hNormal)}</span></div>
    <div class="sal-row hs25"><span>Heures sup +25%</span><span class="sal-val">${fmtH(sal.hHS25)}</span></div>
    <div class="sal-row hs50"><span>Heures sup +50%</span><span class="sal-val">${fmtH(sal.hHS50)}</span></div>
    <div class="sal-row total-h"><span>Total heures</span><span class="sal-val">${fmtH(sal.totalH)}</span></div>
    ${hasRate?`<div class="sal-divider"></div>
    <div class="sal-row"><span>Salaire base</span><span class="sal-val">${fmt2(sal.base)} €</span></div>
    <div class="sal-row hs25"><span>Majorations +25%</span><span class="sal-val">+${fmt2(sal.hs25-sal.hHS25*settings.tauxHoraire)} €</span></div>
    <div class="sal-row hs50"><span>Majorations +50%</span><span class="sal-val">+${fmt2(sal.hs50-sal.hHS50*settings.tauxHoraire)} €</span></div>
    <div class="sal-row grand-total"><span>💶 Salaire brut estimé</span><span class="sal-val">${fmt2(sal.total)} €</span></div>`
    :`<div class="sal-info">💡 Configure ton taux horaire dans les Réglages.</div>`}
  </div>`;

  if (!completed.length) {
    content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><p>Pas encore de données</p></div>${salaireBlock}`;
    return;
  }

  // ── KPIs globaux ──
  const nets     = completed.map(([,e])=>calcNetMinutes(e.arrivee,e.depart,getEntryPause(e))).filter(Boolean);
  const totalMin = nets.reduce((a,b)=>a+b,0);
  const avgMin   = Math.round(totalMin/nets.length);
  const maxMin   = Math.max(...nets);

  // Heure arrivée/départ moyenne
  const toMins = t => { const [h,m]=t.split(':').map(Number); return h*60+m; };
  const avgArrMin = Math.round(completed.reduce((s,[,e])=>s+toMins(e.arrivee),0)/completed.length);
  const avgDepMin = Math.round(completed.filter(([,e])=>e.depart).reduce((s,[,e])=>s+toMins(e.depart),0)/completed.filter(([,e])=>e.depart).length);
  const minsToTime = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

  // Ponctualité
  const targetArr = toMins(settings.heureArrivee);
  const onTime    = completed.filter(([,e])=>toMins(e.arrivee)<=targetArr).length;
  const ponct     = Math.round(onTime/completed.length*100);

  // ── Bar chart — heures par semaine (8 dernières) ──
  const bySemaine = {};
  completed.forEach(([date,e])=>{
    const d=new Date(date+'T12:00:00');
    const wk=`${d.getFullYear()}-S${String(getWeekNumber(d)).padStart(2,'0')}`;
    if(!bySemaine[wk])bySemaine[wk]=0;
    const net=calcNetMinutes(e.arrivee,e.depart,getEntryPause(e));
    if(net)bySemaine[wk]+=net;
  });
  const semItems = Object.entries(bySemaine).sort().slice(-8).map(([k,v])=>({
    label:k.split('-')[1], value:v
  }));

  // ── Bar chart — moyenne par jour de semaine ──
  const byDow = {1:[],2:[],3:[],4:[],5:[]};
  completed.forEach(([date,e])=>{
    const dow=new Date(date+'T12:00:00').getDay();
    if(dow>=1&&dow<=5){
      const net=calcNetMinutes(e.arrivee,e.depart,getEntryPause(e));
      if(net)byDow[dow].push(net);
    }
  });
  const dowLabels=['Lun','Mar','Mer','Jeu','Ven'];
  const dowItems = [1,2,3,4,5].map((d,i)=>({
    label:dowLabels[i],
    value:byDow[d].length ? Math.round(byDow[d].reduce((a,b)=>a+b,0)/byDow[d].length) : 0
  }));
  const bestDow = dowItems.reduce((best,cur)=>cur.value>best.value?cur:best, dowItems[0]);

  // ── Donut — répartition par client ──
  const byClient = {};
  completed.forEach(([,e])=>{
    (e.missions||[]).forEach(m=>{
      const key = m.nomClient||m.client||'Inconnu';
      const h   = m.heures || (calcNetMinutes(e.arrivee,e.depart,getEntryPause(e))||0)/60;
      byClient[key] = (byClient[key]||0)+h;
    });
  });
  const clientSegs = Object.entries(byClient)
    .sort((a,b)=>b[1]-a[1]).slice(0,6)
    .map(([name,h],i)=>({name, value:h, color:CHART_COLORS[i]}));
  const totalClientH = clientSegs.reduce((s,c)=>s+c.value,0);

  // ── Streak ──
  const sortedDates = Object.keys(data).filter(d=>{
    const e=data[d]; return e.arrivee&&e.depart&&new Date(d+'T12:00:00').getDay()!==0&&new Date(d+'T12:00:00').getDay()!==6;
  }).sort();
  let streak=0, tempStreak=0, prevDate=null;
  sortedDates.forEach(date=>{
    if(prevDate){
      const prev=new Date(prevDate+'T12:00:00'), cur=new Date(date+'T12:00:00');
      const diff=(cur-prev)/(86400000);
      if(diff<=3)tempStreak++; else tempStreak=1;
    } else tempStreak=1;
    streak=Math.max(streak,tempStreak); prevDate=date;
  });

  // ── Heures sup cumulées (toutes périodes) ──
  const allWeekTotals = {};
  Object.entries(data).forEach(([date,e])=>{
    const d=new Date(date+'T12:00:00');
    const wk=`${d.getFullYear()}-S${String(getWeekNumber(d)).padStart(2,'0')}`;
    if(!allWeekTotals[wk])allWeekTotals[wk]=0;
    const net=calcNetMinutes(e.arrivee,e.depart,getEntryPause(e));
    if(net)allWeekTotals[wk]+=net/60;
  });
  let totalHS25=0,totalHS50=0;
  Object.values(allWeekTotals).forEach(h=>{
    totalHS25+=Math.max(0,Math.min(h-settings.seuilHS25,settings.seuilHS50-settings.seuilHS25));
    totalHS50+=Math.max(0,h-settings.seuilHS50);
  });
  const totalHS=totalHS25+totalHS50;
  const hsBlock = totalHS>0 ? `
  <div class="chart-section-title">⚡ Heures sup cumulées (toutes périodes)</div>
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-value" style="color:#f59e0b">${fmtH(totalHS25)}</div><div class="stat-label">HS +25%</div></div>
    <div class="stat-card"><div class="stat-value" style="color:#ef4444">${fmtH(totalHS50)}</div><div class="stat-label">HS +50%</div></div>
  </div>` : '';

  // ── HTML FINAL ──
  content.innerHTML = `
  ${salaireBlock}

  <div class="chart-section-title">📊 Vue d'ensemble</div>
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-value">${completed.length}</div><div class="stat-label">Jours pointés</div></div>
    <div class="stat-card"><div class="stat-value">${fmtHHMM(avgMin)}</div><div class="stat-label">Moyenne / jour</div></div>
    <div class="stat-card"><div class="stat-value">${fmtHHMM(maxMin)}</div><div class="stat-label">Record journée</div></div>
    <div class="stat-card"><div class="stat-value">${ponct}%</div><div class="stat-label">Ponctualité</div></div>
  </div>

  <div class="chart-section-title">⏰ Infos clés</div>
  <div class="info-grid">
    <div class="info-card">
      <div class="info-icon">🌅</div>
      <div class="info-val">${minsToTime(avgArrMin)}</div>
      <div class="info-lbl">Arrivée moyenne</div>
    </div>
    <div class="info-card">
      <div class="info-icon">🌆</div>
      <div class="info-val">${minsToTime(avgDepMin)}</div>
      <div class="info-lbl">Départ moyen</div>
    </div>
    <div class="info-card">
      <div class="info-icon">🔥</div>
      <div class="info-val">${streak}</div>
      <div class="info-lbl">Jours de suite</div>
    </div>
    <div class="info-card">
      <div class="info-icon">📅</div>
      <div class="info-val">${bestDow.label}</div>
      <div class="info-lbl">Jour le + long</div>
    </div>
  </div>

  ${semItems.length>1?`
  <div class="chart-section-title">📈 Heures par semaine</div>
  <div class="chart-card">${svgBars(semItems, settings.weeklyHours)}</div>`:''}

  ${dowItems.some(d=>d.value>0)?`
  <div class="chart-section-title">📅 Moyenne par jour de semaine</div>
  <div class="chart-card">${svgBars(dowItems, settings.weeklyHours/5)}</div>`:''}

  ${clientSegs.length>1?`
  <div class="chart-section-title">🏗 Répartition par client</div>
  <div class="chart-card donut-card">
    <div class="donut-wrap">
      ${svgDonut(clientSegs)}
      <div class="donut-legend">${clientSegs.map(c=>`
        <div class="legend-item">
          <span class="legend-dot" style="background:${c.color}"></span>
          <span class="legend-name">${c.name}</span>
          <span class="legend-val">${Math.round(c.value*10)/10}h (${Math.round(c.value/totalClientH*100)}%)</span>
        </div>`).join('')}
      </div>
    </div>
  </div>`:''}

  ${hsBlock}
  `;
}

function changeMonth(m, y) { statsMois=m; statsAnnee=y; renderStats(); }

// ═══════════════════════════════════════════════
//  PARAMÈTRES
// ═══════════════════════════════════════════════
function renderSettingsPage() {
  document.getElementById('set-arrivee').value = settings.heureArrivee;
  document.getElementById('set-depart').value  = settings.heureDepart;
  document.getElementById('set-pause').value   = settings.pauseMin;
  document.getElementById('set-weekly').value  = settings.weeklyHours;
  document.getElementById('set-taux').value    = settings.tauxHoraire||'';
  document.getElementById('set-hs25').value    = settings.seuilHS25;
  document.getElementById('set-hs50').value    = settings.seuilHS50;
  document.getElementById('shortcut-matin').textContent = settings.heureArrivee;
  document.getElementById('shortcut-soir').textContent  = settings.heureDepart;
}

function saveSettings() {
  settings.heureArrivee = document.getElementById('set-arrivee').value;
  settings.heureDepart  = document.getElementById('set-depart').value;
  settings.pauseMin     = parseInt(document.getElementById('set-pause').value)||0;
  settings.weeklyHours  = parseInt(document.getElementById('set-weekly').value)||39;
  settings.tauxHoraire  = parseFloat(document.getElementById('set-taux').value)||0;
  settings.seuilHS25    = parseInt(document.getElementById('set-hs25').value)||39;
  settings.seuilHS50    = parseInt(document.getElementById('set-hs50').value)||43;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  showToast('✅ Paramètres enregistrés !');
  updateWeek();
}

// ═══════════════════════════════════════════════
//  EXPORT CSV
// ═══════════════════════════════════════════════
function exportCSV() {
  const allDates=Object.keys(data).sort();
  if(!allDates.length){showToast('⚠️ Aucune donnée à exporter');return;}

  const weekGroups={};
  allDates.forEach(date=>{
    const d=new Date(date+'T12:00:00');
    const mon=new Date(d); mon.setDate(d.getDate()-(d.getDay()===0?6:d.getDay()-1));
    const k=mon.toISOString().split('T')[0];
    if(!weekGroups[k])weekGroups[k]={};
    weekGroups[k][date]=data[date];
  });

  const S=';';
  const fv=v=>(v||0).toString().replace('.',',');
  const fd=v=>v?toDecimal(v).toString().replace('.',','):'';
  let csv='';

  Object.entries(weekGroups).sort().forEach(([monDate,wData])=>{
    const monD=new Date(monDate+'T12:00:00');
    csv+=`Semaine${S}${getWeekNumber(monD)}\n\n`;
    csv+=`Date${S}Client${S}Nom Client${S}N° Chantier${S}${S}Travail${S}P.Traj${S}G.Traj${S}${S}${S}${S}\n`;

    let tT=0,tP=0,tG=0,tR=0,tN=0,tD=0,tTk=0;
    getWeekDates7(monDate).forEach(date=>{
      const e=wData[date]||{};
      const dd=new Date(date+'T12:00:00');
      const net=calcNetMinutes(e.arrivee,e.depart,getEntryPause(e));
      if(net)tT+=net;
      tR+=e.repas||0; tN+=e.nuit||0; tD+=e.deplacement||0; tTk+=e.ticketResto||0;

      const missions=e.missions&&e.missions.length?e.missions:[{client:'',nomClient:'',chantier:'',heures:null,pTraj:0,gTraj:0}];
      const typeLabel={'conge':'congé','sans-solde':'sans solde','formation':'formation','maladie':'maladie','ferie':'férié','rtt':'RTT'}[e.typeJournee||'']||'';

      missions.forEach((m,i)=>{
        tP+=m.pTraj||0; tG+=m.gTraj||0;
        const travH=m.heures?m.heures.toString().replace('.',','):( i===0?fd(net):'');
        if(i===0){
          csv+=`${JOURS_FULL[dd.getDay()]}${S}${m.client||typeLabel}${S}${m.nomClient||''}${S}${m.chantier||''}${S}${S}${travH}${S}${fv(m.pTraj)}${S}${fv(m.gTraj)}${S}${S}Forfait${S}${fv(e.repas)}${S}Repas\n`;
          csv+=`${S}${S}${S}${S}${S}${S}${S}${S}${S}${S}${fv(e.nuit)}${S}Nuit\n`;
          csv+=`${S}${S}${S}${S}${S}${S}${S}${S}${S}${S}${fv(e.deplacement)}${S}Déplacement\n`;
          csv+=`${S}${S}${S}${S}${S}${S}${S}${S}${S}Autre${S}${fv(e.ticketResto)}${S}Ticket Resto\n`;
          csv+=`${S}${S}${S}${S}${S}${S}${S}${S}${S}${S}${fv(e.vehicule)}${S}Véhicule\n`;
        } else {
          csv+=`${S}${m.client||''}${S}${m.nomClient||''}${S}${m.chantier||''}${S}${S}${travH}${S}${fv(m.pTraj)}${S}${fv(m.gTraj)}\n`;
        }
      });
      csv+=`${formatDateFR(dd)}\n\n`;
    });

    csv+=`${S}${S}${S}${S}Total  Petit Trajet${S}${S}${S}${S}${S}${S}${S}${fv(tP)}\n`;
    csv+=`${S}${S}${S}${S}Total  Grand trajet${S}${S}${S}${S}${S}${S}${S}${fv(tG)}\n`;
    csv+=`${S}${S}${S}${S}Total  Heures${S}${S}${S}${S}${S}${S}${S}${fd(tT)}\n`;
    csv+=`${S}${S}${S}${S}Total Forfait Repas${S}${S}${S}${S}${S}${S}${S}${fv(tR)}\n`;
    csv+=`${S}${S}${S}${S}Total Forfait Nuit${S}${S}${S}${S}${S}${S}${S}${fv(tN)}\n`;
    csv+=`${S}${S}${S}${S}Total Déplacement${S}${S}${S}${S}${S}${S}${S}${fv(tD)}\n`;
    csv+=`${S}${S}${S}${S}Total Ticket Restaurant${S}${S}${S}${S}${S}${S}${S}${fv(tTk)}\n\n\n`;
  });

  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`feuille_heures_${todayKey()}.csv`; a.click();
  URL.revokeObjectURL(url);
  showToast('📥 Export téléchargé !');
}

// ═══════════════════════════════════════════════
//  JSON BACKUP / RESTORE
// ═══════════════════════════════════════════════
function exportJSON() {
  const backup = { version:1, exportDate:todayKey(), data, settings, savedClients };
  const blob = new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=`pointage_backup_${todayKey()}.json`; a.click();
  URL.revokeObjectURL(url);
  showToast('💾 Sauvegarde exportée !');
}

function importJSON() {
  const input = document.createElement('input');
  input.type='file'; input.accept='.json';
  input.onchange = ev => {
    const file = ev.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = re => {
      try {
        const b = JSON.parse(re.target.result);
        if(!b.data) { showToast('❌ Fichier invalide'); return; }
        if(!confirm(`Importer ${Object.keys(b.data).length} jour(s) ? Les données actuelles seront fusionnées.`)) return;
        // Fusion : les données importées écrasent en cas de conflit
        Object.assign(data, b.data); saveData();
        if(b.settings)      { settings={...settings,...b.settings}; saveSettings(); }
        if(b.savedClients)  { savedClients=b.savedClients; saveClients(); }
        fillFields(currentDate);
        updateBanner(); updateButtons(); updateWeek();
        updateDatalistClients();
        showToast(`✅ ${Object.keys(b.data).length} jours importés !`);
      } catch(err) { showToast('❌ Fichier invalide'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ═══════════════════════════════════════════════
//  EFFACER
// ═══════════════════════════════════════════════
function clearAllData() {
  if(confirm('Effacer tous les pointages ? Irréversible.')){
    data={}; saveData(); fillFields(currentDate);
    updateBanner(); updateButtons(); updateWeek();
    showToast('🗑 Données effacées');
  }
}

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded',()=>{
  const toast=document.createElement('div');
  toast.id='toast'; toast.className='toast';
  document.body.appendChild(toast);

  loadData();
  updateDateHeader();
  fillFields(currentDate);
  updateDatalistClients();
  updateBanner(); updateButtons(); updateWeek();

  setInterval(()=>{
    const e=data[currentDate];
    if(e?.arrivee&&!e?.depart) updateBanner();
  },1000);

  if('serviceWorker' in navigator)
    navigator.serviceWorker.register('sw.js').catch(console.error);
});
