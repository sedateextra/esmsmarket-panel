// ── ui/customers.js ───────────────────────────────────────────
import { state, PAGE_SIZE, USD_TRY, PRICE_USD } from '../config.js';
import { db, addLog } from '../data.js';
import { fmt, nowStr, todayStr, showLoading, showToast, parseSince } from '../utils.js';
import { tgYeniUye } from '../telegram.js';

const PRICE_TRY = PRICE_USD * USD_TRY;

// ── Filtre ve arama ───────────────────────────────────────────
export function setDateFilter(f, el){
  state.dateFilter = f;
  document.querySelectorAll(".chip").forEach(c=>c.classList.remove("active"));
  el.classList.add("active");
  state.custPage = 0;
  renderCustomers();
}

function getFiltered(){
  const q = (document.getElementById("cust-search")?.value||"").toLowerCase();
  const now = new Date();
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate()-7);
  const monthStart = new Date(now.getFullYear(),now.getMonth(),1);
  return state.customers.filter(c=>{
    const mQ = !q||(c.name.toLowerCase().includes(q)||c.email.toLowerCase().includes(q)||(c.id||"").toLowerCase().includes(q));
    const d = parseSince(c.since||"");
    let mF = true;
    if(state.dateFilter==="today"&&d)    mF = d.toDateString()===now.toDateString();
    else if(state.dateFilter==="week"&&d)  mF = d>=weekAgo;
    else if(state.dateFilter==="month"&&d) mF = d>=monthStart;
    else if(state.dateFilter==="positive") mF = (c.balance||0)>0;
    else if(state.dateFilter==="zero")     mF = (c.balance||0)===0;
    return mQ && mF;
  });
}

// ── Render ────────────────────────────────────────────────────
export function renderCustomers(){
  const el = document.getElementById("cust-body");
  if(!el) return;
  const filtered = getFiltered();
  const total = filtered.length;
  const totalPages = Math.max(1,Math.ceil(total/PAGE_SIZE));
  if(state.custPage >= totalPages) state.custPage = totalPages-1;
  const slice = filtered.slice(state.custPage*PAGE_SIZE,(state.custPage+1)*PAGE_SIZE);

  el.innerHTML = slice.map(c=>{
    const nc = Math.floor((c.balance||0)/PRICE_TRY);
    return `<tr>
      <td style="color:var(--text3);font-size:11px">${c.id}</td>
      <td onclick="openCustDetail('${c.id}')" style="cursor:pointer;font-weight:600">${c.name}</td>
      <td style="color:var(--text2);font-size:11px" title="${c.email}">${c.email}</td>
      <td style="font-weight:700;color:${(c.balance||0)>0?"var(--success)":"var(--text3)"}">${fmt(c.balance)}</td>
      <td style="font-size:11px;color:var(--purple);font-weight:600">${nc>0?nc+" 🇹🇷":"—"}</td>
      <td style="color:var(--text3);font-size:11px" id="last-tx-${c.id}">—</td>
      <td style="color:var(--text3);font-size:11px">${c.notes&&c.notes.length>0?c.notes.length+" not":"—"}</td>
      <td><div class="inline-actions">
        <button class="btn-xs" onclick="openNoteModal('${c.id}')" title="Not ekle"><i class="ti ti-notes"></i></button>
        <button class="btn-xs" onclick="openCustomerModal('${c.id}')" title="Düzenle"><i class="ti ti-edit"></i></button>
        <button class="btn-danger-sm" onclick="deleteCustomer('${c.id}')" title="Sil"><i class="ti ti-trash"></i></button>
      </div></td>
    </tr>`;
  }).join("");

  document.getElementById("page-info").textContent = `${state.custPage+1} / ${totalPages}`;
  document.getElementById("total-info").textContent = `(${total} üye)`;
  document.getElementById("prev-btn").disabled = state.custPage===0;
  document.getElementById("next-btn").disabled = state.custPage>=totalPages-1;
  updateCustomerMetrics();
  updateLastTxDates();
}

export function changePage(dir){ state.custPage+=dir; renderCustomers(); }

export function updateCustomerMetrics(){
  const totalBal = state.customers.reduce((s,c)=>s+(c.balance||0),0);
  const totalNum = Math.floor(totalBal/PRICE_TRY);
  const el = id=>document.getElementById(id);
  if(el("m-count")) el("m-count").textContent = state.customers.length;
  if(el("m-balance")) el("m-balance").textContent = fmt(totalBal);
  if(el("m-balance-num")) el("m-balance-num").textContent = totalNum>0?"≈ "+totalNum+" TR numarası":"";
  if(el("m-with-balance")) el("m-with-balance").textContent = state.customers.filter(c=>(c.balance||0)>0).length;
  if(state.customers.length){
    if(el("m-newest")) el("m-newest").textContent = state.customers[0].name;
    if(el("m-newest-date")) el("m-newest-date").textContent = state.customers[0].since||"—";
  }
}

function updateLastTxDates(){
  state.customers.forEach(c=>{
    const el = document.getElementById("last-tx-"+c.id);
    if(!el) return;
    const custTx = state.transactions.filter(t=>t.cust_id===c.id&&!t.cancelled);
    if(!custTx.length){ el.textContent="—"; return; }
    const last = custTx.reduce((a,b)=>{
      const da = a.created_at?new Date(a.created_at):new Date(0);
      const db2 = b.created_at?new Date(b.created_at):new Date(0);
      return da>db2?a:b;
    });
    el.textContent = last.created_at
      ? new Date(last.created_at).toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"})
      : last.date||"—";
  });
}

// ── Üye detay ─────────────────────────────────────────────────
export function openCustDetail(id){
  const c = state.customers.find(x=>x.id===id); if(!c) return;
  const custTxs = state.transactions.filter(t=>t.cust_id===id&&!t.cancelled);
  const bal = c.balance||0;
  const nc = Math.floor(bal/PRICE_TRY);
  document.getElementById("cd-title").textContent = c.name;
  document.getElementById("cd-content").innerHTML = `
    <button class="btn-sm" onclick="openBalanceHistory('${c.id}')" style="margin-bottom:12px"><i class="ti ti-history"></i> Bakiye Geçmişi</button>
    <dl style="display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;font-size:13px;margin-bottom:1rem">
      <dt style="color:var(--text2)">ID</dt><dd style="font-weight:700;color:var(--purple)">${c.id}</dd>
      <dt style="color:var(--text2)">E-posta</dt><dd style="font-size:11px">${c.email}</dd>
      <dt style="color:var(--text2)">Bakiye</dt><dd style="font-weight:700;color:var(--success)">${fmt(bal)}</dd>
      <dt style="color:var(--text2)">Kayıt</dt><dd>${c.since||"—"}</dd>
    </dl>
    <div style="background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);border-radius:10px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:11px;color:var(--text2)"><i class="ti ti-device-sim" style="margin-right:5px;color:var(--purple)"></i>TR numarası ($1.02)</div>
      <div style="font-size:16px;font-weight:700;color:var(--purple)">${nc} adet</div>
    </div>
    ${c.notes&&c.notes.length>0?`<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--warning)"><i class="ti ti-notes" style="margin-right:4px"></i>Notlar</div><div style="margin-bottom:12px">${c.notes.map(n=>`<div class="note-item"><div class="note-meta"><span>${n.user}</span><span>${n.ts}</span></div><div class="note-text">${n.text}</div></div>`).join("")}</div>`:""}
    ${custTxs.length?`<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--text2)">İşlemler</div><table style="font-size:11px"><thead><tr><th>Tutar</th><th>Bonus</th><th>Tür</th><th>Tarih</th></tr></thead><tbody>${custTxs.map(t=>`<tr><td style="font-weight:700">${fmt(t.amount)}</td><td style="color:var(--success)">${t.bonus>0?fmt(t.bonus):"—"}</td><td><span class="tbadge" style="font-size:10px">${t.type}</span></td><td style="color:var(--text3)">${t.date}</td></tr>`).join("")}</tbody></table>`:'<div style="font-size:12px;color:var(--text3)">İşlem yok.</div>'}
  `;
  document.getElementById("cust-detail-overlay").classList.add("open");
}

// ── Üye modal ─────────────────────────────────────────────────
export function updateCmMethod(){
  const bal = parseFloat(document.getElementById("cm-balance")?.value)||0;
  const wrap = document.getElementById("cm-method-wrap");
  if(wrap) wrap.style.display=(!state.custEditId&&bal>0)?"block":"none";
}

export function openCustomerModal(id){
  state.custEditId = id||null;
  if(id){
    const c = state.customers.find(x=>x.id===id);
    document.getElementById("cm-title").textContent = "Üyeyi düzenle";
    document.getElementById("cm-name").value = c.name;
    document.getElementById("cm-email").value = c.email;
    document.getElementById("cm-balance").value = c.balance||0;
    const wrap = document.getElementById("cm-method-wrap");
    if(wrap) wrap.style.display="none";
  } else {
    document.getElementById("cm-title").textContent = "Yeni üye";
    ["cm-name","cm-email","cm-balance"].forEach(i=>document.getElementById(i).value="");
    const wrap = document.getElementById("cm-method-wrap");
    if(wrap) wrap.style.display="none";
  }
  document.getElementById("cust-modal-overlay").classList.add("open");
}

export function closeCustModal(){
  document.getElementById("cust-modal-overlay").classList.remove("open");
  state.custEditId = null;
}

export async function saveCustomer(){
  const name    = document.getElementById("cm-name").value.trim();
  const email   = document.getElementById("cm-email").value.trim();
  const balance = parseFloat(document.getElementById("cm-balance").value)||0;
  const method  = document.getElementById("cm-method")?.value||"Havale";
  if(!name||!email){ alert("Ad ve e-posta zorunludur."); return; }
  showLoading(true);
  if(state.custEditId){
    const c = state.customers.find(x=>x.id===state.custEditId);
    const oldBal = c.balance||0;
    await db.from("customers").update({name,email,balance}).eq("id",state.custEditId);
    Object.assign(c,{name,email,balance});
    if(Math.abs(oldBal-balance)>0.001){
      await db.from("balance_history").insert({
        cust_id:state.custEditId, cust_name:name,
        old_balance:oldBal, new_balance:balance, change_amount:balance-oldBal,
        reason:`Manuel bakiye düzenleme (${fmt(oldBal)} → ${fmt(balance)})`,
        user_name:state.currentUser
      });
    }
    await addLog("edit","Üye güncellendi",name);
  } else {
    const maxId = state.customers.reduce((m,c)=>{const n=parseInt((c.id||"#0").replace("#",""));return Math.max(m,n);},0);
    const newId = "#"+(maxId+1);
    const newC  = {id:newId,name,email,balance,since:todayStr(),notes:[]};
    await db.from("customers").insert(newC);
    state.customers.unshift(newC);
    if(balance>0){
      const tx = {cust_id:newId,cust_name:name,amount:balance,bonus:0,total:balance,type:method,note:"Açılış bakiyesi",date:todayStr(),user_name:state.currentUser,cancelled:false};
      const {data:txData} = await db.from("transactions").insert(tx).select();
      if(txData&&txData[0]) state.transactions.unshift(txData[0]);
      await db.from("balance_history").insert({cust_id:newId,cust_name:name,old_balance:0,new_balance:balance,change_amount:balance,reason:`Açılış bakiyesi (${method})`,user_name:state.currentUser});
    }
    await addLog("add","Yeni üye eklendi",name);
    await tgYeniUye(newC);
  }
  showLoading(false);
  closeCustModal();
  renderCustomers();
  populateCustSelect();
}

export async function deleteCustomer(id){
  const c = state.customers.find(x=>x.id===id);
  if(!confirm(`"${c.name}" silinsin mi?`)) return;
  showLoading(true);
  await db.from("customers").delete().eq("id",id);
  state.customers = state.customers.filter(x=>x.id!==id);
  await addLog("delete","Üye silindi",c.name);
  showLoading(false);
  renderCustomers();
  populateCustSelect();
}

// ── Not modal ─────────────────────────────────────────────────
export function openNoteModal(id){
  state.noteTargetId = id;
  const c = state.customers.find(x=>x.id===id);
  document.getElementById("note-modal-title").textContent = c.name+" — not ekle";
  document.getElementById("note-text").value = "";
  document.getElementById("note-modal-overlay").classList.add("open");
}

export function closeNoteModal(){
  document.getElementById("note-modal-overlay").classList.remove("open");
  state.noteTargetId = null;
}

export async function saveNote(){
  const text = document.getElementById("note-text").value.trim();
  if(!text){ alert("Not boş olamaz."); return; }
  const c = state.customers.find(x=>x.id===state.noteTargetId);
  if(!c.notes) c.notes=[];
  c.notes.unshift({text,user:state.currentUser,ts:nowStr()});
  await db.from("customers").update({notes:c.notes}).eq("id",state.noteTargetId);
  await addLog("edit","Not eklendi",c.name);
  closeNoteModal();
  renderCustomers();
}

// ── Üye select ────────────────────────────────────────────────
export function populateCustSelect(){ filterCustSelect(); }

export function filterCustSelect(){
  const q   = (document.getElementById("cust-select-search")?.value||"").toLowerCase();
  const sel = document.getElementById("new-cust-select");
  if(!sel) return;
  const cur = sel.value;
  const filtered = state.customers.filter(c=>!q||c.name.toLowerCase().includes(q)||(c.id||"").toLowerCase().includes(q));
  sel.innerHTML = filtered.map(c=>`<option value="${c.id}">${c.name} (${c.id})</option>`).join("");
  if(cur&&sel.querySelector(`option[value="${cur}"]`)) sel.value=cur;
}

// ── Bakiye geçmişi ────────────────────────────────────────────
export async function openBalanceHistory(custId){
  const cust = state.customers.find(c=>c.id===custId); if(!cust) return;
  const {data} = await db.from("balance_history").select("*").eq("cust_id",custId).order("created_at",{ascending:false}).limit(50);
  const history = data||[];
  const modal = document.createElement("div");
  modal.className="overlay-wrap";
  modal.style.cssText="display:flex;position:fixed;inset:0;z-index:9999";
  modal.innerHTML=`<div class="modal" style="max-width:500px">
    <div class="modal-hdr"><h3>Bakiye geçmişi — ${cust.name}</h3><button onclick="this.closest('.overlay-wrap').remove()"><i class="ti ti-x"></i></button></div>
    <div style="margin-bottom:12px;padding:10px;background:var(--card2);border-radius:10px;display:flex;justify-content:space-between">
      <span style="font-size:12px;color:var(--text2)">Mevcut bakiye</span>
      <span style="font-size:14px;font-weight:700;color:var(--success)">${fmt(cust.balance||0)}</span>
    </div>
    ${history.length===0?`<div style="text-align:center;padding:2rem;color:var(--text3)">Geçmiş bulunamadı.</div>`:`
    <div style="max-height:400px;overflow-y:auto;display:flex;flex-direction:column;gap:6px">
      ${history.map(h=>{
        const isPos=h.change_amount>=0;
        const dt=h.created_at?new Date(h.created_at).toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"})+" "+new Date(h.created_at).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"}):"—";
        return `<div style="background:var(--card2);border-radius:10px;padding:10px;display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;border-radius:8px;background:${isPos?"rgba(16,185,129,.15)":"rgba(239,68,68,.15)"};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="ti ${isPos?"ti-arrow-up":"ti-arrow-down"}" style="color:${isPos?"var(--success)":"var(--danger)"}"></i>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;color:var(--text)">${h.reason||"—"}</div>
            <div style="font-size:10px;color:var(--text3)">${dt} · ${h.user_name||"—"}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:13px;font-weight:700;color:${isPos?"var(--success)":"var(--danger)"}">${isPos?"+":""}${fmt(h.change_amount)}</div>
            <div style="font-size:10px;color:var(--text3)">${fmt(h.new_balance)}</div>
          </div>
        </div>`;
      }).join("")}
    </div>`}
  </div>`;
  document.body.appendChild(modal);
}
