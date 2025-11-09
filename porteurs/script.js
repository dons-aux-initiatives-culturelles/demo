// script.js — Tableau de bord porteur (ANDIC prototype)

/*
Behavior:
- For each territorial level we have: totalDonations, nbProjects -> mean = total / nb
- Slider per level: range [-15, cap] in percent, default 0
- cap = clamp( min(15, 15 - cumulatedBonusMalus), -15, 15 )
- proposedAmount = mean * (1 + pct/100)
- totalAllocated = sum(proposedAmounts) + alreadyAllocated
- validate only if totalAllocated >= projectCost
*/

// ---------- Demo data ----------
const projectCost = 1120;



// levels data: total donations available at that level, number of projects at that level
const levels = [
  { key: 'project',  type: 'Project', label: 'Création : Soleil Levant', total: 700, projects: 1 },
  //{ key: 'project_2',  type: 'Project', label: 'Atelier chant', total: 700, projects: 1 },
  //{ key: 'project_3',  type: 'Project', label: 'Spectacle jeunes artistes', total: 700, projects: 1 },
  { key: 'establishment', type: 'Establishment', label: 'Théâtre du Soleil Levant', total: 500, projects: 7 },
  //{ key: 'establishment_8752', type: 'Establishment', label: 'MJC - Espace Helios', total: 500, projects: 7 },
  //{ key: 'establishment_7814', type: 'Establishment', label: 'Ecole de musique - Mr. Bonhomme', total: 500, projects: 7 },
  { key: 'commune', type: 'Commune', label: 'Douai', total: 950, projects: 22 },
  //{ key: 'commune_59552', type: 'Commune', label: 'Lambres-lez-douai', total: 950, projects: 22 },
  { key: 'commu', type: 'Communauté de communes', label: 'Douaisi agglo', total: 4730, projects: 52 },
  { key: 'dept_59', type: 'Département', label: 'Nord-pas-de-calais', total: 17520, projects: 428 },
  { key: 'region_hdf', type: 'Région', label: 'Haut-de-France', total: 49500, projects: 907 },
  { key: 'country_fr', type: 'Pays', label: 'France', total: 128000, projects: 1242 }
];


// Base malus/bonus values (these mirror the figures shown on the porteur dashboard)
const baseMaluses = {
  commune: 3,        // +3%
  commu: 0,          // 0
  dept_59: -2,          // -2%
  region_hdf: 1,         // +1%
  country_fr: 0         // 0%
};

// Initialize per-level structure with base values
let levelMaluses = {};
levels.forEach(l => {
  levelMaluses[l.key] = {
    history: [{ year: 2025, delta: baseMaluses[l.key] || 0 }], // first entry from dashboard
    cumulated: baseMaluses[l.key] || 0
  };
});





const projects = [
  {
    id: 1,
    name: 'Création : Soleil Levant',
    structure: 'Théâtre du Soleil Levant',
    status: 'En phase d’allocation',
    cost: 1750,
    levels: { project: 'project_1', establishment: 'establishment_4578', commune: 'commune_59178', commu:'commu', dept:'dept_59', region:'region_hdf', country:'country_fr'}, // copie indépendante
    levelMaluses: JSON.parse(JSON.stringify(levelMaluses)),
    allocations: null // null = non validé, sinon contient montants
  },
  {
    id: 2,
    name: 'Atelier chant',
    structure: 'MJC Lambres',
    status: 'En phase d’allocation',
    cost: 1220,
    levels: { project: 'project_2', establishment: 'establishment_8752', commune: 'commune_59552', commu:'commu', dept:'dept_59', region:'region_hdf', country:'country_fr'}, // copie indépendante
    levelMaluses: JSON.parse(JSON.stringify(levelMaluses)),
    allocations: null
  },
  {
    id: 3,
    name: 'Spectacle jeunes artistes',
    structure: 'École de musique de Lambres',
    status: 'Dons attribués',
    cost: 980,
    levels: { project: 'project_3', establishment: 'establishment_7814', commune: 'commune_59552', commu:'commu', dept:'dept_59', region:'region_hdf', country:'country_fr'}, // copie indépendante
    levelMaluses: JSON.parse(JSON.stringify(levelMaluses)),
    allocations: { commune: 400, region: 580 } // exemple déjà validé
  }
];


// ---------- util helpers ----------
const q = s => document.querySelector(s);
const fmt = v => (Math.round(v)).toLocaleString('fr-FR') + ' €';
const clamp = (v,min,max) => Math.max(min, Math.min(max, v));
function baseCapForProjects(nbProjects){
  if(nbProjects <= 2) return 0;
  if(nbProjects <= 4) return 5;
  if(nbProjects <= 7) return 10;
  return 15;
}


// ---------- compute mean ----------
function meanForLevel(l){
  return l.projects > 0 ? l.total / l.projects : 0;
}


function computeCap(levelKey){
  const lvl = levelMaluses[levelKey];
  const level = levels.find(l => l.key === levelKey);
  if (!lvl || !level) return 15;
  const baseCap = baseCapForProjects(level.projects);
  const c = lvl.cumulated;  // positive = bonus, negative = malus
  let raw = Math.min(baseCap, baseCap + c);
  raw = clamp(raw, -15, baseCap);
  return Math.round(raw);
}


// ---------- runtime state ----------
const state = {
  slidersPct: {}, // pct per level key
  proposedAmount: {}, // euros per level
};

// initialize default state
levels.forEach(l=>{
  state.slidersPct[l.key] = 0; // default at 0% (i.e. mean)
  const mean = meanForLevel(l);
  state.proposedAmount[l.key] = Math.round(mean * (1 + 0/100));
});

// ---------- render UI ----------
function initUI(){
  // set top summary
  q('#projectCost').textContent = fmt(projectCost);
  /*q('#alreadyAllocated').textContent = fmt(alreadyAllocated);*/
  updateTotalsOverview();

    
  buildDonationTable();


  // wire buttons
  q('#btnAuto').addEventListener('click', autoFill);
  q('#btnValidate').addEventListener('click', validateAllocation);

  // render history list
  renderHistory();
  updateTotalsOverview();
}

function buildDonationTable(){
  // render levels
  const container = q('#levelsContainer');
  container.innerHTML = '';
	
 //project.levels
  levels.forEach(l=>{
    const mean = meanForLevel(l);
    const meanRounded = Math.round(mean*100)/100;
	const maxpc = computeCap(l.key);
    // build row
    const row = document.createElement('div');
    row.className = 'slider-row';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';

    row.innerHTML = `
      <div style="flex:1;min-width:210px">
        <div style="font-weight:700;font-size: 1.2rem">${l.label}</div>
      </div>

	<div style="width:120px;text-align:center">
        <div class="small muted">Total des dons</div>
        <div style="font-weight:700">${fmt(l.total)}</div>
      </div>
	  
	  	<div style="width:140px;text-align:center">
        <div class="small muted">Nombre de projets</div>
        <div style="font-weight:700">${l.projects}</div>
      </div>
	  
      <div style="width:160px;text-align:center">
        <div class="small muted">Don moyen par projet</div>
        <div style="font-weight:700;font-size: 1.6rem">${fmt(Math.round(mean))}</div>
      </div>
	  
	  <div style="width:180px;text-align:center">
        <div class="small muted">Plafond d'ajustement</div>
        <div style="font-weight:700">${Math.round(maxpc)}%<span class="small muted"> • Malus: ${-levelMaluses[l.key].cumulated}</span></div>
      </div>

      <div class="slider-block">
        <input type="range" min="-15" max="${maxpc}" value="${state.slidersPct[l.key]}" step="1" data-key="${l.key}">

         </div>

      <div style="width:220px;text-align:right">
        <div class="small muted">Affectation proposée</div>
        <div style="font-weight:700;font-size: 1.6rem" id="amt-${l.key}">${fmt(state.proposedAmount[l.key])} (${state.slidersPct[l.key].toFixed(1)}%)</div>
      </div>
    `;
    container.appendChild(row);

    // bind slider event
    const slider = row.querySelector('input[type=range]');
    slider.addEventListener('input', (e)=>{
      const key = e.target.dataset.key;
      const pct = parseInt(e.target.value,10);
      state.slidersPct[key] = pct;
      // compute amount relative to mean
      const meanVal = meanForLevel(l);
	  const maxpc = computeCap(l.key);
      const amount = Math.round(meanVal * (1 + pct/100));
      state.proposedAmount[key] = amount;
      q('#amt-'+key).textContent = fmt(amount)+' ('+pct+'%)';
      // update totals & colors
      updateTotalsOverview();
      updateRowColor(row, meanVal, amount, 15);
    });

    // initial color
    updateRowColor(row, mean, state.proposedAmount[l.key], 15);
  });
}


// update color on row according to diff to mean
function updateRowColor(row, meanVal, amount, maxpc){
  // compute diff % relative to mean
  let diff = 0;
  if(meanVal > 0){
    diff = ((amount - meanVal) / meanVal) * 100;
  } else {
    diff = amount > 0 ? 999 : 0;
  }
  // select color class inline style (background tint)
  let bg = '#fbfdff';
  if(diff <= -10 && diff >= -15) bg = '#e6f6ff'; // bleu ciel (bonus fort)
  else if(diff < -5 && diff > -10) bg = '#f0fff4'; // vert clair
  else if(diff >= -5 && diff <= maxpc/3) bg = '#ffffff'; // équilibre (no change)
  else if(diff > maxpc/3 && diff <= 2*maxpc/3) bg = '#fff7ed'; // orange clair
  else if(diff > 2*maxpc/3 && diff <= maxpc) bg = '#fff1f1'; // rouge clair
  else if(diff > maxpc) bg = '#f3f4f6'; // noir/refus (use neutral)
  row.style.background = bg;
}

// sum totals and update summary UI
function updateTotalsOverview(){
  // sum proposed amounts (excluding 'project' since it's alreadyAllocated included)
  let sumProposed = 0;
  levels.forEach(l=>{
    // For 'project' level, proposed amount represents already allocated - keep included in sum calculation separately
    sumProposed += (state.proposedAmount[l.key] || 0);
  });

  const totalAllocated = Math.round(sumProposed);
  q('#totalAllocated').textContent = fmt(totalAllocated);

  // stack bar representation: proportions relative to projectCost
  const stack = q('#stackBar');
  stack.innerHTML = '';

  // rest segments
  levels.forEach((l, idx)=>{
    const amt = state.proposedAmount[l.key] || 0;
    const pct = projectCost > 0 ? Math.round(Math.min(100, (amt / projectCost) * 100)) : 0;
    if(pct <= 0) return;
    const seg = document.createElement('div');
    seg.className = 'stack-seg';
    seg.style.width = pct + '%';
    // color variety
    const colors = ['#ffefc5','#ffe1c8','#ffd6e0','#e8fdec','#e6f0ff','#f3e8ff'];
    seg.style.background = colors[idx % colors.length];
    seg.title = `${l.label}: ${fmt(amt)}`;
    stack.appendChild(seg);
  });

  // percent message
  const percent = Math.round((totalAllocated / projectCost) * 100);
  const pm = q('#percentMsg');
  if(totalAllocated >= projectCost){
    pm.textContent = `Projet financé (${percent}%).`;
    pm.style.color = 'var(--success)';
  } else {
    pm.textContent = `${projectCost - totalAllocated} € à trouver (${percent}%).`;
    pm.style.color = 'var(--muted)';
  }


  // enable validate only if totalAllocated >= projectCost
  const btn = q('#btnValidate');
  btn.disabled = !(totalAllocated >= projectCost);

}

function autoFill() {
  const order = ['project','establishment','commune','commu','dept_59','region_hdf','country_fr'];
  const sorted = order
    .map(k => levels.find(l => l.key === k))
    .filter(Boolean)
    .sort((a,b)=>meanForLevel(b)-meanForLevel(a)); // highest mean first

  const totalNeeded = projectCost;
  let remaining = totalNeeded;

  // reset allocations
  Object.keys(state.proposedAmount).forEach(k => state.proposedAmount[k]=0);

  // first, assign base mean for each level (0% adjustment)
  for (const lvl of sorted){
    const key = lvl.key;
    const mean = meanForLevel(lvl);
    state.proposedAmount[key] = mean;
    remaining -= mean;
  }

  // if means already exceed cost, scale them down
  if (remaining < 0) {
    const scale = totalNeeded / (totalNeeded - remaining);
    for (const lvl of sorted){
      state.proposedAmount[lvl.key] *= scale;
    }
    remaining = 0;
  }

  // now, increase each level up to its cap until project funded
  for (const lvl of sorted) {
    if (remaining <= 0) break;
    const key = lvl.key;
    const mean = meanForLevel(lvl);
    const cap = computeCap(key); // max positive %
    const maxAmt = mean * (1 + cap/100);
    const current = state.proposedAmount[key];
    const extra = maxAmt - current;
    const add = Math.min(extra, remaining);
    state.proposedAmount[key] += add;
    remaining -= add;
  }

  // compute % sliders
  for (const lvl of sorted){
    const key = lvl.key;
    const mean = meanForLevel(lvl);
    const pct = mean>0 ? ((state.proposedAmount[key]/mean)-1)*100 : 0;
    const cap = computeCap(key);
    state.slidersPct[key] = clamp(pct,-15,cap);
  }

  // update UI sliders and labels
  document.querySelectorAll('#levelsContainer input[type=range]').forEach(inp=>{
    const key=inp.dataset.key;
    if(!state.slidersPct.hasOwnProperty(key))return;
    inp.value=state.slidersPct[key];
	q('#amt-'+key).textContent = `${fmt(state.proposedAmount[key])} (${state.slidersPct[key].toFixed(1)}%)`;
  });

  updateTotalsOverview();

  if (remaining>0){
    alert(`⚠️ Not enough total capacity to fund the project. Missing ${fmt(remaining)}.`);
  }
}



// validate allocation (simulate submit)
function validateAllocation(){
  // create a simple record: compute diffs -> derive bonus/malus delta to store
  // compute delta as sum of (if requested > mean => malus negative up to -15 ; if requested < mean => bonus positive up to +15)
	const year = new Date().getFullYear();
	levels.forEach(l=>{
	  if(l.key === 'project') return;
	  const mean = meanForLevel(l);
	  const req = state.proposedAmount[l.key] || 0;
	  if(mean <= 0) return;
	  const diffPct = ((req - mean) / mean) * 100;
	  let delta = 0;
	  if(diffPct < 0){
		const bonus = Math.min(15, Math.abs(diffPct));
		delta = Math.round(bonus);
	  } else {
		const malus = -Math.min(15, diffPct);
		delta = Math.round(malus);
	  }
	  // store in history for this level
	  levelMaluses[l.key].history.unshift({ year, delta });
	  // recompute cumulated
	  levelMaluses[l.key].cumulated = levelMaluses[l.key].history.reduce((s,e)=> s + e.delta, 0);
	});
  
  // change project status visually (for demo)
  alert('Affectation validée. Les fonds seront bloqués et le projet passera en phase de financement.');
  // re-render UI
  buildDonationTable();
  renderHistory();
  updateTotalsOverview();
}

// render history
function renderHistory(){
  const container = q('#historyList');
  container.innerHTML = '';
  let any = false;
  for(const l of levels){
    const hist = levelMaluses[l.key].history;
    if(hist.length === 0) continue;
    any = true;
    const section = document.createElement('div');
    section.innerHTML = `<div style="font-weight:700;margin-top:0.5em">${l.label}</div>`;
    hist.slice(0,3).forEach(h=>{
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `<div>${h.year}</div><div class="small muted">Δ ${h.delta>0? '+'+h.delta : h.delta}</div>`;
      section.appendChild(div);
    });
    container.appendChild(section);
  }
  if(!any) container.innerHTML = '<div class="small muted">Aucun historique</div>';
}


// ---------- start ----------
initUI();
