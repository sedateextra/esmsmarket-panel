// ── ui/export.js ──────────────────────────────────────────────
// Excel import/export (müşteri listesi güncelleme)
import { state } from '../config.js';
import { db, addLog } from '../data.js';
import { fmt, showLoading, showToast } from '../utils.js';
import { renderCustomers } from './customers.js';

export let xlPending = null;

export function loadXL(){
  const input=document.getElementById("xl-input"); if(!input||!input.files[0]) return;
  const file=input.files[0];
  const reader=new FileReader();
  reader.onload=e=>{
    try {
      const data=new Uint8Array(e.target.result);
      const wb=XLSX.read(data,{type:"array"});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
      if(!rows.length){showToast("❌ Excel boş.");return;}

      // Header satırı — ID ve Bakiye sütunlarını bul
      const header=rows[0].map(h=>String(h||"").toLowerCase());
      const idIdx=header.findIndex(h=>h.includes("id"));
      const balIdx=header.findIndex(h=>h.includes("bakiye")||h.includes("balance"));
      if(idIdx===-1||balIdx===-1){showToast("❌ 'ID' ve 'Bakiye' sütunları bulunamadı.");return;}

      const changes=[];
      for(let i=1;i<rows.length;i++){
        const row=rows[i];
        const id=String(row[idIdx]||"").trim();
        const newBal=parseFloat(String(row[balIdx]||"").replace(",","."))||0;
        if(!id) continue;
        const cust=state.customers.find(c=>c.id===id);
        if(!cust) continue;
        const oldBal=cust.balance||0;
        if(Math.abs(oldBal-newBal)<0.001) continue;
        changes.push({cust,oldBal,newBal});
      }

      if(!changes.length){showToast("ℹ️ Güncellenecek bakiye bulunamadı.");return;}

      xlPending=changes;
      // Önizleme
      const tbody=document.getElementById("xl-preview-body"); if(!tbody) return;
      tbody.innerHTML=changes.map(c=>`<tr>
        <td style="font-weight:600">${c.cust.id}</td>
        <td>${c.cust.name}</td>
        <td style="color:var(--text3)">${fmt(c.oldBal)}</td>
        <td style="color:var(--success);font-weight:700">${fmt(c.newBal)}</td>
        <td class="${c.newBal>c.oldBal?"diff-new":"diff-changed"}">${c.newBal>c.oldBal?"+":""}${fmt(c.newBal-c.oldBal)}</td>
      </tr>`).join("");
      if(document.getElementById("xl-stats")) document.getElementById("xl-stats").textContent=`${changes.length} üye güncellenecek`;
      if(document.getElementById("xl-preview")) document.getElementById("xl-preview").style.display="block";
    } catch(e){
      console.error("Excel yükleme hatası:",e);
      showToast("❌ Excel okuma hatası: "+e.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

export async function applyXL(){
  if(!xlPending||!xlPending.length){showToast("❌ Yüklenecek veri yok.");return;}
  if(!confirm(`${xlPending.length} üyenin bakiyesi güncellensin mi?`)) return;
  showLoading(true);
  const count=xlPending.length;
  for(const c of xlPending){
    c.cust.balance=c.newBal;
    await db.from("customers").update({balance:c.newBal}).eq("id",c.cust.id);
    await db.from("balance_history").insert({
      cust_id:c.cust.id,cust_name:c.cust.name,
      old_balance:c.oldBal,new_balance:c.newBal,change_amount:c.newBal-c.oldBal,
      reason:"Excel güncelleme",user_name:state.currentUser
    });
  }
  await addLog("import",`Excel güncelleme — ${count} üye`,state.currentUser);
  xlPending=null;
  if(document.getElementById("xl-preview")) document.getElementById("xl-preview").style.display="none";
  const inp=document.getElementById("xl-input"); if(inp) inp.value="";
  showLoading(false);
  renderCustomers();
  updateXLStats();
  showToast(`✅ ${count} üyenin bakiyesi güncellendi!`);
}

export function exportXL(){
  if(!state.customers.length){showToast("❌ Dışa aktarılacak müşteri yok.");return;}
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.json_to_sheet(state.customers.map(c=>({
    "ID":c.id,"Ad Soyad":c.name,"E-posta":c.email,
    "Bakiye (₺)":c.balance||0,"Kayıt":c.since||""
  })));
  XLSX.utils.book_append_sheet(wb,ws,"Müşteriler");
  XLSX.writeFile(wb,"esmsmarket_musteriler.xlsx");
}

export function updateXLStats(){
  const el=document.getElementById("xl-current-stats"); if(!el) return;
  el.textContent=`${state.customers.length} üye, toplam bakiye: ${fmt(state.customers.reduce((s,c)=>s+(c.balance||0),0))}`;
}
