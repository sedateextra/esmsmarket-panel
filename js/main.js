// ── main.js — Uygulama giriş noktası ─────────────────────────
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY, state } from './config.js';
import { setDb } from './data.js';
import { initAuth, doLogin, doLogout, fillDemo, resetSession } from './auth.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderCustomers, openCustomerModal, closeCustModal, saveCustomer, openCustDetail, openNoteModal, closeNoteModal, saveNote, deleteCustomer, updateCmMethod, setDateFilter, changePage, filterCustSelect, populateCustSelect, openBalanceHistory } from './ui/customers.js';
import { renderNewTxTable, calcBonus, saveTransaction, cancelTransaction } from './ui/transactions.js';
import { updateKasaMetrics, setKasaTab, setChartMode, renderChart, openExpense, saveExpense, exportKasaExcel, exportMonthlyReport, donemKapat, donemKapatOnayla, openNakitKasa, addNakitGiris, shopierToNakit, deleteTx, deleteExpense, clearKasaFilters } from './ui/kasa.js';
import { loadShopierCollections, renderShopierCollections, clearScFilters, importShopierExcel } from './ui/shopier.js';
import { renderBorcular, openBorcModal, closeBorcModal, saveBorc, openBorcPayment, deleteBorc, calcBorcKalan, closeBorcPayment, saveBorcPayment } from './ui/borclar.js';
import { renderTop10, setTop10Period } from './ui/top10.js';
import { renderLog } from './ui/log.js';
import { renderSmsPage, loadSmsLogs, loadSMSHistory } from './ui/sms.js';
import { renderBonusRulesEditor, saveBonusRule, openBonusRuleModal } from './ui/bonus.js';
import { loadXL, applyXL, exportXL, updateXLStats } from './ui/export.js';

// Supabase init
const db = createClient(SUPABASE_URL, SUPABASE_KEY);
setDb(db);
window._db = db; // global erişim için

// Auth init
initAuth();
document.addEventListener("click", resetSession);

// Global render
export function renderAll(){
  renderCustomers();
  populateCustSelect();
  renderNewTxTable();
  updateKasaMetrics();
  renderChart();
  renderBorcular();
  renderTop10();
  renderLog();
  renderDashboard();
  renderBonusRulesEditor();
  updateXLStats();
}

// Sayfa geçişi
export function showPage(id, btn){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".nav button").forEach(b=>b.classList.remove("active"));
  const pg = document.getElementById("page-"+id);
  if(pg) pg.classList.add("active");
  if(btn) btn.classList.add("active");

  if(id==="dashboard") setTimeout(renderDashboard, 50);
  if(id==="kasa"){
    state.kasaCurrentTab = "all";
    document.querySelectorAll("#page-kasa [id^='ktab-']").forEach(b=>{b.style.background="transparent";b.style.color="var(--text2)";});
    const allBtn = document.getElementById("ktab-all");
    if(allBtn){ allBtn.style.background="var(--grad)"; allBtn.style.color="#fff"; }
    document.getElementById("shopier-collections-wrap").style.display = "none";
    document.querySelectorAll("#page-kasa .metric-top-bar").forEach(el=>el.style.display="grid");
    const tc = document.querySelector("#page-kasa .card:has(#kasa-body)");
    if(tc) tc.style.display="block";
    setTimeout(()=>{ renderChart(); updateKasaMetrics(); }, 50);
  }
  if(id==="sms-takip") renderSmsPage();
  if(id==="top10") renderTop10();
  if(id==="log") renderLog();
  if(id==="bonus-rules") renderBonusRulesEditor();
  if(id==="islem") populateCustSelect();
  if(id==="excel") updateXLStats();
}

// ── Global'e aç (HTML onclick="..." için) ────────────────────
Object.assign(window, {
  showPage, renderAll,
  doLogin, doLogout, fillDemo,
  // customers
  renderCustomers, openCustomerModal, closeCustModal, saveCustomer,
  openCustDetail, openNoteModal, closeNoteModal, saveNote, deleteCustomer, updateCmMethod,
  setDateFilter, changePage, filterCustSelect, populateCustSelect, openBalanceHistory,
  // transactions
  calcBonus, saveTransaction, cancelTransaction,
  // kasa
  updateKasaMetrics, setKasaTab, setChartMode, renderChart,
  openExpense, saveExpense, exportKasaExcel, exportMonthlyReport,
  donemKapat, donemKapatOnayla,
  openNakitKasa, addNakitGiris, shopierToNakit,
  deleteTx, deleteExpense, clearKasaFilters,
  // shopier
  loadShopierCollections, renderShopierCollections, clearScFilters, importShopierExcel,
  // borclar
  renderBorcular, openBorcModal, closeBorcModal, saveBorc, openBorcPayment, deleteBorc,
  calcBorcKalan, closeBorcPayment, saveBorcPayment,
  // top10
  renderTop10, setTop10Period,
  // diğer
  renderLog, renderSmsPage, loadSMSHistory,
  saveBonusRule, openBonusRuleModal, loadXL, applyXL, exportXL,
});
