// ── ui/top10.js ───────────────────────────────────────────────
import { state } from '../config.js';
import { fmt } from '../utils.js';

let period = "month"; // "month" | "prev" | "all"

export function setTop10Period(p, btn){
  period = p;
  document.querySelectorAll("#page-top10 .btn-sm").forEach(b=>{
    b.style.background = "transparent";
    b.style.color = "var(--text2)";
  });
  if(btn){ btn.style.background = "var(--grad)"; btn.style.color = "#fff"; }
  renderTop10();
}

export function renderTop10(){
  const tbody = document.getElementById("top10-body");
  if(!tbody) return;

  const now = new Date();
  let rangeStart = null, rangeEnd = null;
  if(period === "month"){
    rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
    rangeEnd   = new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59,999);
  } else if(period === "prev"){
    rangeStart = new Date(now.getFullYear(), now.getMonth()-1, 1);
    rangeEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59,999);
  }

  const inRange = t=>{
    if(!rangeStart) return true;
    if(!t.created_at) return false;
    const d = new Date(t.created_at);
    return d >= rangeStart && d <= rangeEnd;
  };

  const totals = {};
  state.transactions.filter(t=>!t.cancelled).filter(inRange).forEach(t=>{
    if(!totals[t.cust_id]) totals[t.cust_id] = {id:t.cust_id, name:t.cust_name, total:0, count:0, last:null};
    totals[t.cust_id].total += t.amount;
    totals[t.cust_id].count++;
    const d = t.created_at ? new Date(t.created_at) : null;
    if(d && (!totals[t.cust_id].last || d > totals[t.cust_id].last)) totals[t.cust_id].last = d;
  });

  const ranked = Object.values(totals).sort((a,b)=>b.total-a.total).slice(0,10);
  const rankColor = i => i===0?"var(--warning)":i===1?"var(--text2)":i===2?"#cd7f32":"var(--text3)";

  tbody.innerHTML = ranked.length ? ranked.map((c,i)=>`
    <tr>
      <td style="font-weight:700;color:${rankColor(i)}">${i+1}</td>
      <td style="color:var(--text3);font-size:11px">${c.id||"—"}</td>
      <td style="font-weight:600">${c.name||"—"}</td>
      <td style="font-weight:700;color:var(--success)">${fmt(c.total)}</td>
      <td>${c.count}</td>
      <td style="color:var(--text3);font-size:11px">${c.last?c.last.toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"}):"—"}</td>
    </tr>`).join("")
    : `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text3)">Bu dönemde işlem yok.</td></tr>`;
}
