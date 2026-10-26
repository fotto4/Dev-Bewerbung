(function(){
'use strict';
// Functions
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const todayStr=()=>new Date().toISOString().slice(0,10);
const fmtDate=d=>d?new Date(d+'T00:00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}):'';
const PRIO={hoch:0,mittel:1,niedrig:2};
const COLS=[{id:'todo',label:'Zu erledigen'},{id:'doing',label:'In Arbeit'},{id:'done',label:'Erledigt'}];

// Storage
const Store={
  key:'taskflow.v1',
  load(){try{const r=localStorage.getItem(this.key);return r?JSON.parse(r):null}catch(e){return null}},
  save(d){try{localStorage.setItem(this.key,JSON.stringify(d))}catch(e){}}
};

// Reset shortcut
let state=Store.load()||{tasks:[],theme:'auto',pomoCount:0};
if(!Array.isArray(state.tasks))state.tasks=[];
const history=[];
function snapshot(){history.push(JSON.stringify(state.tasks));if(history.length>50)history.shift()}
function commit(msg){Store.save(state);render();if(msg)toast(msg)}
function undo(){
  if(!history.length)return toast('Nichts zum Rückgängigmachen');
  state.tasks=JSON.parse(history.pop());commit('Rückgängig gemacht');
}

//  Timer 
let toastTimer;
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),1800)}

//  Tags 
function addTask(){
  const title=$('#title').value.trim();
  if(!title)return toast('Bitte einen Titel eingeben');
  snapshot();
  const tags=$('#tags').value.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean);
  state.tasks.push({id:uid(),title,prio:$('#prio').value,due:$('#due').value||'',tags:[...new Set(tags)],status:'todo',created:Date.now(),done:null});
  $('#title').value='';$('#tags').value='';$('#due').value='';
  commit('Aufgabe hinzugefügt');
}
function findTask(id){return state.tasks.find(t=>t.id===id)}
function moveTask(id,status){
  const t=findTask(id);if(!t||t.status===status)return;
  snapshot();t.status=status;t.done=status==='done'?Date.now():null;commit();
}
function deleteTask(id){snapshot();state.tasks=state.tasks.filter(t=>t.id!==id);commit('Gelöscht')}
function editTitle(id){
  const t=findTask(id);if(!t)return;
  const n=prompt('Titel bearbeiten:',t.title);
  if(n&&n.trim()){snapshot();t.title=n.trim();commit('Aktualisiert')}
}
function cyclePrio(id){
  const t=findTask(id);if(!t)return;
  const order=['niedrig','mittel','hoch'];
  snapshot();t.prio=order[(order.indexOf(t.prio)+1)%3];commit();
}
function clearDone(){
  const n=state.tasks.filter(t=>t.status==='done').length;
  if(!n)return toast('Keine erledigten Aufgaben');
  snapshot();state.tasks=state.tasks.filter(t=>t.status!=='done');commit(n+' erledigte entfernt');
}

//  Filter and sort
function visibleTasks(){
  const q=$('#search').value.trim().toLowerCase();
  const fp=$('#fPrio').value,ft=$('#fTag').value,so=$('#sort').value;
  let list=state.tasks.filter(t=>{
    if(q&&!(t.title.toLowerCase().includes(q)||t.tags.some(x=>x.includes(q))))return false;
    if(fp&&t.prio!==fp)return false;
    if(ft&&!t.tags.includes(ft))return false;
    return true;
  });
  const cmp={
    due:(a,b)=>(a.due||'9999').localeCompare(b.due||'9999'),
    prio:(a,b)=>PRIO[a.prio]-PRIO[b.prio],
    alpha:(a,b)=>a.title.localeCompare(b.title,'de'),
    manual:(a,b)=>a.created-b.created
  }[so];
  return list.sort(cmp);
}

// Stats
function renderStats(){
  const all=state.tasks,n=all.length;
  const done=all.filter(t=>t.status==='done').length;
  const doing=all.filter(t=>t.status==='doing').length;
  const late=all.filter(t=>t.due&&t.due<todayStr()&&t.status!=='done').length;
  const week=all.filter(t=>t.done&&Date.now()-t.done<6048e5).length;
  const items=[[n,'Gesamt'],[doing,'In Arbeit'],[done,'Erledigt'],[late,'Überfällig'],[week,'Diese Woche erledigt'],[state.pomoCount||0,'Fokus-Runden']];
  $('#stats').innerHTML=items.map(([v,l])=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#progress').style.width=(n?Math.round(done/n*100):0)+'%';
}

// Rendering
function renderTagFilter(){
  const sel=$('#fTag'),cur=sel.value;
  const tags=[...new Set(state.tasks.flatMap(t=>t.tags))].sort();
  sel.innerHTML='<option value="">Alle Tags</option>'+tags.map(t=>`<option>${esc(t)}</option>`).join('');
  sel.value=tags.includes(cur)?cur:'';
}
function cardHTML(t){
  const late=t.due&&t.due<todayStr()&&t.status!=='done';
  return `<div class="task p-${t.prio} ${t.status==='done'?'done':''}" draggable="true" data-id="${t.id}">
    <div class="t" data-act="edit">${esc(t.title)}</div>
    <div class="meta"><span>⚑ ${t.prio}</span>${t.due?`<span class="${late?'late':''}">📅 ${fmtDate(t.due)}${late?' (überfällig)':''}</span>`:''}${t.tags.map(x=>`<span class="tag">#${esc(x)}</span>`).join('')}</div>
    <div class="acts"><button data-act="prio">Prio</button>${t.status!=='todo'?'<button data-act="left">←</button>':''}${t.status!=='done'?'<button data-act="right">→</button>':''}<button data-act="del">🗑</button></div>
  </div>`;
}
function render(){
  renderTagFilter();renderStats();
  const list=visibleTasks();
  $('#board').innerHTML=COLS.map(c=>{
    const items=list.filter(t=>t.status===c.id);
    return `<section class="col" data-col="${c.id}"><h2>${c.label} (${items.length})${c.id==='done'&&items.length?' <button data-act="clear" style="float:right;padding:0 6px;font-size:11px">leeren</button>':''}</h2>${items.map(cardHTML).join('')||'<div class="hint">Keine Aufgaben</div>'}</section>`;
  }).join('');
}

//  Board-Events 
$('#board').addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;
  if(b.dataset.act==='clear')return clearDone();
  const card=b.closest('.task');if(!card)return;
  const id=card.dataset.id,t=findTask(id);if(!t)return;
  const idx=COLS.findIndex(c=>c.id===t.status);
  switch(b.dataset.act){
    case 'del':deleteTask(id);break;
    case 'prio':cyclePrio(id);break;
    case 'right':moveTask(id,COLS[Math.min(2,idx+1)].id);break;
    case 'left':moveTask(id,COLS[Math.max(0,idx-1)].id);break;
  }
});
$('#board').addEventListener('dblclick',e=>{
  const t=e.target.closest('[data-act="edit"]');if(t)editTitle(t.closest('.task').dataset.id);
});
let dragId=null;
$('#board').addEventListener('dragstart',e=>{const c=e.target.closest('.task');if(c){dragId=c.dataset.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragId)}});
$('#board').addEventListener('dragover',e=>{const c=e.target.closest('.col');if(c){e.preventDefault();document.querySelectorAll('.col').forEach(x=>x.classList.toggle('over',x===c))}});
$('#board').addEventListener('dragleave',e=>{if(!e.relatedTarget||!e.relatedTarget.closest||!e.relatedTarget.closest('#board'))document.querySelectorAll('.col').forEach(x=>x.classList.remove('over'))});
$('#board').addEventListener('drop',e=>{
  const c=e.target.closest('.col');e.preventDefault();
  document.querySelectorAll('.col').forEach(x=>x.classList.remove('over'));
  if(c&&dragId)moveTask(dragId,c.dataset.col);dragId=null;
});

// Export / Import 
function exportData(){
  const blob=new Blob([JSON.stringify({version:1,tasks:state.tasks},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='taskflow-'+todayStr()+'.json';document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),500);
  toast('Export gestartet');
}
function importData(file){
  const r=new FileReader();
  r.onload=()=>{
    try{
      const d=JSON.parse(r.result);
      if(!d||!Array.isArray(d.tasks))throw new Error('Format');
      const clean=d.tasks.filter(t=>t&&typeof t.title==='string').map(t=>({
        id:String(t.id||uid()),title:t.title.slice(0,300),
        prio:PRIO[t.prio]!==undefined?t.prio:'mittel',due:/^\d{4}-\d{2}-\d{2}$/.test(t.due||'')?t.due:'',
        tags:Array.isArray(t.tags)?t.tags.map(String).slice(0,10):[],
        status:COLS.some(c=>c.id===t.status)?t.status:'todo',created:+t.created||Date.now(),done:t.done||null}));
      snapshot();state.tasks=clean;commit(clean.length+' Aufgaben importiert');
    }catch(err){toast('Import fehlgeschlagen: ungültige Datei')}
  };
  r.readAsText(file);
}

// Theme
function applyTheme(){
  const root=document.documentElement;
  if(state.theme==='auto')root.removeAttribute('data-theme');else root.setAttribute('data-theme',state.theme);
}
function cycleTheme(){
  const o=['auto','light','dark'];state.theme=o[(o.indexOf(state.theme)+1)%3];
  Store.save(state);applyTheme();toast('Theme: '+state.theme);
}

// Timer 
const Pomo={left:25*60,timer:null,running:false,mode:25,
  fmt(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')},
  show(){$('#clock').textContent=this.fmt(this.left);document.title=(this.running?this.fmt(this.left)+' · ':'')+'TaskFlow'},
  setMode(m){this.mode=+m;this.reset()},
  toggle(){
    if(this.running){clearInterval(this.timer);this.running=false;$('#pStart').textContent='Weiter';}
    else{this.running=true;$('#pStart').textContent='Pause';
      this.timer=setInterval(()=>{this.left--;if(this.left<=0)this.finish();this.show()},1000)}
    this.show();
  },
  reset(){clearInterval(this.timer);this.running=false;this.left=this.mode*60;$('#pStart').textContent='Start';$('#pInfo').textContent='';this.show()},
  finish(){
    clearInterval(this.timer);this.running=false;this.left=0;$('#pStart').textContent='Start';
    if(this.mode>=25){state.pomoCount=(state.pomoCount||0)+1;Store.save(state);renderStats()}
    $('#pInfo').textContent='Fertig! ';toast('Zeit abgelaufen');this.beep();
  },
  beep(){
    try{const ac=new (window.AudioContext||window.webkitAudioContext)(),o=ac.createOscillator(),g=ac.createGain();
      o.connect(g);g.connect(ac.destination);g.gain.value=.08;o.frequency.value=880;o.start();o.stop(ac.currentTime+.4)}catch(e){}
  }
};

// Events
$('#addBtn').onclick=addTask;
$('#title').addEventListener('keydown',e=>{if(e.key==='Enter')addTask()});
['#search','#fPrio','#fTag','#sort'].forEach(s=>$(s).addEventListener('input',render));
$('#undoBtn').onclick=undo;
$('#exportBtn').onclick=exportData;
$('#importBtn').onclick=()=>$('#fileIn').click();
$('#fileIn').onchange=e=>{if(e.target.files[0])importData(e.target.files[0]);e.target.value=''};
$('#themeBtn').onclick=cycleTheme;
$('#pStart').onclick=()=>Pomo.toggle();
$('#pReset').onclick=()=>Pomo.reset();
$('#pomoMode').onchange=e=>Pomo.setMode(e.target.value);
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){e.preventDefault();undo()}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#search').focus()}
});

//  Start 
if(!state.tasks.length){
  state.tasks=[
    {id:uid(),title:'Willkommen bei TaskFlow ',prio:'mittel',due:'',tags:['start'],status:'todo',created:Date.now(),done:null},
    {id:uid(),title:'Diese Karte nach „In Arbeit“ ziehen',prio:'hoch',due:todayStr(),tags:['demo'],status:'doing',created:Date.now()+1,done:null},
    {id:uid(),title:'Fokus-Timer ausprobieren',prio:'niedrig',due:'',tags:['demo'],status:'done',created:Date.now()+2,done:Date.now()}
  ];
}
applyTheme();render();Pomo.show();
})();