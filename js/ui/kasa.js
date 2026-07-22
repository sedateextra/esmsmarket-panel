// ── ui/kasa.js ────────────────────────────────────────────────
import { state } from '../config.js';
import { db, addLog } from '../data.js';
import { fmt, todayStr, nowStr, showLoading, showToast } from '../utils.js';
import { sendTelegram } from '../telegram.js';
import { renderCustomers } from './customers.js';

// ── Sekme geçişi ──────────────────────────────────────────────
export function setKasaTab(tab, btn){
  state.kasaCurrentTab = tab;
  document.querySelectorAll("#page-kasa [id^='ktab-']").forEach(b=>{
    b.style.background="transparent"; b.style.color="var(--text2)";
  });
  btn.style.background="var(--grad)"; btn.style.color="#fff";

  const colWrap      = document.getElementById("shopier-collections-wrap");
  const kasaMetrics  = document.getElementById("kasa-tab-metrics");
  const kasaTableCard= document.querySelector("#page-kasa .card:has(#kasa-body)");

  if(tab==="shopier-col"){
    if(colWrap)       colWrap.style.display="block";
    if(kasaTableCard) kasaTableCard.style.display="none";
    document.querySelectorAll("#page-kasa .metric-top-bar").forEach(el=>el.style.display="none");
    import('./shopier.js').then(({loadShopierCollections})=>loadShopierCollections());
  } else {
    if(colWrap)       colWrap.style.display="none";
    if(kasaTableCard) kasaTableCard.style.display="block";
    const topBars = document.querySelectorAll("#page-kasa .metric-top-bar");
    if(tab==="all"){
      topBars.forEach(el=>el.style.display="grid");
      if(kasaMetrics) kasaMetrics.style.display="grid";
    } else {
      topBars.forEach(el=>el.style.display="none");
    }
    if(tab==="all" && (!state.shopierCollections||!state.shopierCollections.length)){
      import('./shopier.js').then(({loadShopierCollections})=>loadShopierCollections().then(()=>updateKasaMetrics()));
    } else {
      updateKasaMetrics();
    }
  }
}

// ── Ana kasa metrikleri ───────────────────────────────────────
export function updateKasaMetrics(){
  const active = state.transactions.filter(t=>!t.cancelled);
  const totalIncome   = active.reduce((s,t)=>s+t.amount,0);
  const totalBonus    = active.reduce((s,t)=>s+t.bonus,0);
  const totalExpense  = state.expenses.reduce((s,e)=>s+e.amount,0);
  const net           = totalIncome-totalBonus-totalExpense;
  const shopierKomTotal = state.expenses.filter(e=>e.type==="Shopier Komisyon").reduce((s,e)=>s+e.amount,0);
  const uyeCount      = new Set(active.map(t=>t.cust_id)).size;
  const shopierTxCount= active.filter(t=>t.user_name==="shopier-bot"||t.type==="Shopier").length;
  const manuelTxCount = active.length-shopierTxCount;

  const $ = id=>{const el=document.getElementById(id);return el;};
  if($("k-income"))    $("k-income").textContent=fmt(totalIncome);
  if($("k-income-sub")) $("k-income-sub").textContent=active.length+" işlem · "+shopierTxCount+" Shopier";
  if($("k-bonus"))     $("k-bonus").textContent=fmt(totalBonus);
  if($("k-bonus-sub")) $("k-bonus-sub").textContent=active.filter(t=>t.bonus>0).length+" işlemde bonus";
  if($("k-expense"))   $("k-expense").textContent=fmt(totalExpense);
  if($("k-expense-sub")) $("k-expense-sub").textContent=state.expenses.length+" gider kaydı";
  if($("k-komisyon"))  $("k-komisyon").textContent=fmt(shopierKomTotal);
  if($("k-uye-count")) $("k-uye-count").textContent=uyeCount;
  if($("k-uye-sub"))   $("k-uye-sub").textContent=manuelTxCount+" manuel · "+shopierTxCount+" Shopier";
  if($("k-net")){      $("k-net").textContent=fmt(net); $("k-net").style.color=net>=0?"var(--success)":"var(--danger)"; }
  if($("k-net-sub"))   $("k-net-sub").textContent="Gelir - Bonus - Gider";

  // Nakit kasa
  const nakitTotal = (state.nakitHareketler||[]).reduce((s,n)=>s+(n.amount||0),0);
  if($("k-nakit"))     $("k-nakit").textContent=fmt(nakitTotal);
  if($("k-nakit-sub")) $("k-nakit-sub").textContent=(state.nakitHareketler||[]).length+" hareket · Tıkla → Detay";

  renderExpenseDist(totalExpense);
  _renderKasaTable(active);
}

function _renderKasaTable(active){
  const tab = state.kasaCurrentTab;
  let filteredTx=[], filteredExp=[], tabTitle="Tüm kasa hareketleri";

  if(tab==="all")    { filteredTx=active; filteredExp=state.expenses; tabTitle="Tüm kasa hareketleri"; }
  else if(tab==="havale") { filteredTx=active.filter(t=>t.type==="Havale"||t.type==="Havale/EFT"); tabTitle="🏦 Havale / EFT işlemleri"; }
  else if(tab==="kripto") { filteredTx=active.filter(t=>t.type==="Kripto"); tabTitle="₿ Kripto işlemleri"; }
  else if(tab==="gider")  { filteredExp=state.expenses; tabTitle="📉 Giderler"; }

  // Sekme metrikleri
  const tabIncome=filteredTx.reduce((s,t)=>s+t.amount,0);
  const tabBonus =filteredTx.reduce((s,t)=>s+t.bonus,0);
  const tabExpense=filteredExp.reduce((s,e)=>s+e.amount,0);
  const tabNet   =tabIncome-tabBonus-tabExpense;
  const tabKomisyon=filteredExp.filter(e=>e.type==="Shopier Komisyon").reduce((s,e)=>s+e.amount,0);
  const metricsEl=document.getElementById("kasa-tab-metrics");
  if(metricsEl){
    if(tab==="gider"){
      metricsEl.innerHTML=
        `<div class='metric'><div class='lbl'><i class='ti ti-arrow-down-circle' style='color:var(--danger)'></i>Toplam gider</div><div class='val' style='color:var(--danger)'>${fmt(tabExpense)}</div><div class='sub'>${filteredExp.length} kayıt</div></div>`+
        `<div class='metric'><div class='lbl'><i class='ti ti-brand-shopee' style='color:var(--warning)'></i>Shopier komisyon</div><div class='val' style='color:var(--warning)'>${fmt(tabKomisyon)}</div></div>`+
        `<div class='metric'><div class='lbl'><i class='ti ti-briefcase'></i>İş gideri</div><div class='val'>${fmt(state.expenses.filter(e=>e.type==="İş gideri").reduce((s,e)=>s+e.amount,0))}</div></div>`+
        `<div class='metric'><div class='lbl'><i class='ti ti-users'></i>Personel</div><div class='val'>${fmt(state.expenses.filter(e=>e.type==="Personel gideri").reduce((s,e)=>s+e.amount,0))}</div></div>`;
    } else {
      const uc=new Set(filteredTx.map(t=>t.cust_id)).size;
      metricsEl.innerHTML=
        `<div class='metric'><div class='lbl'><i class='ti ti-arrow-up-circle' style='color:var(--success)'></i>Gelir</div><div class='val' style='color:var(--success)'>${fmt(tabIncome)}</div><div class='sub'>${filteredTx.length} işlem</div></div>`+
        `<div class='metric'><div class='lbl'><i class='ti ti-gift' style='color:var(--warning)'></i>Bonus</div><div class='val' style='color:var(--warning)'>${fmt(tabBonus)}</div><div class='sub'>${filteredTx.filter(t=>t.bonus>0).length} işlemde</div></div>`+
        `<div class='metric'><div class='lbl'><i class='ti ti-users'></i>Üye sayısı</div><div class='val'>${uc}</div></div>`+
        `<div class='metric metric-accent'><div class='lbl'><i class='ti ti-scale'></i>Net</div><div class='val' style='color:${tabNet>=0?"var(--success)":"var(--danger)"}'>${fmt(tabNet)}</div></div>`;
    }
  }

  if(document.getElementById("kasa-table-title")) document.getElementById("kasa-table-title").textContent=tabTitle;

  // Filtreler
  const q          = (document.getElementById("kasa-search")?.value||"").toLowerCase().trim();
  const filterType = document.getElementById("kasa-filter-type")?.value||"";
  const filterFrom = document.getElementById("kasa-filter-from")?.value||"";
  const filterTo   = document.getElementById("kasa-filter-to")?.value||"";

  const inRange=(ds)=>{
    if(!filterFrom&&!filterTo) return true;
    if(!ds) return false;
    let d = ds.includes("T")||ds.includes("-") ? new Date(ds) : new Date(...ds.split(".").reverse().map((v,i)=>i===1?parseInt(v)-1:parseInt(v)));
    if(filterFrom && d<new Date(filterFrom)) return false;
    if(filterTo   && d>new Date(filterTo+"T23:59:59")) return false;
    return true;
  };

  const srcBadge=t=>(t.user_name==="shopier-bot"||t.type==="Shopier")
    ? "<span style='font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(16,185,129,.15);color:var(--success);border:1px solid rgba(16,185,129,.3)'>🤖 Shopier</span>"
    : "<span style='font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(139,92,246,.15);color:var(--purple);border:1px solid rgba(139,92,246,.3)'>👤 Manuel</span>";

  let rows=[];
  if(tab!=="gider"){
    let txRows=filteredTx;
    if(q)          txRows=txRows.filter(t=>(t.cust_name||"").toLowerCase().includes(q)||(t.note||"").toLowerCase().includes(q));
    if(filterType&&filterType!=="gider"&&filterType!=="tahsilat") txRows=txRows.filter(t=>t.type===filterType);
    if(filterType==="gider"||filterType==="tahsilat") txRows=[];
    if(filterFrom||filterTo) txRows=txRows.filter(t=>inRange(t.created_at||t.date));
    rows=txRows.map(t=>`<tr>
      <td style='font-weight:600'>${t.cust_name}</td>
      <td><span class='tbadge'>${t.type}</span></td>
      <td style='color:var(--success);font-weight:700'>${fmt(t.amount)}</td>
      <td style='color:var(--warning)'>${t.bonus>0?fmt(t.bonus):"—"}</td>
      <td>${srcBadge(t)}</td>
      <td style='color:var(--text3);font-size:11px'>${t.date}</td>
      <td style='color:var(--text3);font-size:11px'>${t.note||"—"}</td>
      <td><button onclick='deleteTx("${t.id}","${t.cust_id}",${t.amount},${t.bonus})' style='background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:var(--danger);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px' title='Sil'><i class='ti ti-trash'></i></button></td>
    </tr>`);
  }
  if(tab==="all"||tab==="gider"){
    let expRows=filteredExp;
    if(q)          expRows=expRows.filter(e=>(e.note||"").toLowerCase().includes(q)||(e.type||"").toLowerCase().includes(q));
    if(filterType&&filterType!=="gider"&&filterType!=="tahsilat") expRows=[];
    if(filterFrom||filterTo) expRows=expRows.filter(e=>inRange(e.created_at||e.date));
    rows=rows.concat(expRows.map(e=>`<tr>
      <td style='color:var(--text2)'>${e.note||e.type}</td>
      <td><span class='rbadge r-delete'>${e.type}</span></td>
      <td style='color:var(--danger);font-weight:700'>-${fmt(e.amount)}</td>
      <td>—</td>
      <td><span style='font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(239,68,68,.1);color:var(--danger);border:1px solid rgba(239,68,68,.2)'>📉 Gider</span></td>
      <td style='color:var(--text3);font-size:11px'>${e.date}</td>
      <td style='color:var(--text3);font-size:11px'>${e.user_name}</td>
      <td><button onclick='deleteExpense("${e.id}")' style='background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:var(--danger);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px' title='Sil'><i class='ti ti-trash'></i></button></td>
    </tr>`));
  }
  // Shopier tahsilatları sadece "all" sekmesinde
  if(tab==="all" && (!filterType||filterType==="tahsilat") && state.shopierCollections?.length){
    let sc=state.shopierCollections;
    if(q)          sc=sc.filter(r=>(r.cust_name||r.customer_name||"").toLowerCase().includes(q));
    if(filterFrom||filterTo) sc=sc.filter(r=>inRange(r.payment_date||r.order_date));
    rows=rows.concat(sc.map(r=>`<tr style='opacity:.85'>
      <td style='font-weight:600'>${r.cust_name||r.customer_name||"—"}</td>
      <td><span class='tbadge' style='background:rgba(16,185,129,.15);color:var(--success);border-color:rgba(16,185,129,.3)'>Shopier Tahsilat</span></td>
      <td style='color:var(--success);font-weight:700'>${fmt(r.collection||0)}</td>
      <td style='color:var(--text3)'>—</td>
      <td><span style='font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(16,185,129,.15);color:var(--success);border:1px solid rgba(16,185,129,.3)'>🤖 Shopier</span></td>
      <td style='color:var(--text3);font-size:11px'>${(r.payment_date||r.order_date||"—").substring(0,10)}</td>
      <td style='color:var(--text3);font-size:11px'>${r.order_id||"—"}</td>
      <td></td>
    </tr>`));
  }

  const total=rows.length;
  if(document.getElementById("kasa-table-count")) document.getElementById("kasa-table-count").textContent=total+" kayıt";
  if(document.getElementById("no-kasa"))         document.getElementById("no-kasa").style.display=total?"none":"block";
  if(document.getElementById("kasa-body"))       document.getElementById("kasa-body").innerHTML=rows.join("");
}

// ── İşlem sil ────────────────────────────────────────────────
export async function deleteTx(txId, custId, amount, bonus){
  if(!confirm("Bu işlemi silmek istediğinize emin misiniz?\nÜye bakiyesinden "+fmt(amount+bonus)+" düşülecek.")) return;
  showLoading(true);
  await db.from("transactions").update({cancelled:true}).eq("id",txId);
  const cust=state.customers.find(c=>c.id===custId);
  if(cust){
    const newBal=Math.max(0,(cust.balance||0)-(amount+bonus));
    await db.from("customers").update({balance:newBal}).eq("id",custId);
    await db.from("balance_history").insert({cust_id:custId,cust_name:cust.name,old_balance:cust.balance,new_balance:newBal,change_amount:-(amount+bonus),reason:"Kasa işlemi silindi",user_name:state.currentUser});
    cust.balance=newBal;
  }
  const tx=state.transactions.find(t=>t.id===txId);
  if(tx) tx.cancelled=true;
  await addLog("delete","Kasa işlemi silindi",txId);
  showLoading(false);
  updateKasaMetrics();
  renderCustomers();
  showToast("✅ İşlem silindi, bakiye güncellendi.");
}

export async function deleteExpense(expId){
  if(!confirm("Bu gideri silmek istediğinize emin misiniz?")) return;
  showLoading(true);
  await db.from("expenses").delete().eq("id",expId);
  state.expenses=state.expenses.filter(e=>e.id!==expId);
  await addLog("delete","Gider silindi",expId);
  showLoading(false);
  updateKasaMetrics();
  showToast("✅ Gider silindi.");
}

// ── Gider ekle ────────────────────────────────────────────────
export function openExpense(type){
  state.currentExpenseType=type;
  document.getElementById("exp-title").textContent=type+" ekle";
  document.getElementById("exp-amount").value="";
  document.getElementById("exp-note").value="";
  document.getElementById("expense-overlay").classList.add("open");
}

export async function saveExpense(){
  const amt=parseFloat(document.getElementById("exp-amount").value)||0;
  const note=document.getElementById("exp-note").value.trim();
  if(!amt){alert("Tutar zorunludur.");return;}
  showLoading(true);
  const exp={type:state.currentExpenseType,amount:amt,note,date:todayStr(),user_name:state.currentUser};
  const {data}=await db.from("expenses").insert(exp).select();
  if(data&&data[0]) state.expenses.unshift(data[0]);
  await addLog("add",`${state.currentExpenseType} — ${fmt(amt)}`,note||"—");
  showLoading(false);
  document.getElementById("expense-overlay").classList.remove("open");
  updateKasaMetrics();
}

// ── Gider dağılımı ────────────────────────────────────────────
function renderExpenseDist(total){
  const cats={};
  state.expenses.forEach(e=>{if(!cats[e.type])cats[e.type]=0;cats[e.type]+=e.amount;});
  if(document.getElementById("no-expense-dist")) document.getElementById("no-expense-dist").style.display=total?"none":"block";
  const clrs={"İş gideri":"#ef4444","Personel gideri":"#8b5cf6"};
  if(document.getElementById("expense-dist")) document.getElementById("expense-dist").innerHTML=total?Object.entries(cats).map(([cat,amt])=>{const pct=Math.round((amt/total)*100);return`<div class="type-item"><div class="type-hdr"><div class="type-name"><i class="ti ti-circle-dot" style="color:${clrs[cat]||"#888"}"></i>${cat}</div><div class="type-stats"><span class="type-tot">${fmt(amt)}</span><span class="type-cnt">${pct}%</span></div></div><div class="bar-bg"><div class="bar-fg" style="width:${pct}%;background:${clrs[cat]||"#888"}"></div></div></div>`;}).join(""):"";
}

// ── Grafik ────────────────────────────────────────────────────
export function setChartMode(mode,btn){
  state.chartMode=mode;
  document.querySelectorAll("#page-kasa .btn-sm").forEach(b=>{b.style.borderColor="var(--border2)";b.style.color="var(--text2)";});
  btn.style.borderColor="var(--purple)"; btn.style.color="var(--purple)";
  renderChart();
}

export function renderChart(){
  const ctx=document.getElementById("trend-chart"); if(!ctx) return;
  const active=state.transactions.filter(t=>!t.cancelled);
  const scItems=(state.shopierCollections||[]).map(r=>{
    const raw=r.payment_date||r.order_date||"";
    let ca=null;
    if(raw){const p=raw.trim().split(/[\/\-]/);if(p.length===3)ca=p[0].length===4?new Date(p[0],p[1]-1,p[2]):new Date(p[2],p[1]-1,p[0]);}
    return {amount:r.collection||0,created_at:ca?ca.toISOString():null,date:raw.substring(0,10)};
  });
  const allItems=[...active,...scItems];
  const now2=new Date();
  const getDate=t=>{
    if(t.created_at){const d=new Date(t.created_at);if(!isNaN(d))return d;}
    if(t.date){const p=t.date.split(".");if(p.length===3)return new Date(parseInt(p[2]),parseInt(p[1])-1,parseInt(p[0]));}
    return null;
  };
  let labels=[],data=[];
  if(state.chartMode==="monthly"){
    for(let i=11;i>=0;i--){
      const d=new Date(now2.getFullYear(),now2.getMonth()-i,1);
      labels.push(d.toLocaleDateString("tr-TR",{month:"short"}));
      data.push(allItems.filter(t=>{const td=getDate(t);return td&&td.getFullYear()===d.getFullYear()&&td.getMonth()===d.getMonth();}).reduce((s,t)=>s+t.amount,0));
    }
  } else if(state.chartMode==="weekly"){
    for(let i=6;i>=0;i--){
      const d=new Date(now2);d.setDate(d.getDate()-i);
      labels.push(d.toLocaleDateString("tr-TR",{weekday:"short"}));
      data.push(allItems.filter(t=>{const td=getDate(t);return td&&td.toDateString()===d.toDateString();}).reduce((s,t)=>s+t.amount,0));
    }
  } else {
    for(let i=23;i>=0;i--){
      const h=new Date(now2);h.setHours(now2.getHours()-i,0,0,0);
      labels.push(String(h.getHours()).padStart(2,"0")+":00");
      data.push(active.filter(t=>{const td=getDate(t);return td&&td.toDateString()===now2.toDateString()&&td.getHours()===h.getHours();}).reduce((s,t)=>s+t.amount,0));
    }
  }
  if(state.trendChart) state.trendChart.destroy();
  state.trendChart=new Chart(ctx,{type:"line",data:{labels,datasets:[{data,borderColor:"#8b5cf6",backgroundColor:"rgba(139,92,246,0.1)",borderWidth:2,pointRadius:3,pointBackgroundColor:"#8b5cf6",tension:0.4,fill:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:"rgba(22,22,42,.95)",borderColor:"rgba(139,92,246,.3)",borderWidth:1,callbacks:{label:c=>"₺"+Math.round(c.parsed.y).toLocaleString("tr-TR")}}},scales:{x:{grid:{color:"rgba(255,255,255,.04)"},ticks:{color:"#5a5a7a",font:{size:10}}},y:{grid:{color:"rgba(255,255,255,.04)"},ticks:{color:"#5a5a7a",font:{size:10},callback:v=>"₺"+Math.round(v/1000)+"K"}}}}});
}

// ── Nakit kasa ────────────────────────────────────────────────
function _updateNakitUI(){
  const total=(state.nakitHareketler||[]).reduce((s,n)=>s+(n.amount||0),0);
  if(document.getElementById("k-nakit")) document.getElementById("k-nakit").textContent=fmt(total);

  const today=new Date(); today.setHours(0,0,0,0);
  const upcoming=(state.shopierCollections||[]).filter(r=>{
    if(!r.planned_date) return false;
    const p=r.planned_date.trim().split(/[\/\-]/);
    if(p.length!==3) return false;
    const d=p[0].length===4?new Date(p[0],p[1]-1,p[2]):new Date(p[2],p[1]-1,p[0]);
    return d>=today;
  });
  const upcomingAmt=upcoming.reduce((s,r)=>s+(r.collection||0),0);
  if(document.getElementById("nk-shopier-pending")) document.getElementById("nk-shopier-pending").textContent=fmt(upcomingAmt);
  const nextDates=upcoming.map(r=>{const p=r.planned_date.trim().split(/[\/\-]/);return p[0].length===4?new Date(p[0],p[1]-1,p[2]):new Date(p[2],p[1]-1,p[0]);}).sort((a,b)=>a-b);
  if(document.getElementById("nk-shopier-date")) document.getElementById("nk-shopier-date").textContent=nextDates[0]?nextDates[0].toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"})+"'de gelecek":"Planlanan yok";
}

export async function openNakitKasa(){
  document.getElementById("nakit-overlay").style.display="flex";
  if(!state.nakitHareketler.length){
    const {data}=await db.from("logs").select("*").eq("action","nakit").order("created_at",{ascending:false}).limit(50);
    state.nakitHareketler=data||[];
  }
  _updateNakitUI();
  const list=document.getElementById("nk-list");
  if(list) list.innerHTML=state.nakitHareketler.length?state.nakitHareketler.map(n=>`
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1"><div style="font-size:12px;font-weight:600">${n.target||n.detail||"—"}</div><div style="font-size:10px;color:var(--text3)">${n.ts||""} · ${n.user_name||""}</div></div>
      <div style="font-size:13px;font-weight:700;color:var(--success)">${fmt(n.amount||0)}</div>
    </div>`).join(""):'<div style="font-size:12px;color:var(--text3);text-align:center;padding:1rem">Henüz nakit hareketi yok.</div>';
}

export async function addNakitGiris(){
  const amount=parseFloat(document.getElementById("nk-amount")?.value)||0;
  const desc=document.getElementById("nk-desc")?.value.trim();
  const type=document.getElementById("nk-type")?.value;
  if(!amount||!desc){showToast("⚠️ Tutar ve açıklama zorunlu.");return;}
  showLoading(true);
  const ts=new Date().toLocaleString("tr-TR");
  const {data}=await db.from("logs").insert({action:"nakit",detail:type+": "+desc,target:desc,user_name:state.currentUser,ts,amount}).select();
  if(data&&data[0]) state.nakitHareketler.unshift(data[0]);
  if(document.getElementById("nk-amount")) document.getElementById("nk-amount").value="";
  if(document.getElementById("nk-desc"))   document.getElementById("nk-desc").value="";
  await addLog("add","Nakit kasa girişi: "+fmt(amount),desc);
  showLoading(false);
  openNakitKasa();
  showToast("✅ Nakit kasa güncellendi!");
}

export async function shopierToNakit(){
  const pendingEl=document.getElementById("nk-shopier-pending");
  const raw=pendingEl?.textContent||"0";
  const amt=parseFloat(raw.replace(/[₺\s]/g,"").replace(/\./g,"").replace(",","."))||0;
  if(!amt){showToast("⚠️ Bekleyen Shopier ödemesi yok.");return;}
  if(!confirm(`${fmt(amt)} tutarındaki Shopier ödemesini nakit kasaya aktaracaksınız. Onaylıyor musunuz?`)) return;
  showLoading(true);
  const ts=new Date().toLocaleString("tr-TR");
  const desc="Shopier Çarşamba Ödemesi - "+new Date().toLocaleDateString("tr-TR");
  const {data}=await db.from("logs").insert({action:"nakit",detail:"Shopier Ödemesi: "+desc,target:desc,user_name:state.currentUser,ts,amount:amt}).select();
  if(data&&data[0]) state.nakitHareketler.unshift(data[0]);
  await sendTelegram(`💵 <b>Shopier → Nakit Kasa</b>\n💰 Aktarılan: <b>${fmt(amt)}</b>\n📅 ${ts}\n👤 ${state.currentUser}`);
  await addLog("add","Shopier nakite aktarıldı: "+fmt(amt),desc);
  showLoading(false);
  openNakitKasa();
  showToast("✅ Shopier ödemesi nakit kasaya aktarıldı!");
}

export function clearKasaFilters(){
  ["kasa-search","kasa-filter-from","kasa-filter-to"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  const sel=document.getElementById("kasa-filter-type");if(sel)sel.value="";
  updateKasaMetrics();
}

// ── Export ────────────────────────────────────────────────────
export function exportKasaExcel(){
  const active=state.transactions.filter(t=>!t.cancelled);
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.json_to_sheet(active.map(t=>({Üye:t.cust_name,Tutar:t.amount,Bonus:t.bonus,Toplam:t.total,Tür:t.type,Tarih:t.date,Not:t.note||""})));
  XLSX.utils.book_append_sheet(wb,ws,"Kasa");
  XLSX.writeFile(wb,"kasa_raporu.xlsx");
}

export function exportMonthlyReport(){
  const now=new Date();
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1);
  const monthTx=state.transactions.filter(t=>!t.cancelled&&t.created_at&&new Date(t.created_at)>=monthStart);
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.json_to_sheet(monthTx.map(t=>({Üye:t.cust_name,Tutar:t.amount,Bonus:t.bonus,Toplam:t.total,Tür:t.type,Tarih:t.date})));
  XLSX.utils.book_append_sheet(wb,ws,"Aylık");
  XLSX.writeFile(wb,`aylik_ozet_${now.toLocaleDateString("tr-TR")}.xlsx`);
}

// ── Dönem kapatma ─────────────────────────────────────────────
export function donemKapat(tip){
  state.donemKapatTip=tip;
  const now=new Date();
  let baslangic,bitis,baslik;
  if(tip==="hafta"){
    bitis=new Date(now);bitis.setHours(23,59,59,999);
    baslangic=new Date(now);baslangic.setDate(now.getDate()-6);baslangic.setHours(0,0,0,0);
    baslik="📅 Haftayı Kapat";
  } else {
    baslangic=new Date(now.getFullYear(),now.getMonth(),1);
    bitis=new Date(now.getFullYear(),now.getMonth()+1,0,23,59,59,999);
    baslik="📅 Ayı Kapat — "+now.toLocaleDateString("tr-TR",{month:"long",year:"numeric"});
  }
  const active=state.transactions.filter(t=>!t.cancelled);
  const periodTx=active.filter(t=>{if(!t.created_at)return false;const d=new Date(t.created_at);return d>=baslangic&&d<=bitis;});
  const periodExp=state.expenses.filter(e=>{if(!e.created_at)return false;const d=new Date(e.created_at);return d>=baslangic&&d<=bitis;});
  const activeTx=active.filter(t=>t.created_at&&new Date(t.created_at)>bitis);
  const gelir=periodTx.reduce((s,t)=>s+t.amount,0);
  const bonus=periodTx.reduce((s,t)=>s+t.bonus,0);
  const gider=periodExp.reduce((s,e)=>s+e.amount,0);
  const net=gelir-bonus-gider;
  const shopierGelir=periodTx.filter(t=>t.user_name==="shopier-bot").reduce((s,t)=>s+t.amount,0);
  const havaleGelir=periodTx.filter(t=>t.type==="Havale"||t.type==="Havale/EFT").reduce((s,t)=>s+t.amount,0);
  const kriptoGelir=periodTx.filter(t=>t.type==="Kripto").reduce((s,t)=>s+t.amount,0);
  const aktifGelir=activeTx.reduce((s,t)=>s+t.amount,0);
  const aktifBonus=activeTx.reduce((s,t)=>s+t.bonus,0);
  const aktifUye=new Set(activeTx.map(t=>t.cust_id)).size;
  const fmtDate=d=>d.toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"});
  document.getElementById("donem-modal-title").textContent=baslik;
  document.getElementById("donem-ozet").innerHTML=`
    <div style="font-size:11px;color:var(--text3);margin-bottom:8px">📆 Dönem: ${fmtDate(baslangic)} — ${fmtDate(bitis)}</div>
    <div style="font-size:11px;font-weight:700;color:var(--warning);margin-bottom:6px">📊 Dönem içi (geçmiş)</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px">
      <div style="background:var(--card2);border-radius:9px;padding:9px"><div style="font-size:10px;color:var(--text2)">Toplam gelir</div><div style="font-size:14px;font-weight:700;color:var(--success)">${fmt(gelir)}</div><div style="font-size:10px;color:var(--text3)">${periodTx.length} işlem</div></div>
      <div style="background:var(--card2);border-radius:9px;padding:9px"><div style="font-size:10px;color:var(--text2)">Bonus</div><div style="font-size:14px;font-weight:700;color:var(--warning)">${fmt(bonus)}</div></div>
      <div style="background:var(--card2);border-radius:9px;padding:9px"><div style="font-size:10px;color:var(--text2)">Gider</div><div style="font-size:14px;font-weight:700;color:var(--danger)">${fmt(gider)}</div></div>
      <div style="background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.2);border-radius:9px;padding:9px"><div style="font-size:10px;color:var(--text2)">Net kasa</div><div style="font-size:15px;font-weight:700;color:${net>=0?"var(--success)":"var(--danger)"}">${fmt(net)}</div></div>
      <div style="background:var(--card2);border-radius:9px;padding:9px"><div style="font-size:10px;color:var(--text2)">🤖 Shopier</div><div style="font-size:13px;font-weight:700;color:var(--success)">${fmt(shopierGelir)}</div></div>
      <div style="background:var(--card2);border-radius:9px;padding:9px"><div style="font-size:10px;color:var(--text2)">🏦 Havale/EFT</div><div style="font-size:13px;font-weight:700;color:var(--info)">${fmt(havaleGelir)}</div></div>
    </div>
    <div style="font-size:11px;font-weight:700;color:var(--success);margin-bottom:6px">⚡ Dönem sonrası aktif</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
      <div style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:9px;padding:9px"><div style="font-size:10px;color:var(--text2)">Gelir</div><div style="font-size:14px;font-weight:700;color:var(--success)">${fmt(aktifGelir)}</div><div style="font-size:10px;color:var(--text3)">${activeTx.length} işlem</div></div>
      <div style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:9px;padding:9px"><div style="font-size:10px;color:var(--text2)">Bonus</div><div style="font-size:14px;font-weight:700;color:var(--warning)">${fmt(aktifBonus)}</div></div>
      <div style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:9px;padding:9px"><div style="font-size:10px;color:var(--text2)">Aktif üye</div><div style="font-size:14px;font-weight:700;color:var(--purple)">${aktifUye}</div></div>
    </div>`;
  document.getElementById("donem-overlay").style.display="flex";
  window._donemData={tip,baslangic,bitis,gelir,bonus,gider,net,shopierGelir,havaleGelir,kriptoGelir,txCount:periodTx.length};
}

export async function donemKapatOnayla(withTelegram){
  document.getElementById("donem-overlay").style.display="none";
  const d=window._donemData; if(!d) return;
  const now=new Date();
  const fmtDate=dt=>dt.toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"});
  const label=d.tip==="hafta"?"Haftalık":now.toLocaleDateString("tr-TR",{month:"long",year:"numeric"});
  await addLog("add",`${label} dönem kapatıldı — Net: ${fmt(d.net)}`,"Kasa");
  if(withTelegram){
    const emoji=d.tip==="hafta"?"📅":"📆";
    await sendTelegram(`${emoji} <b>ESMSMarket ${label} Dönem Kapanışı</b>\n📅 ${fmtDate(d.baslangic)} — ${fmtDate(d.bitis)}\n━━━━━━━━━━━━━━━━━━\n💰 Toplam gelir: <b>${fmt(d.gelir)}</b>\n🎁 Toplam bonus: <b>${fmt(d.bonus)}</b>\n📉 Toplam gider: <b>${fmt(d.gider)}</b>\n━━━━━━━━━━━━━━━━━━\n🤖 Shopier: <b>${fmt(d.shopierGelir)}</b>\n🏦 Havale/EFT: <b>${fmt(d.havaleGelir)}</b>\n₿ Kripto: <b>${fmt(d.kriptoGelir)}</b>\n━━━━━━━━━━━━━━━━━━\n📊 İşlem sayısı: <b>${d.txCount}</b>\n💎 Net kasa: <b>${fmt(d.net)}</b>\n⏰ Kapanış: ${now.toLocaleDateString("tr-TR")} ${now.toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}\n👤 İşlemci: ${state.currentUser}`);
    showToast("✅ Dönem kapatıldı ve Telegram'a gönderildi!");
  } else {
    showToast("✅ Dönem kapatıldı!");
  }
  window._donemData=null;
}
