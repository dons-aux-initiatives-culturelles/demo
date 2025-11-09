// porteur_dashboard.js — Page tableau de bord porteur

const projects = [
  { id:1, title:"Création : Soleil Levant", sub:"Théâtre contemporain", status:"published", date:"2025-09-15", img:"https://via.placeholder.com/400x200?text=Projet+1" },
  { id:2, title:"Atelier jeunesse - Découverte scénique", sub:"Projet d’éducation artistique", status:"funded", date:"2025-10-03", img:"https://via.placeholder.com/400x200?text=Projet+2" },
  { id:3, title:"Festival MJC en scène", sub:"Événement annuel", status:"pending", date:"2025-11-01", img:"https://via.placeholder.com/400x200?text=Projet+3" },
  { id:4, title:"Création partagée : Horizon", sub:"Théâtre musical", status:"closed", date:"2025-05-01", img:"https://via.placeholder.com/400x200?text=Projet+4" },
];


// ordre logique des statuts
const statusOrder = { pending: 1, published: 2, funded: 3, closed: 4 };


function renderProjects(){
  const container = document.getElementById('projectsList');
  container.innerHTML = '';

  // trier les projets avant affichage
  const sorted = [...projects].sort((a,b) => {
    const orderA = statusOrder[a.status] || 999;
    const orderB = statusOrder[b.status] || 999;
    if (orderA !== orderB) return orderA - orderB;
    // second critère : date (du plus récent au plus ancien)
    return new Date(b.date) - new Date(a.date);
  });

  sorted.forEach(p=>{
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <img src="${p.img}" class="project-thumb" alt="${p.title}">
      <div class="project-body">
        <div class="project-title">${p.title}</div>
        <div class="project-sub">${p.sub}</div>
        <div class="small muted">Publié le ${p.date}</div>
        <div class="status ${p.status}">
          ${statusLabel(p.status)}
        </div>
      </div>
    `;
	// si c’est le projet "Création : Soleil Levant", on ajoute un clic
    if (p.title.includes("Soleil Levant")) {
      card.style.cursor = "pointer";
      card.addEventListener("click", () => {
        window.location.href = "page_porteur.html";
      });
    }
    container.appendChild(card);
  });
}
function statusLabel(s){
  switch(s){
    case 'pending': return 'Déposé (en attente de publication)';
    case 'published': return 'Publié (en attente d\'attribution de dons)';
    case 'funded': return 'Dons attribués (en attente du rapport d\'activité)';
    case 'closed': return 'Finalisé';
    default: return s;
  }
}

document.addEventListener('DOMContentLoaded', renderProjects);
