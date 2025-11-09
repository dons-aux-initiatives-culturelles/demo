// script.js — Prototype tableau de bord donateur ANDIC
// Ne pas oublier : enregistrer dans le même dossier que index.html et style.css

// ---------- Données de démonstration ----------
const sampleProjects = [
  { id:1, title:"MJC - Atelier théâtre", location:"Grenoble", type:"mjc", budget:3800, raised:3200, thumb:"https://via.placeholder.com/120x80" },
  { id:2, title:"Théâtre municipal - Création", location:"Nantes", type:"theatre", budget:6500, raised:4200, thumb:"https://via.placeholder.com/120x80" },
  { id:3, title:"École de musique - Matériel", location:"Lyon", type:"musique", budget:3800, raised:3200, thumb:"https://via.placeholder.com/120x80" },
  { id:4, title:"Renovation patrimoine - Chapelle", location:"Bordeaux", type:"patrimoine", budget:12000, raised:7500, thumb:"https://via.placeholder.com/120x80" },
  { id:5, title:"Festival local - scène", location:"Le Mans", type:"musique", budget:9000, raised:6300, thumb:"https://via.placeholder.com/120x80" }
];

// sample history
let donationsHistory = [
  { id: "d1", date:"2025-08-12", amount:100, breakdown:{commune:20,commu:20,dept:20,region:20,country:20}, targets:[] },
  { id: "d2", date:"2025-06-02", amount:50, breakdown:{commune:10,commu:10,dept:10,region:10,country:10, special:40}, targets:[{id:3,amount:20}] },
];

// ---------- Configuration ----------
const territorialLevels = [
  { key:"commune", label:"Ma commune", projects: 4, min:5, max:75, default:20, color:"#5b7bd5" },
  { key:"commu",   label:"Ma communauté de communes", min:5, projects: 23, max:75, default:20, color:"#4070d6" },
  { key:"dept",    label:"Mon département", projects: 188, min:5, max:75, default:20, color:"#2b55c0" },
  { key:"region",  label:"Ma région", projects: 478, min:5, max:75, default:20, color:"#1e3a8a" },
  { key:"country", label:"Mon pays", projects: 5786, min:5, max:75, default:20, color:"#16325f" },
];

// runtime state
let selectedProjects = []; // {id, pct}
let slidersState = {}; // percent values for each level & projects
let currentAmount = 120;

// ---------- Helpers ----------
const q = sel => document.querySelector(sel);
const qa = sel => Array.from(document.querySelectorAll(sel));
const clamp = (v,min,max) => Math.max(min, Math.min(max, v));

// format currency
const fmt = v => `${Math.round(v).toLocaleString('fr-FR')} €`;

// ---------- Init UI ----------
function init(){
  // render territorial sliders
  const container = q("#territorySliders");
  territorialLevels.forEach(level=>{
    const row = document.createElement("div");
    row.className = "project-card";
    row.innerHTML = `
	<div class="meta">
        <div class="slider-row">
  <div style="display:flex; flex-direction:column; width:250px;">
    <label title="${level.label}" style="font-weight:600;">${level.label}</label>
    <small class="muted" style="font-size:12px; color:var(--muted);">
      ${level.projects || 0} projets
    </small>
  </div>
  <input type="range" min="${level.min}" max="${level.max}" value="${level.default}" data-key="${level.key}">
  <div class="pct"><strong><span class="pct-val">${level.default}</span>%</strong></div>
  <div class="euro">${fmt(level.default/100*currentAmount)}</div>
  </div>
  </div>
`;
    container.appendChild(row);
    slidersState[level.key] = level.default;
  });

  // set amount input
  const amountInput = q("#donAmount");
  amountInput.addEventListener("input", onAmountChange);
  onAmountChange(); // initial

  // wire sliders change
  qa("#territorySliders input[type=range]").forEach(s=>{
    s.addEventListener("input", onTerritoryChange);
  });

  // build initial stack & list
  updateSummary();

  // search modal
  q("#openSearch").addEventListener("click", ()=> {
    q("#modalSearch").classList.remove("hidden");
    renderProjectResults();
    q("#projQuery").focus();
  });
  q("#closeSearch").addEventListener("click", ()=> q("#modalSearch").classList.add("hidden"));
  q("#projQuery").addEventListener("input", renderProjectResults);
  q("#projFilter").addEventListener("change", renderProjectResults);

  // autoFill default
q("#autoFill").addEventListener("click", ()=> {
  // count total “items”: territorial levels + selected projects
  const allItems = [...territorialLevels, ...selectedProjects];
  if (allItems.length === 0) return;

  const share = Math.floor(100 / allItems.length);
  let remaining = 100-share*allItems.length;

  // reset all percentages
  territorialLevels.forEach(l => {
    const val = share;
    slidersState[l.key] = val;
    //remaining -= val;
    const range = document.querySelector(`input[data-key="${l.key}"]`);
    if (range) {
      range.value = val;
      range.nextElementSibling.querySelector(".pct-val").textContent = val;
      range.parentElement.querySelector(".euro").textContent = fmt(val/100*currentAmount);
    }
  });

  selectedProjects.forEach((sp, i) => {
    // distribute remaining to avoid rounding loss
    let val = share;
    //if (i === selectedProjects.length - 1) val += remaining;
    sp.pct = val;
    sp.amount = Math.round(val/100*currentAmount);
  });

  renderSelectedProjects(); // refresh sliders of projects
  updateSummary();
});

  // validation
  q("#btnValidate").addEventListener("click", submitDonation);
  q("#btnPreview").addEventListener("click", previewReceipt);

  // populate history
  renderHistory();
}

// ---------- Event handlers ----------
function onAmountChange(e){
  const input = q("#donAmount");
  let v = parseFloat(input.value) || 0;
  if(v < 1) v = 1;
  currentAmount = v;

  // update tax estimation (66% reduction)
  const net = Math.round(v * (1 - 0.66));
  q("#netCost").textContent = fmt(net);

  // update euro values for territorial sliders
  qa("#territorySliders .slider-row").forEach(row => {
    const range = row.querySelector('input[type=range]');
    const pct = parseFloat(range.value);
    row.querySelector(".euro").textContent = fmt(pct / 100 * currentAmount);
  });

  // 🔧 update euro values for each selected project
  selectedProjects.forEach(sp => {
    sp.amount = Math.round(sp.pct / 100 * currentAmount);
    // find corresponding displayed card
    const card = document.querySelector(`.project-card input[data-project="${sp.id}"]`);
    if (card) {
      //const euroDiv = card.parentElement.querySelector('div[style*="color:var(--muted)"]');
	  const euroDiv = card.parentElement.querySelector('.euro');
      if (euroDiv) euroDiv.textContent = fmt(sp.amount);
    }
  });

  // finally update the global summary & totals
  updateSummary();
}


function onTerritoryChange(e){
  const key = e.target.dataset.key;
  const pct = parseInt(e.target.value,10);
  slidersState[key] = pct;
  e.target.nextElementSibling.querySelector(".pct-val").textContent = pct;
  e.target.parentElement.querySelector(".euro").textContent = fmt(pct/100*currentAmount);
  updateSummary();
}

// ---------- Projects search & add ----------
function renderProjectResults(){
  const qstr = q("#projQuery").value.trim().toLowerCase();
  const type = q("#projFilter").value;
  const results = sampleProjects.filter(p=>{
    if(type && p.type !== type) return false;
    if(!qstr) return true;
    return (p.title + " " + p.location + " " + p.type).toLowerCase().includes(qstr);
  });
  const container = q("#projResults");
  container.innerHTML = "";
  if(results.length === 0){
    container.innerHTML = `<div class="small muted">Aucun résultat</div>`;
    return;
  }
  results.forEach(p=>{
    const it = document.createElement("div");
    it.className = "result-item";
    it.innerHTML = `
      <img src="${p.thumb}" alt="${p.title}">
      <div class="meta">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:700">${p.title}</div>
            <div class="small muted">${p.location} • ${p.type}</div>
            <div class="small muted">Budget : ${fmt(p.budget)}</div>
          </div>
          <button class="add-btn" data-id="${p.id}">Ajouter</button>
        </div>
      </div>
    `;
    container.appendChild(it);
    it.querySelector(".add-btn").addEventListener("click", ()=> {
      addProjectById(p.id);
      q("#modalSearch").classList.add("hidden");
    });
  });
}

function addProjectById(id){
  if(selectedProjects.find(s=>s.id===id)) return;
  const p = sampleProjects.find(x=>x.id===id);
  if(!p) return;
  
  // default percent = 5%
  const pct = 5;
  const amount = Math.round(pct / 100 * currentAmount);

  selectedProjects.push({ id:p.id, title:p.title, pct:5, amount:amount });
  renderSelectedProjects();
  updateSummary();
}

function removeSelectedProject(id){
  selectedProjects = selectedProjects.filter(s=>s.id!==id);
  renderSelectedProjects();
  updateSummary();
}

function renderSelectedProjects(){
  const container = q("#selectedList");
  container.innerHTML = "";
  if(selectedProjects.length === 0){
    container.innerHTML = `<div class="small muted">Aucun projet ciblé pour le moment.</div>`;
    return;
  }
  selectedProjects.forEach(sp=>{
    const p = sampleProjects.find(x=>x.id===sp.id);
    const card = document.createElement("div");
    card.className = "project-card";
    card.innerHTML = `
      <div class="meta">
        <div class="slider-row">
			<div style="display:flex; flex-direction:column; width:250px;">
			<label title="${p.title}">${p.title}</label>
			<small class="muted" style="font-size:12px; color:var(--muted);">
			  ${p.location} • Budget ${fmt(p.budget)}
			<button class="remove" data-rm="${sp.id}">✕</button>
			</small>
		</div>		  
		<input type="range" min="5" max="75" value="${sp.pct}" data-project="${sp.id}">
		<div class="pct"><strong><span class="pct-val">${sp.pct}</span>%</strong></div>
		<div class="euro">${fmt(sp.amount)}</div>
	  
        </div>
      </div>
	  
	  
    `;
    container.appendChild(card);
    // bind remove
    card.querySelector(".remove").addEventListener("click", ()=> removeSelectedProject(sp.id));
    // bind slider
    const rng = card.querySelector('input[type=range]');
    rng.addEventListener("input", (e)=> {
      const val = parseInt(e.target.value,10);
      sp.pct = val;
      sp.amount = Math.round(val/100*currentAmount);
      e.target.nextElementSibling.textContent = val + "%";
	  const euroDiv = e.target.parentElement.querySelector('.euro');
	  if (euroDiv) euroDiv.textContent = fmt(sp.amount);
      //e.target.parentElement.querySelector('div[style*="color:var(--muted)"]').textContent = fmt(sp.amount);
      updateSummary();
    });
  });
}

// ---------- Summary & stacked bar ----------
function updateSummary(){
  // compute totals
  let totalPct = 0;
  const breakdown = {};
  territorialLevels.forEach(l=>{
    const v = slidersState[l.key] || 0;
    breakdown[l.key] = v;
    totalPct += v;
  });
  // add projects percentages
  selectedProjects.forEach(sp=>{
    totalPct += sp.pct || 0;
  });
  
  const totalAmount = Math.round(totalPct / 100 * currentAmount);

  // update UI total
  q("#totalPercent").textContent = totalPct + "%";
  q("#totalAmount").textContent = fmt(totalAmount);
  const msg = q("#percentMsg");
  if(totalPct === 100){
    msg.textContent = "Répartition complète.";
    msg.style.color = "";
  } else if(totalPct < 100){
    msg.textContent = `Il manque ${100-totalPct}% soit ${fmt(Math.round((100-totalPct) / 100 * currentAmount))} à répartir — ajustez vos curseurs.`;
    msg.style.color = "#e67e22";
  } else {
    msg.textContent = `Surcharge de ${totalPct-100}% soit ${fmt(Math.round((totalPct-100) / 100 * currentAmount))} — ajustez vos curseurs.`;
    msg.style.color = "#e53e3e";
  }

  // stacked bar: clear
  const stack = q("#stackBar");
  stack.innerHTML = "";
  // territory segments
  territorialLevels.forEach(l=>{
    const pct = breakdown[l.key] || 0;
    const seg = document.createElement("div");
    seg.className = "stack-seg";
    seg.style.width = pct + "%";
    seg.style.background = l.color;
    seg.title = `${l.label} — ${pct}%`;
    stack.appendChild(seg);
  });
  // project segments (gold color)
  selectedProjects.forEach(sp=>{
    const seg = document.createElement("div");
    seg.className = "stack-seg";
    seg.style.width = (sp.pct || 0) + "%";
    seg.style.background = "#ffcc66";
    seg.title = `${sp.title} — ${sp.pct || 0}%`;
    stack.appendChild(seg);
  });

  // list of amounts
  /*
  const amountList = q("#amountList");
  amountList.innerHTML = "";
  territorialLevels.forEach(l=>{
    const pct = breakdown[l.key] || 0;
    const line = document.createElement("div");
    line.className = "calc-line";
    line.innerHTML = `<div>${l.label} <small class="muted">${pct}%</small></div><div><strong>${fmt(pct/100*currentAmount)}</strong></div>`;
    amountList.appendChild(line);
  });
  if(selectedProjects.length){
    selectedProjects.forEach(sp=>{
      const line = document.createElement("div");
      line.className = "calc-line";
      line.innerHTML = `<div>${sp.title} <small class="muted">${sp.pct}%</small></div><div><strong>${fmt(sp.pct/100*currentAmount)}</strong></div>`;
      amountList.appendChild(line);
    });
  }*/

  // compute project.amount values
  selectedProjects.forEach(sp=>{
    sp.amount = Math.round(sp.pct/100*currentAmount);
  });

  // enable validate button only if totalPct == 100 and territorial minima respected
  let ok = totalPct === 100;
  // check each territory >= min
  territorialLevels.forEach(l=>{
    const v = breakdown[l.key] || 0;
    if(v < l.min) ok = false;
  });
  q("#btnValidate").disabled = !ok;
}

// ---------- Submit donation ----------
function submitDonation(){
  // snapshot
  const newId = "d" + (donationsHistory.length + 1);
  // build breakdown object
  const breakdown = {};
  territorialLevels.forEach(l=> breakdown[l.key] = slidersState[l.key] || 0);
  selectedProjects.forEach(sp=> breakdown[`proj_${sp.id}`] = sp.pct || 0);
  const record = {
    id:newId,
    date: new Date().toISOString().slice(0,10),
    amount: currentAmount,
    breakdown,
    targets: selectedProjects.map(sp=>({id:sp.id,pct:sp.pct,amount:sp.amount}))
  };
  donationsHistory.unshift(record);
  renderHistory();
  // feedback
  alert("Merci — votre don a bien été enregistré. Vous pouvez télécharger votre reçu (aperçu).");
  // reset projects & keep territorial defaults
  selectedProjects = [];
  territorialLevels.forEach(l=> {
    slidersState[l.key] = l.default;
    const range = document.querySelector(`input[data-key="${l.key}"]`);
    range.value = l.default;
    range.nextElementSibling.querySelector(".pct-val").textContent = l.default;
    range.parentElement.querySelector(".euro").textContent = fmt(l.default/100*currentAmount);
  });
  renderSelectedProjects();
  updateSummary();
}

// ---------- Preview / Download receipt ----------
function previewReceipt(){
  // build a simple receipt text and prompt download
  const id = "r-" + Date.now();
  const textLines = [];
  textLines.push("ANDIC — Reçu de don");
  textLines.push("Référence : " + id);
  textLines.push("Date : " + new Date().toISOString().slice(0,10));
  textLines.push("Montant : " + fmt(currentAmount));
  textLines.push("");
  textLines.push("Répartition :");
  territorialLevels.forEach(l=>{
    const pct = slidersState[l.key] || 0;
    textLines.push(` - ${l.label} : ${pct}% → ${fmt(pct/100*currentAmount)}`);
  });
  if(selectedProjects.length){
    textLines.push("Projets ciblés :");
    selectedProjects.forEach(sp=>{
      textLines.push(` - ${sp.title} : ${sp.pct}% → ${fmt(sp.pct/100*currentAmount)}`);
    });
  }
  textLines.push("");
  textLines.push("Merci pour votre soutien à la vie culturelle.");

  const blob = new Blob([textLines.join("\n")], {type:"text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `andic_receipt_${id}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Render history ----------
function renderHistory(){
  const h = q("#historyList");
  h.innerHTML = "";
  donationsHistory.forEach(d=>{
    const it = document.createElement("div");
    it.className = "history-item";
    it.innerHTML = `
      <div class="left">
        <div class="date">${d.date}</div>
        <div class="small">${d.targets.length ? d.targets.length + " projets ciblés" : "Pas de projet ciblé"}</div>
      </div>
      <div>
        <div style="font-weight:800">${fmt(d.amount)}</div>
        <div style="margin-top:8px;display:flex;gap:8px;justify-content:flex-end">
          <button data-id="${d.id}" class="download receipt">Télécharger reçu</button>
        </div>
      </div>
    `;
    h.appendChild(it);
    it.querySelector(".download.receipt").addEventListener("click", ()=> {
      downloadReceiptFromRecord(d);
    });
  });
}

function downloadReceiptFromRecord(d){
  const id = d.id;
  const textLines = [];
  textLines.push("ANDIC — Reçu de don");
  textLines.push("Référence : " + id);
  textLines.push("Date : " + d.date);
  textLines.push("Montant : " + fmt(d.amount));
  textLines.push("");
  textLines.push("Répartition :");
  for(const k in d.breakdown){
    const pct = d.breakdown[k];
    if(pct === 0) continue;
    textLines.push(` - ${k} : ${pct}% → ${fmt(pct/100*d.amount)}`);
  }
  textLines.push("");
  textLines.push("Merci pour votre soutien à la vie culturelle.");
  const blob = new Blob([textLines.join("\n")], {type:"text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `andic_receipt_${id}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Carte interactive Leaflet ----------
function initMap() {
  const mapContainer = document.getElementById("map");
  if (!mapContainer) return; // sécurité

  // Création de la carte centrée sur la France
  const map = L.map("map").setView([46.8, 2.5], 6);
  L.Control.geocoder().addTo(map);

  // Fond de carte
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  // Exemple de projets avec coordonnées
  const geoProjects = [
    { id: 1, title: "MJC - Atelier théâtre", coords: [45.1885, 5.7245], location: "Grenoble" },
    { id: 2, title: "Théâtre municipal - Création", coords: [47.2184, -1.5536], location: "Nantes" },
    { id: 3, title: "École de musique - Matériel", coords: [45.764, 4.8357], location: "Lyon" },
    { id: 4, title: "Rénovation patrimoine - Chapelle", coords: [44.8378, -0.5792], location: "Bordeaux" },
    { id: 5, title: "Festival local - scène", coords: [48.0061, 0.1996], location: "Le Mans" },
  ];

  geoProjects.forEach(p => {
    const marker = L.marker(p.coords).addTo(map);
    marker.bindPopup(`
      <b>${p.title}</b><br>${p.location}<br>
      <button class="popup-btn" onclick="addProjectById(${p.id})">Ajouter à ma sélection</button>
    `);
  });
}


// ---------- Start ----------
init();
renderSelectedProjects();
updateSummary();
initMap(); // 🗺️ Initialise la carte à la fin


