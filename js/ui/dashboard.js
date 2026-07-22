// ── ui/dashboard.js ───────────────────────────────────────────
import { state, HERO_BASE, HERO_KEY } from '../config.js';
import { fmt } from '../utils.js';
import { sendTelegram } from '../telegram.js';

let dbLineChart=null, dbPieChart=null, dbHourChart=null;

export async function renderDashboard(){
  const today=new Date();
  const monthStart=new Date(today.getFullYear(),today.getMonth(),1);
  const activeTx=state.transactions.filter(t=>!t.cancelled);

  // Shopier tahsilatlarını ekle
  const scTx=(state.shopierCollections||[]).map(r=>({
    amount:r.collection||0,bonus:0,type:"Shopier Tahsilat",
    cust_name:r.cust_name||r.customer_name||"Shopier",
    user_name:"shopier-col",
    date:(r.payment_date||r.order_date||"").substring(0,10),
    created_at:r.payment_date||r.order_date||null,
    note:r.order_id||""
  }));
  const allTx=[...activeTx,...scTx];

  // Metrikler
  const todayStr=today.toLocaleDateString("tr-TR");
  const todayIncome=allTx.filter(t=>{
    if(t.created_at){const d=new Date(t.created_at);if(!isNaN(d))return d.toDateString()===today.toDateString();}
    return t.date===todayStr;
  }).reduce((s,t)=>s+t.amount,0);
  const monthIncome=allTx.filter(t=>{if(t.created_at){const d=new Date(t.created_at);if(!isNaN(d))return d>=monthStart;}return false;}).reduce((s,t)=>s+t.amount,0);
  const totalIncome=allTx.reduce((s,t)=>s+t.amount,0);
  const totalBonus2=activeTx.reduce((s,t)=>s+t.bonus,0);
  const totalExpense2=state.expenses.reduce((s,e)=>s+e.amount,0);
  const netKasa=totalIncome-totalBonus2-totalExpense2;
  const activeMembers=state.customers.filter(c=>(c.balance||0)>0).length;
  const pendingDebt=state.borclar.filter(b=>b.status!=="Ödendi").reduce((s,b)=>s+(b.amount||0)-(b.paid||0),0);
  const debtCount=state.borclar.filter(b=>b.status!=="Ödendi").length;

  const $=id=>document.getElementById(id);
  if($("db-today-income"))  $("db-today-income").textContent=fmt(todayIncome);
  if($("db-month-income"))  $("db-month-income").textContent="Bu ay: "+fmt(monthIncome);
  if($("db-active-members")) $("db-active-members").textContent=activeMembers;
  if($("db-today-new"))     $("db-today-new").textContent="Bugün yeni: "+state.customers.filter(c=>(c.since||"").includes(today.toLocaleDateString("tr-TR",{day:"numeric",month:"short",year:"numeric"}))).length;
  if($("db-pending-debt"))  $("db-pending-debt").textContent=fmt(pendingDebt);
  if($("db-debt-count"))    $("db-debt-count").textContent=debtCount+" borçlu";
  if($("db-total-income"))  $("db-total-income").textContent=fmt(totalIncome);
  if($("db-total-expense")) $("db-total-expense").textContent=fmt(totalExpense2);
  if($("db-total-bonus"))   $("db-total-bonus").textContent=fmt(totalBonus2);
  if($("db-bonus-count"))   $("db-bonus-count").textContent=activeTx.filter(t=>t.bonus>0).length+" işlemde";
  const dbNetEl=$("db-net-kasa");
  if(dbNetEl){dbNetEl.textContent=fmt(netKasa);dbNetEl.style.color=netKasa>=0?"var(--success)":"var(--danger)";}

  // Son import
  const lastImp=state.logs.find(l=>l.action==="import");
  if($("db-last-import")) $("db-last-import").textContent=lastImp?lastImp.ts+" · "+lastImp.user_name:"—";

  // Top 3 bu ay
  const txTotals={};
  activeTx.filter(t=>t.created_at&&new Date(t.created_at)>=monthStart).forEach(t=>{
    if(!txTotals[t.cust_id]) txTotals[t.cust_id]={name:t.cust_name,total:0};
    txTotals[t.cust_id].total+=t.amount;
  });
  const top3=Object.values(txTotals).sort((a,b)=>b.total-a.total).slice(0,3);
  const rankColors=["#f59e0b","#9ca3af","#cd7f32"];
  if($("db-top3")) $("db-top3").innerHTML=top3.length?top3.map((c,i)=>`
    <div style="display:flex;align-items:center;gap:8px">
      <div style="width:18px;height:18px;border-radius:50%;background:${rankColors[i]};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0">${i+1}</div>
      <div style="flex:1;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</div>
      <div style="font-size:12px;font-weight:700;color:var(--success)">${fmt(c.total)}</div>
    </div>`).join(""):'<div style="font-size:12px;color:var(--text3)">Bu ay işlem yok.</div>';

  // Son işlemler
  const feed=[...allTx].sort((a,b)=>{const da=a.created_at?new Date(a.created_at):new Date(0);const db2=b.created_at?new Date(b.created_at):new Date(0);return db2-da;}).slice(0,5);
  const typeEmojis={"Havale":"🏦","Shopier":"🤖","Kripto":"₿","Shopier Tahsilat":"📊"};
  const typeGrads={"Havale":"linear-gradient(135deg,#3b82f6,#1d4ed8)","Shopier":"linear-gradient(135deg,#10b981,#047857)","Kripto":"linear-gradient(135deg,#f59e0b,#d97706)","Shopier Tahsilat":"linear-gradient(135deg,#10b981,#047857)"};
  if($("db-live-feed")) $("db-live-feed").innerHTML=feed.length?feed.map(t=>`
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="width:34px;height:34px;border-radius:10px;background:${typeGrads[t.type]||"var(--card2)"};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.2)">${typeEmojis[t.type]||"💰"}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.cust_name}</div>
        <div style="font-size:10px;color:var(--text3)">${t.type} · ${t.user_name==="shopier-col"?"📊 Tahsilat":t.user_name==="shopier-bot"?"🤖 Otomatik":"👤 "+t.user_name}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:12px;font-weight:700;color:var(--success)">${fmt(t.amount)}</div>
        <div style="font-size:10px;color:var(--text3)">${t.date||""}</div>
      </div>
    </div>`).join(""):'<div style="font-size:12px;color:var(--text3);padding:.5rem 0;text-align:center">İşlem yok.</div>';

  // Hero SMS stats
  try {
    const res=await fetch(`${HERO_BASE}?api_key=${HERO_KEY}&action=getHistory`);
    const hData=await res.json();
    const hHistory=(Array.isArray(hData)?hData:(hData.history||[]));
    const todayH=hHistory.filter(h=>h.date&&new Date(h.date).toDateString()===today.toDateString());
    if($("db-hero-success")) $("db-hero-success").textContent=todayH.filter(h=>h.status==="6"||h.status==="3").length;
    if($("db-hero-cancel"))  $("db-hero-cancel").textContent=todayH.filter(h=>h.status==="8"||h.status==="9").length;
    if($("db-hero-spent"))   $("db-hero-spent").textContent="$"+todayH.reduce((s,h)=>s+(parseFloat(h.cost||0)),0).toFixed(2);
  } catch(e){
    if($("db-hero-success")) $("db-hero-success").textContent="—";
    if($("db-hero-cancel"))  $("db-hero-cancel").textContent="—";
    if($("db-hero-spent"))   $("db-hero-spent").textContent="—";
  }

  // Son 30 gün grafik
  const days30=[],labels30=[];
  for(let i=29;i>=0;i--){
    const d=new Date(today);d.setDate(d.getDate()-i);
    labels30.push(d.toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit"}));
    days30.push(allTx.filter(t=>{if(!t.created_at)return false;return new Date(t.created_at).toDateString()===d.toDateString();}).reduce((s,t)=>s+t.amount,0));
  }
  const lineCtx=$("db-line-chart");
  if(lineCtx){
    if(dbLineChart) dbLineChart.destroy();
    dbLineChart=new Chart(lineCtx,{type:"line",data:{labels:labels30,datasets:[{data:days30,borderColor:"#8b5cf6",backgroundColor:"rgba(139,92,246,0.08)",borderWidth:2,pointRadius:0,tension:0.4,fill:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:"rgba(22,22,42,.95)",callbacks:{label:c=>"₺"+Math.round(c.parsed.y).toLocaleString("tr-TR")}}},scales:{x:{grid:{display:false},ticks:{color:"#5a5a7a",font:{size:9},maxTicksLimit:8}},y:{grid:{color:"rgba(255,255,255,.04)"},ticks:{color:"#5a5a7a",font:{size:9},callback:v=>v>=1000?"₺"+Math.round(v/1000)+"K":"₺"+v}}}}});
  }

  // Pasta grafik
  const typeCount={"Havale":0,"Shopier Tahsilat":0,"Kripto":0};
  const typeAmounts={"Havale":0,"Shopier Tahsilat":0,"Kripto":0};
  allTx.forEach(t=>{
    if(t.type==="Havale")                          { typeCount["Havale"]++;   typeAmounts["Havale"]+=t.amount; }
    else if(t.type==="Shopier"||t.type==="Shopier Tahsilat") { typeCount["Shopier Tahsilat"]++; typeAmounts["Shopier Tahsilat"]+=t.amount; }
    else if(t.type==="Kripto")                     { typeCount["Kripto"]++;   typeAmounts["Kripto"]+=t.amount; }
  });
  const pieCtx=$("db-pie-chart");
  if(pieCtx){
    if(dbPieChart) dbPieChart.destroy();
    dbPieChart=new Chart(pieCtx,{type:"doughnut",data:{labels:Object.keys(typeCount),datasets:[{data:Object.values(typeCount),backgroundColor:["#3b82f6","#10b981","#f59e0b"],borderWidth:0,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:"rgba(22,22,42,.95)",borderColor:"rgba(139,92,246,.2)",borderWidth:1,padding:10,callbacks:{label:(c)=>{const n=c.label;const cnt=c.parsed;const amt=typeAmounts[n]||0;const pct=Math.round((cnt/(Object.values(typeCount).reduce((s,v)=>s+v,0)||1))*100);return[" "+cnt+" işlem ("+pct+"%)"," ₺"+Math.round(amt).toLocaleString("tr-TR")];}}}}},cutout:"65%"});
    const total2=Object.values(typeCount).reduce((s,v)=>s+v,0)||1;
    const pieLegendColors={"Havale":"#3b82f6","Shopier Tahsilat":"#10b981","Kripto":"#f59e0b"};
    if($("db-pie-legend")) $("db-pie-legend").innerHTML=Object.entries(typeCount).map(([n,cnt])=>`
      <div style="display:flex;align-items:center;gap:7px;padding:5px 0;border-bottom:1px solid var(--border)">
        <div style="width:10px;height:10px;border-radius:50%;background:${pieLegendColors[n]};flex-shrink:0"></div>
        <div style="flex:1"><div style="font-size:11px;color:var(--text);font-weight:600">${n}</div><div style="font-size:10px;color:var(--text3)">${fmt(typeAmounts[n])}</div></div>
        <div style="font-size:12px;font-weight:700;color:var(--text)">${Math.round((cnt/total2)*100)}%</div>
      </div>`).join("");
  }

  // Saatlik yoğunluk
  const hourData=Array(24).fill(0);
  allTx.forEach(t=>{if(t.created_at){const h=new Date(t.created_at).getHours();hourData[h]++;}});
  const hourCtx=$("db-hour-chart");
  if(hourCtx){
    if(dbHourChart) dbHourChart.destroy();
    dbHourChart=new Chart(hourCtx,{type:"bar",data:{labels:Array.from({length:24},(_,i)=>i%3===0?i+"":""),datasets:[{data:hourData,backgroundColor:"rgba(139,92,246,0.5)",borderRadius:4,hoverBackgroundColor:"rgba(236,72,153,0.7)"}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:"rgba(22,22,42,.95)",callbacks:{title:i=>[i[0].label+":00"],label:c=>[c.parsed.y+" işlem"]}}},scales:{x:{grid:{display:false},ticks:{color:"#5a5a7a",font:{size:9}}},y:{grid:{color:"rgba(255,255,255,.04)"},ticks:{color:"#5a5a7a",font:{size:9},stepSize:1}}}}});
  }
}
