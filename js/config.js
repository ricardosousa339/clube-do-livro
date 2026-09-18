// ==========================================
// CONFIGURAÇÃO GLOBAL
// ==========================================

// Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBlLRN4jQi0jx0JrGCuRLTCkzuWrFEcxkA",
  authDomain: "clube-do-livro-f08eb.firebaseapp.com",
  projectId: "clube-do-livro-f08eb",
  storageBucket: "clube-do-livro-f08eb.firebasestorage.app",
  messagingSenderId: "659224781914",
  appId: "1:659224781914:web:7ac9e54530f36f3fa32463"
};

// Placeholder instantâneo via SVG Data URI — 0ms de latência, sem rede, nunca falha
const DEFAULT_BOOK_COVER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='180' viewBox='0 0 120 180'%3E%3Crect width='100%25' height='100%25' fill='%234a3b32'/%3E%3Cpath d='M35 60 h50 M35 75 h50 M35 90 h35' stroke='%23d4af37' stroke-width='2.5' stroke-linecap='round'/%3E%3Ctext x='60' y='130' fill='%23fbf9f4' font-family='sans-serif' font-size='10' font-weight='bold' text-anchor='middle'%3ESem Capa%3C/text%3E%3C/svg%3E";
