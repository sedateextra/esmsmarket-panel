// ── config.js — Sabitler ve global state ──────────────────────
export const SUPABASE_URL = "https://ngfvvsrnnyotbwrdvxjl.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nZnZ2c3JubnlvdGJ3cmR2eGpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNTMyNDIsImV4cCI6MjA5NzYyOTI0Mn0.2W49qbQk6M_jKu5W9lEsejW6l4J_jP68HvajMTEizt8";
export const TG_TOKEN   = "8933364198:AAEdg55SxM0R2ZudVgCQlOJ41rb2Kb8SwKE";
export const TG_CHAT_ID = "8792365962";
export const HERO_BASE  = "https://hero-sms.com/stubs/handler_api.php";
export const HERO_KEY   = "6bAcA64fAc5373ddA7d49c488452A5c2";
export const USD_TRY    = 47.63;
export const PRICE_USD  = 1.02;
export const PAGE_SIZE  = 15;

export const USERS = {
  jordan:{ pass:"krAl123lords",   role:"Yönetici", color:"#8b5cf6", initials:"J", avatarBg:"linear-gradient(135deg,#8b5cf6,#6d28d9)" },
  brad:  { pass:"Kaptanalex123.", role:"Yönetici", color:"#ec4899", initials:"B", avatarBg:"linear-gradient(135deg,#ec4899,#db2777)" }
};

// Global state — tüm modüller import eder
export const state = {
  currentUser: null,
  customers: [],
  transactions: [],
  expenses: [],
  logs: [],
  bonusRules: {},
  borclar: [],
  shopierCollections: [],
  nakitHareketler: [],
  smsLogs: [],
  custPage: 0,
  dateFilter: "all",
  noteTargetId: null,
  custEditId: null,
  currentExpenseType: "",
  chartMode: "monthly",
  trendChart: null,
  xlPending: null,
  sessionSecondsLeft: 30 * 60,
  sessionInterval: null,
  kasaCurrentTab: "all",
  donemKapatTip: null,
};
