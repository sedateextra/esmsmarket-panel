// ── ui/borclar.js ─────────────────────────────────────────────
import { state } from '../config.js';
import { db, addLog } from '../data.js';
import { fmt, nowStr, showLoading } from '../utils.js';
import { tgBorcOdeme } from '../telegram.js';
import { updateKasaMetrics } from './kasa.js';

let borcEditId = null;
let borcPaymentTargetId = null;

const statusStyle = s => s==="Ödendi"
  ? "background:rgba(16,185,129,.15);color:var(--success);border:1px solid rgba(16,185,129,.3)"
  : s==="Kısmi ödendi"
  ? "background:rgba(245,158,11,.15);color:var(--warning);border:1px solid rgba(245,158,11,.3)"
  : "background:rgba(239,68,68,.15);color:var(--danger);border:1px solid rgba(239,68,68,.3)";

export function renderBorcular(){
  const tbody = document.getElementById("borc-body"); if(!tbody) return;
  const q  = (document.getElementById("borc-search")?.value||"").toLowerCase();
  const sf = document.getElementById("borc-status-filter")?.value||"";
  const filtered = state.borclar.filter(b=>
    (!q || b.name.toLowerCase().includes(q)||(b.note||"").toLowerCase().includes(q)) &&
    (!sf || b.status===sf)
  );
  document.getElementById("no-borc").style.display = filtered.length?"none":"block";
  const today = new Date();
  tbody.innerHTML = filtered.map(b=>{
    const kalan = (b.amount||0)-(b.paid||0);
    const createdDate = b.created_at
      ? new Date(b.created_at).toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"})
      : "—";
    return `<tr>
      <td style="font-weight:600">${b.name}</td>
      <td style="font-weight:700;color:var(--danger)">${fmt(b.amount)}</td>
      <td style="color:var(--success)">${fmt(b.paid||0)}</td>
      <td style="font-weight:700;color:${kalan>0?"var(--warning)":"var(--success)"}">${fmt(kalan)}</td>
      <td><span class="sbadge" style="${statusStyle(b.status)}">${b.status}</span></td>
      <td style="font-size:11px;color:var(--text3)">${createdDate}</td>
      <td style="font-size:11px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${b.note||""}">${b.note||"—"}</td>
      <td><div class="inline-actions">
        <button class="btn-xs" onclick="openBorcPayment(${b.id})" title="Ödeme al" style="border-color:rgba(16,185,129,.4);color:var(--success)"><i class="ti ti-cash"></i></button>
        <button class="btn-xs" onclick="openBorcModal(${b.id})" title="Düzenle"><i class="ti ti-edit"></i></button>
        <button class="btn-danger-sm" onclick="deleteBorc(${b.id})" title="Sil"><i class="ti ti-trash"></i></button>
      </div></td>
    </tr>`;
  }).join("");
  updateBorcMetrics();
  renderBorcStatusChart();
}

function updateBorcMetrics(){
  const active   = state.borclar.filter(b=>b.status!=="Ödendi");
  const totalBorc= state.borclar.reduce((s,b)=>s+(b.amount||0),0);
  const totalPaid= state.borclar.reduce((s,b)=>s+(b.paid||0),0);
  const kalanBorc= state.borclar.reduce((s,b)=>s+(b.amount||0)-(b.paid||0),0);
  const today2   = new Date();
  const todayBorc= state.borclar.filter(b=>b.created_at&&new Date(b.created_at).toDateString()===today2.toDateString());
  const $=id=>document.getElementById(id);
  if($("b-count"))     $("b-count").textContent=active.length;
  if($("b-count-sub")) $("b-count-sub").textContent=state.borclar.filter(b=>b.status==="Ödendi").length+" ödendi";
  if($("b-total"))     $("b-total").textContent=fmt(totalBorc);
  if($("b-kalan-sub")) $("b-kalan-sub").textContent="Kalan: "+fmt(kalanBorc);
  if($("b-paid"))      $("b-paid").textContent=fmt(totalPaid);
  if($("b-paid-sub"))  $("b-paid-sub").textContent=Math.round((totalPaid/Math.max(totalBorc,1))*100)+"% tahsil edildi";
  if($("b-today"))     $("b-today").textContent=fmt(todayBorc.reduce((s,b)=>s+(b.amount||0),0));
  if($("b-today-sub")) $("b-today-sub").textContent=todayBorc.length+" borçlu bugün eklendi";
}

function renderBorcStatusChart(){
  const el=document.getElementById("borc-status-chart"); if(!el) return;
  const cats={"Ödenmedi":0,"Kısmi ödendi":0,"Ödendi":0};
  state.borclar.forEach(b=>{if(cats[b.status]!==undefined)cats[b.status]++;});
  const total=state.borclar.length||1;
  const colors={"Ödenmedi":"var(--danger)","Kısmi ödendi":"var(--warning)","Ödendi":"var(--success)"};
  el.innerHTML=state.borclar.length?Object.entries(cats).map(([s,cnt])=>{
    const pct=Math.round((cnt/total)*100);
    return `<div class="type-item"><div class="type-hdr"><div class="type-name"><i class="ti ti-circle-dot" style="color:${colors[s]}"></i>${s}</div><div class="type-stats"><span class="type-cnt">${cnt} kişi</span><span class="type-tot">${pct}%</span></div></div><div class="bar-bg"><div class="bar-fg" style="width:${pct}%;background:${colors[s]}"></div></div></div>`;
  }).join(""):'<div style="font-size:12px;color:var(--text3);text-align:center;padding:1rem">Kayıt yok.</div>';
}

export function openBorcModal(id){
  borcEditId=id||null;
  if(id){
    const b=state.borclar.find(x=>x.id===id);
    document.getElementById("borc-modal-title").textContent="Borcu düzenle";
    document.getElementById("borc-name").value=b.name;
    document.getElementById("borc-amount").value=b.amount||0;
    document.getElementById("borc-paid-input").value=b.paid||0;
    document.getElementById("borc-status-input").value=b.status||"Ödenmedi";
    document.getElementById("borc-note").value=b.note||"";
  } else {
    document.getElementById("borc-modal-title").textContent="Borçlu ekle";
    ["borc-name","borc-note"].forEach(i=>document.getElementById(i).value="");
    ["borc-amount","borc-paid-input"].forEach(i=>document.getElementById(i).value="0");
    document.getElementById("borc-status-input").value="Ödenmedi";
  }
  document.getElementById("borc-kalan-info").style.display="none";
  document.getElementById("borc-modal-overlay").classList.add("open");
}

export function closeBorcModal(){ document.getElementById("borc-modal-overlay").classList.remove("open"); borcEditId=null; }

export function calcBorcKalan(){
  const amt=parseFloat(document.getElementById("borc-amount").value)||0;
  const paid=parseFloat(document.getElementById("borc-paid-input").value)||0;
  const kalan=amt-paid;
  const info=document.getElementById("borc-kalan-info");
  if(amt>0){
    info.style.display="block";
    info.innerHTML=`<i class="ti ti-calculator" style="margin-right:4px"></i>Kalan borç: ${fmt(kalan)}`;
    info.style.color=kalan>0?"var(--danger)":"var(--success)";
    info.style.background=kalan>0?"rgba(239,68,68,.1)":"rgba(16,185,129,.1)";
    info.style.borderColor=kalan>0?"rgba(239,68,68,.3)":"rgba(16,185,129,.3)";
  } else { info.style.display="none"; }
}

export async function saveBorc(){
  const name=document.getElementById("borc-name").value.trim();
  const amount=parseFloat(document.getElementById("borc-amount").value)||0;
  const paid=parseFloat(document.getElementById("borc-paid-input").value)||0;
  const status=document.getElementById("borc-status-input").value;
  const note=document.getElementById("borc-note").value.trim();
  if(!name||!amount){alert("İsim ve borç tutarı zorunludur.");return;}
  showLoading(true);
  if(borcEditId){
    await db.from("borclar").update({name,amount,paid,status,note}).eq("id",borcEditId);
    const b=state.borclar.find(x=>x.id===borcEditId);
    Object.assign(b,{name,amount,paid,status,note});
    await addLog("edit","Borç güncellendi — "+fmt(amount),name);
  } else {
    const newB={name,amount,paid:paid||0,status,note,payments:[]};
    const {data}=await db.from("borclar").insert(newB).select();
    if(data&&data[0]) state.borclar.unshift({...data[0],payments:data[0].payments||[]});
    await addLog("add","Borçlu eklendi — "+fmt(amount),name);
  }
  showLoading(false);
  closeBorcModal();
  renderBorcular();
}

export async function deleteBorc(id){
  const b=state.borclar.find(x=>x.id===id);
  if(!confirm(`"${b.name}" borç kaydı silinsin mi?`)) return;
  showLoading(true);
  await db.from("borclar").delete().eq("id",id);
  state.borclar=state.borclar.filter(x=>x.id!==id);
  await addLog("delete","Borçlu silindi",b.name);
  showLoading(false);
  renderBorcular();
}

export function openBorcPayment(id){
  borcPaymentTargetId=id;
  const b=state.borclar.find(x=>x.id===id);
  const kalan=(b.amount||0)-(b.paid||0);
  document.getElementById("payment-modal-title").textContent=b.name+" — ödeme al";
  document.getElementById("payment-borc-info").innerHTML=`
    <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--text2)">Toplam borç</span><span style="font-weight:700;color:var(--danger)">${fmt(b.amount)}</span></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--text2)">Ödenen</span><span style="font-weight:700;color:var(--success)">${fmt(b.paid||0)}</span></div>
    <div style="display:flex;justify-content:space-between"><span style="color:var(--text2)">Kalan</span><span style="font-weight:700;color:var(--warning)">${fmt(kalan)}</span></div>`;
  document.getElementById("payment-amount").value="";
  document.getElementById("payment-note").value="";
  document.getElementById("borc-payment-overlay").classList.add("open");
}

export function closeBorcPayment(){ document.getElementById("borc-payment-overlay").classList.remove("open"); borcPaymentTargetId=null; }

export async function saveBorcPayment(){
  const amt=parseFloat(document.getElementById("payment-amount").value)||0;
  const note=document.getElementById("payment-note").value.trim();
  if(!amt){alert("Tutar zorunludur.");return;}
  const b=state.borclar.find(x=>x.id===borcPaymentTargetId);
  b.paid=(b.paid||0)+amt;
  if(!b.payments) b.payments=[];
  b.payments.push({amount:amt,note,date:nowStr()});
  if(b.paid>=b.amount) b.status="Ödendi";
  else if(b.paid>0) b.status="Kısmi ödendi";
  showLoading(true);
  await db.from("borclar").update({paid:b.paid,status:b.status,payments:b.payments}).eq("id",b.id);
  // Kasaya nakit gelir olarak ekle
  const tx={cust_id:"borc",cust_name:b.name,amount:amt,bonus:0,total:amt,type:"Havale",note:"Borç ödemesi: "+note,date:new Date().toLocaleDateString("tr-TR"),user_name:state.currentUser,cancelled:false};
  const {data:txData}=await db.from("transactions").insert(tx).select();
  if(txData&&txData[0]) state.transactions.unshift(txData[0]);
  await addLog("add",`Ödeme alındı — ${fmt(amt)}`,b.name);
  await tgBorcOdeme(b,amt);
  showLoading(false);
  closeBorcPayment();
  renderBorcular();
  updateKasaMetrics();
}
