// ── ui/shopier.js ─────────────────────────────────────────────
import { state } from '../config.js';
import { db, addLog } from '../data.js';
import { fmt, showToast } from '../utils.js';

export async function loadShopierCollections(){
  const {data}=await db.from("shopier_collections").select("*").order("payment_date",{ascending:false});
  state.shopierCollections=data||[];
  renderShopierCollections();
}

export function clearScFilters(){
  ["sc-search","sc-date-from","sc-date-to"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  renderShopierCollections();
}

function parseFlexDate(raw){
  if(!raw) return null;
  const p=raw.trim().split(/[\/\-T ]/);
  if(p.length<3) return null;
  return p[0].length===4 ? new Date(p[0],p[1]-1,p[2]) : new Date(p[2],p[1]-1,p[0]);
}

export function renderShopierCollections(){
  const rows=state.shopierCollections||[];
  const q=(document.getElementById("sc-search")?.value||"").toLowerCase().trim();
  const dateFrom=document.getElementById("sc-date-from")?.value||"";
  const dateTo=document.getElementById("sc-date-to")?.value||"";

  // Filtrele
  let filtered=rows.filter(r=>{
    if(q){
      const hay=((r.cust_name||r.customer_name||"")+" "+(r.order_id||"")).toLowerCase();
      if(!hay.includes(q)) return false;
    }
    if(dateFrom||dateTo){
      const d=parseFlexDate(r.planned_date)||parseFlexDate(r.payment_date);
      if(!d) return false;
      if(dateFrom&&d<new Date(dateFrom)) return false;
      if(dateTo  &&d>new Date(dateTo+"T23:59:59")) return false;
    }
    return true;
  });

  // Sırala — en yeni planlanan/ödeme tarihi üstte
  filtered.sort((a,b)=>{
    const pd=r=>parseFlexDate(r.planned_date)||parseFlexDate(r.payment_date)||new Date(0);
    return pd(b)-pd(a);
  });

  const today=new Date(); today.setHours(0,0,0,0);
  const tbody=document.getElementById("sc-body");
  if(tbody) tbody.innerHTML = filtered.length ? filtered.map(r=>{
    const kesinti=(r.service_fee||0)+(r.vat||0);
    const plannedDate=parseFlexDate(r.planned_date);
    const done = plannedDate && plannedDate<=today;
    const statusBadge = done
      ? `<span class="sbadge" style="background:rgba(16,185,129,.15);color:var(--success);border:1px solid rgba(16,185,129,.3)">Tahsil edildi</span>`
      : `<span class="sbadge" style="background:rgba(245,158,11,.15);color:var(--warning);border:1px solid rgba(245,158,11,.3)">Bekliyor</span>`;
    return `<tr>
      <td style="font-weight:600">${r.cust_name||r.customer_name||"—"}</td>
      <td style="color:var(--text3);font-size:11px">${r.order_id||"—"}</td>
      <td style="font-weight:700">${fmt(r.sales_price||0)}</td>
      <td style="color:var(--danger)">-${fmt(kesinti)}</td>
      <td style="font-weight:700;color:var(--success)">${fmt(r.collection||0)}</td>
      <td style="color:var(--text3);font-size:11px">${(r.payment_date||"—").substring(0,10)}</td>
      <td style="color:var(--text3);font-size:11px">${r.planned_date||"—"}</td>
      <td>${statusBadge}</td>
    </tr>`;
  }).join("") : `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text3)">Kayıt bulunamadı.</td></tr>`;
}

// ── Excel import ──────────────────────────────────────────────
function parseShopierAmount(raw){
  return parseFloat(String(raw||"").trim().replace(/\s*TL\s*$/i,"").replace(/\./g,"").replace(",","."))||0;
}
function cleanShopierName(raw){
  return String(raw||"").replace(/\s+User\s*$/i,"").trim();
}
function matchCustomer(nameRaw,emailRaw,custMap,emailMap){
  const nl=nameRaw.toLowerCase(), el=emailRaw.toLowerCase().trim();
  if(emailMap[el]) return emailMap[el];
  if(custMap[nl])  return custMap[nl];
  const found=Object.keys(custMap).find(k=>k.includes(nl)||nl.includes(k));
  return found?custMap[found]:null;
}

export async function importShopierExcel(input){
  const file=input.files[0]; if(!file) return;
  const btn=input.previousElementSibling;
  const origLabel=btn.innerHTML;
  btn.innerHTML="<i class='ti ti-loader'></i> Yükleniyor...";

  const reader=new FileReader();
  reader.onload=async(e)=>{
    try {
      const data=new Uint8Array(e.target.result);
      const wb=XLSX.read(data,{type:"array",cellText:true,cellDates:false});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:""});
      if(!rows.length){showToast("❌ Excel boş.");btn.innerHTML=origLabel;return;}

      let headerRowIdx=0;
      for(let i=0;i<Math.min(5,rows.length);i++){if(rows[i].some(c=>String(c).includes("Sipariş No"))){headerRowIdx=i;break;}}
      const header=rows[headerRowIdx].map(h=>String(h||""));
      const getIdx=needle=>header.findIndex(h=>h.includes(needle));

      const idx={
        orderId:getIdx("Sipariş No"),orderDate:getIdx("Sipariş Oluşma"),payDate:getIdx("Sipariş Ödeme"),
        name:getIdx("Müşteri Adı"),email:getIdx("Müşteri E-posta"),
        sales:getIdx("Satış Fiyatı"),fee:getIdx("Hizmet Bedeli"),vat:getIdx("KDV"),
        net:getIdx("Tahsilat"),planDate:getIdx("Planlanan Ödeme"),
      };

      if(idx.orderId===-1||idx.sales===-1){showToast("❌ Excel formatı tanınamadı.");btn.innerHTML=origLabel;return;}

      const dataRows=rows.slice(headerRowIdx+1).filter(r=>String(r[idx.orderId]||"").trim());
      if(!dataRows.length){showToast("❌ Veri satırı bulunamadı.");btn.innerHTML=origLabel;return;}

      const custMap={},emailMap={};
      state.customers.forEach(c=>{custMap[c.name.toLowerCase().trim()]=c;if(c.email)emailMap[c.email.toLowerCase().trim()]=c;});

      let matched=0;
      const records=dataRows.map(r=>{
        const nameRaw=cleanShopierName(r[idx.name]);
        const emailRaw=String(r[idx.email]||"").trim();
        const cust=matchCustomer(nameRaw,emailRaw,custMap,emailMap);
        if(cust) matched++;
        const salesPrice=parseShopierAmount(r[idx.sales]);
        const serviceFee=parseShopierAmount(r[idx.fee]);
        const vat=parseShopierAmount(r[idx.vat]);
        const collection=idx.net!==-1?parseShopierAmount(r[idx.net]):salesPrice-serviceFee-vat;
        return {
          order_id:String(r[idx.orderId]||"").trim(),
          order_date:String(r[idx.orderDate]||"").trim(),
          payment_date:String(r[idx.payDate]||"").trim(),
          customer_name:nameRaw,customer_email:emailRaw,
          sales_price:salesPrice,service_fee:serviceFee,vat,collection,
          planned_date:idx.planDate!==-1?String(r[idx.planDate]||"").trim():"",
          cust_id:cust?.id||null,cust_name:cust?.name||null,
        };
      });

      const chunks=[];
      for(let i=0;i<records.length;i+=100) chunks.push(records.slice(i,i+100));
      for(const chunk of chunks){
        const {error}=await db.from("shopier_collections").upsert(chunk,{onConflict:"order_id",ignoreDuplicates:false});
        if(error) throw error;
      }

      await loadShopierCollections();
      btn.innerHTML=origLabel; input.value="";
      await addLog("import",`Shopier Excel yüklendi — ${records.length} kayıt, ${matched} eşleşme`,file.name);
      showToast(`✅ ${records.length} tahsilat yüklendi! ${matched}/${records.length} üye eşleşti.`);
    } catch(err){
      console.error("Shopier Excel import hatası:",err);
      btn.innerHTML=origLabel; input.value="";
      showToast("❌ Excel okuma hatası: "+(err.message||err));
    }
  };
  reader.readAsArrayBuffer(file);
}
