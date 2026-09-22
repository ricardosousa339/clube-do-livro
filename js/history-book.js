// ==========================================
// HISTÓRICO 3D — O GRANDE LIVRO DO ANO (TOMO INTERATIVO)
// ==========================================

const HistoryBook = {
  selectedYear: null,
  currentPage: 0, // 0 = Capa Fechada, 1 = Sumário, 2..N+1 = Leituras, N+2 = Retrospectiva
  mobileTab: 'work', // 'work' (A Obra) ou 'chronicle' (A Crônica e Disputa) no celular
  books: [],
  availableYears: [],
  isMobile: false,
  touchStartX: 0,
  touchEndX: 0,

  // Sintetizador Web Audio API para som suave e realista de folhear papel
  playPageTurnSound: function() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!window._bookAudioCtx) window._bookAudioCtx = new AudioCtx();
      const ctx = window._bookAudioCtx;
      if (ctx.state === 'suspended') ctx.resume();

      const bufferSize = Math.floor(ctx.sampleRate * 0.22); // ~220ms
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        // Ruído filtrado com decaimento exponencial (sussurro de papel)
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(750, ctx.currentTime);
      filter.Q.setValueAtTime(1.4, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.24, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.21);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
    } catch(e) {
      // Navegador bloqueou áudio sem interação ou não suportado
    }
  },

  // Inicializa e abre o livro
  open: function(year) {
    if (typeof closeHistoryModal === 'function') closeHistoryModal();

    const state = window.clubState || {};
    const history = state.history || [];

    // Detecta anos disponíveis no histórico
    const yearSet = new Set();
    const currentYear = new Date().getFullYear();

    history.forEach(item => {
      const text = `${item.monthLabel || ''} ${item.archivedAt || ''}`;
      const match = text.match(/\b(20\d\d)\b/);
      if (match) yearSet.add(parseInt(match[1], 10));
    });

    if (yearSet.size === 0) yearSet.add(currentYear);
    this.availableYears = Array.from(yearSet).sort((a, b) => b - a);

    this.selectedYear = year ? parseInt(year, 10) : this.availableYears[0];
    this.isMobile = window.innerWidth < 768;

    // Filtra livros do ano selecionado
    this.books = history.filter(item => {
      const text = `${item.monthLabel || ''} ${item.archivedAt || ''}`;
      return text.includes(String(this.selectedYear));
    });

    // Se não encontrou livros no ano específico mas tem histórico, pega todo o histórico
    if (this.books.length === 0 && history.length > 0) {
      this.books = history;
    }

    this.currentPage = 0; // Inicia com a capa fechada
    this.mobileTab = 'work';

    const modal = document.getElementById('historyBookModal');
    if (!modal) return;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    this.render();
    this.setupListeners();
    playSound('card');
  },

  close: function() {
    const modal = document.getElementById('historyBookModal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
    this.removeListeners();
  },

  switchYear: function(newYear) {
    this.open(newYear);
  },

  setMobileTab: function(tab) {
    if (this.mobileTab !== tab) {
      this.mobileTab = tab;
      this.playPageTurnSound();
      this.animateFlip(tab === 'chronicle' ? 'forward' : 'backward');
      this.render();
    }
  },

  // Navegação
  nextPage: function() {
    this.isMobile = window.innerWidth < 768;
    const totalPages = this.books.length > 0 ? (this.books.length + 2) : 1;

    // No celular, se estiver em uma leitura (pág 2 a N+1) e na aba "Obra", vira primeiro para a "Crônica"
    if (this.isMobile && this.currentPage >= 2 && this.currentPage < totalPages - 1) {
      if (this.mobileTab === 'work') {
        this.mobileTab = 'chronicle';
        this.playPageTurnSound();
        this.animateFlip('forward');
        this.render();
        return;
      }
    }

    if (this.currentPage < totalPages - 1) {
      this.currentPage++;
      this.mobileTab = 'work';
      this.playPageTurnSound();
      this.animateFlip('forward');
      this.render();
    }
  },

  prevPage: function() {
    this.isMobile = window.innerWidth < 768;
    const totalPages = this.books.length > 0 ? (this.books.length + 2) : 1;

    // No celular, se estiver em uma leitura e na aba "Crônica", volta primeiro para a "Obra"
    if (this.isMobile && this.currentPage >= 2 && this.currentPage < totalPages - 1) {
      if (this.mobileTab === 'chronicle') {
        this.mobileTab = 'work';
        this.playPageTurnSound();
        this.animateFlip('backward');
        this.render();
        return;
      }
    }

    if (this.currentPage > 0) {
      this.currentPage--;
      if (this.isMobile && this.currentPage >= 2 && this.currentPage < totalPages - 1) {
        this.mobileTab = 'chronicle';
      } else {
        this.mobileTab = 'work';
      }
      this.playPageTurnSound();
      this.animateFlip('backward');
      this.render();
    }
  },

  goToPage: function(pageIdx, tab = 'work') {
    if (pageIdx >= 0) {
      const dir = pageIdx > this.currentPage ? 'forward' : 'backward';
      this.currentPage = pageIdx;
      this.mobileTab = tab;
      this.playPageTurnSound();
      this.animateFlip(dir);
      this.render();
    }
  },

  animateFlip: function(direction) {
    const container = document.getElementById('tomeBookContainer');
    if (!container) return;
    const animClass = direction === 'forward' ? 'page-flip-anim-forward' : 'page-flip-anim-backward';
    container.classList.remove('page-flip-anim-forward', 'page-flip-anim-backward');
    void container.offsetWidth; // Trigger reflow
    container.classList.add(animClass);
    setTimeout(() => {
      container.classList.remove(animClass);
    }, 650);
  },

  // Renderiza toda a interface do livro 3D
  render: function() {
    this.isMobile = window.innerWidth < 768;
    this.renderHeader();
    this.renderBookContent();
    this.renderFooter();
  },

  // Barra de ferramentas superior (Seletor de Ano, Modo Lista, Fechar)
  renderHeader: function() {
    const headerEl = document.getElementById('tomeHeaderControls');
    if (!headerEl) return;

    const clubName = window.clubState?.clubName || 'Clube do Livro';

    let yearOptions = this.availableYears.map(y => 
      `<option value="${y}" ${y === this.selectedYear ? 'selected' : ''}>Crônicas de ${y}</option>`
    ).join('');

    headerEl.innerHTML = `
      <div class="flex items-center gap-2 sm:gap-3 min-w-0">
        <div class="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold text-sm shrink-0">
          <i class="ph ph-books"></i>
        </div>
        <div class="min-w-0">
          <h3 class="font-serif font-bold text-xs sm:text-sm text-stone-100 flex items-center gap-1.5 sm:gap-2 truncate">
            <span class="truncate">${escapeHtml(clubName)}</span>
            <span class="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-burgundy/60 border border-gold/40 text-gold font-mono shrink-0">Tomo 3D</span>
          </h3>
          <p class="hidden sm:block text-[11px] text-stone-400">O Grande Livro de Memórias das Leituras</p>
        </div>
      </div>

      <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <select onchange="HistoryBook.switchYear(this.value)" class="bg-stone-900/90 text-amber-300 border border-amber-500/40 rounded-xl px-2.5 py-1.5 sm:px-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-sm cursor-pointer max-w-[120px] sm:max-w-none truncate">
          ${yearOptions}
        </select>

        <button onclick="HistoryBook.close(); openHistoryModal();" title="Ver no formato de lista clássica" class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold border border-stone-700 transition">
          <i class="ph ph-list-dashes text-sm"></i>
          <span>Ver Lista</span>
        </button>

        <button onclick="HistoryBook.close()" title="Fechar Livro" class="w-8 h-8 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white flex items-center justify-center transition border border-stone-700">
          <i class="ph ph-x text-base font-bold"></i>
        </button>
      </div>
    `;
  },

  // Conteúdo Central do Tomo
  renderBookContent: function() {
    const container = document.getElementById('tomeBookContainer');
    if (!container) return;

    // Se o histórico estiver totalmente vazio
    if (this.books.length === 0) {
      container.innerHTML = this.renderEmptyState();
      return;
    }

    // 1. CAPA FECHADA (Page 0)
    if (this.currentPage === 0) {
      container.innerHTML = this.renderCover();
      return;
    }

    // 2. SUMÁRIO / ÍNDICE (Page 1)
    if (this.currentPage === 1) {
      container.innerHTML = this.renderSummary();
      return;
    }

    // 3. RETROSPECTIVA FINAL (Última Página)
    const lastPageIdx = this.books.length + 2;
    if (this.currentPage === lastPageIdx - 1) {
      container.innerHTML = this.renderRetrospective();
      return;
    }

    // 4. LEITURA ESPECÍFICA (Páginas 2 a N+1)
    const bookIdx = this.currentPage - 2;
    const currentBook = this.books[bookIdx];
    if (currentBook) {
      container.innerHTML = this.renderBookSpread(currentBook, bookIdx);
    }
  },

  // 1. Capa com Mosaico Artístico do Ano
  renderCover: function() {
    const clubName = window.clubState?.clubName || 'Clube do Livro';
    const booksCount = this.books.length;
    const year = this.selectedYear;

    let mosaicHtml = '';
    if (booksCount > 0) {
      let gridCols = 'grid-cols-2';
      if (booksCount >= 3 && booksCount <= 4) gridCols = 'grid-cols-2 sm:grid-cols-4';
      else if (booksCount >= 5 && booksCount <= 8) gridCols = 'grid-cols-3 sm:grid-cols-4';
      else if (booksCount > 8) gridCols = 'grid-cols-4 sm:grid-cols-6';

      mosaicHtml = `
        <div class="grid ${gridCols} gap-2 sm:gap-2.5 max-w-[500px] mx-auto p-2.5 sm:p-4 rounded-2xl bg-black/40 border border-gold/30 shadow-inner backdrop-blur-xs">
          ${this.books.map((item, idx) => {
            const w = item.winner || {};
            const cover = w.cover || DEFAULT_BOOK_COVER;
            return `
              <div class="group relative aspect-[2/3] rounded-lg overflow-hidden border border-gold/40 shadow-md shadow-black/60 transition-transform duration-300 hover:scale-105 hover:z-10 cursor-pointer" onclick="HistoryBook.goToPage(${idx + 2})" title="${escapeHtml(w.title || 'Livro')} — ${escapeHtml(item.monthLabel || '')}">
                <img src="${cover}" alt="${escapeHtml(w.title)}" class="w-full h-full object-cover book-cover" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;">
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
                  <span class="text-[8px] font-bold text-amber-200 leading-tight truncate w-full text-center">${escapeHtml(item.monthLabel?.split(' ')[0] || '')}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    return `
      <div class="tome-leather w-full h-full p-5 sm:p-10 flex flex-col justify-between text-center relative cursor-pointer select-none" onclick="HistoryBook.nextPage()" title="Clique para Abrir o Tomo">
        <div class="corner-ornament corner-tl"></div>
        <div class="corner-ornament corner-tr"></div>
        <div class="corner-ornament corner-bl"></div>
        <div class="corner-ornament corner-br"></div>

        <!-- Topo da Capa -->
        <div class="space-y-1 sm:space-y-2 z-10 pt-1 sm:pt-2">
          <div class="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-gold/15 border border-gold/40 text-gold text-[10px] sm:text-xs font-bold tracking-widest uppercase">
            <i class="ph ph-sparkle"></i> Crônicas Literárias • ${year}
          </div>
          <h1 class="font-serif font-black text-xl sm:text-4xl text-amber-100 gold-emboss tracking-wide">
            ${escapeHtml(clubName.toUpperCase())}
          </h1>
          <p class="text-[11px] sm:text-sm text-stone-300/90 font-serif italic max-w-md mx-auto line-clamp-2">
            Volume Oficial de Leituras, Debates e Apurações do Ano
          </p>
        </div>

        <!-- Centro da Capa: Mosaico das Capas -->
        <div class="my-auto py-2 z-10 overflow-y-auto max-h-[280px] sm:max-h-none custom-scrollbar">
          ${mosaicHtml}
        </div>

        <!-- Rodapé da Capa -->
        <div class="z-10 pb-1 sm:pb-2 space-y-2 sm:space-y-3">
          <div class="flex items-center justify-center gap-1.5 text-stone-400 text-[11px] sm:text-xs font-medium">
            <i class="ph ph-book-bookmark text-gold"></i>
            <span>${booksCount} ${booksCount === 1 ? 'obra registrada' : 'obras registradas'} em ${year}</span>
          </div>
          
          <button onclick="event.stopPropagation(); HistoryBook.nextPage();" class="px-5 py-2.5 sm:px-8 sm:py-3 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-950/50 hover:scale-105 active:scale-95 transition-all inline-flex items-center gap-2 border border-amber-300">
            <i class="ph ph-book-open text-base sm:text-lg"></i>
            <span>Abrir Tomo do Ano</span>
            <i class="ph ph-arrow-right text-xs"></i>
          </button>
        </div>
      </div>
    `;
  },

  // 2. Sumário / Índice do Ano
  renderSummary: function() {
    const clubName = window.clubState?.clubName || 'Clube do Livro';
    const year = this.selectedYear;

    const listHtml = this.books.map((item, idx) => {
      const w = item.winner || {};
      const pageNum = idx + 2;
      return `
        <div onclick="HistoryBook.goToPage(${pageNum})" class="p-2 sm:p-3 rounded-xl hover:bg-stone-200/60 border border-stone-200/80 bg-white/60 sm:bg-transparent flex items-center justify-between cursor-pointer transition group">
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <span class="w-6 h-6 rounded-lg bg-burgundy/10 text-burgundy font-bold text-xs flex items-center justify-center shrink-0 group-hover:bg-burgundy group-hover:text-white transition">
              ${idx + 1}
            </span>
            <div class="min-w-0 text-left">
              <span class="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-burgundy block">${escapeHtml(item.monthLabel || '')}</span>
              <h4 class="font-serif font-bold text-xs sm:text-sm text-stone-900 truncate group-hover:text-burgundy transition">${escapeHtml(w.title || 'Sem título')}</h4>
              <span class="text-[10px] sm:text-[11px] text-stone-500 truncate block">${escapeHtml(w.author || '')}</span>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-[10px] sm:text-xs font-mono text-stone-400">pág. ${pageNum}</span>
            <i class="ph ph-arrow-right text-stone-400 group-hover:text-burgundy transition text-xs"></i>
          </div>
        </div>
      `;
    }).join('');

    // NO CELULAR: RENDERIZA UMA ÚNICA PÁGINA (SUMÁRIO COMPLETO)
    if (this.isMobile) {
      return `
        <div class="tome-paper w-full h-full p-4 sm:p-6 rounded-2xl flex flex-col justify-between shadow-2xl border border-stone-300">
          <div>
            <div class="flex items-center justify-between pb-2.5 border-b border-stone-200">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-burgundy text-gold flex items-center justify-center text-base shadow-xs shrink-0">
                  <i class="ph ph-books"></i>
                </div>
                <div>
                  <h3 class="font-serif font-bold text-sm text-stone-900 leading-tight">Sumário das Leituras</h3>
                  <span class="text-[10px] text-stone-500 font-serif">Crônicas de ${year}</span>
                </div>
              </div>
              <span class="text-[10px] font-bold text-burgundy bg-burgundy/10 px-2 py-0.5 rounded-full shrink-0">${this.books.length} Obras</span>
            </div>

            <div class="mt-2.5 space-y-1.5 overflow-y-auto max-h-[380px] custom-scrollbar pr-1">
              ${listHtml}
            </div>
          </div>

          <div class="pt-2.5 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
            <button onclick="HistoryBook.goToPage(0)" class="text-burgundy font-bold hover:underline flex items-center gap-1">
              <i class="ph ph-arrow-left"></i> Capa
            </button>
            <span class="font-mono text-[10px] text-stone-400">— 1 —</span>
            <button onclick="HistoryBook.nextPage()" class="text-burgundy font-bold hover:underline flex items-center gap-1">
              Começar <i class="ph ph-arrow-right"></i>
            </button>
          </div>
        </div>
      `;
    }

    // NO DESKTOP: RENDERIZA SPREAD DUPLO (ESQUERDA + DIREITA)
    return `
      <div class="w-full h-full flex flex-row relative">
        <div class="tome-ribbon"></div>
        <div class="tome-spine-shadow"></div>

        <!-- Página Esquerda: Frontispício / Saudação -->
        <div class="tome-paper tome-page-left w-1/2 h-full p-6 sm:p-8 flex flex-col justify-between border-r border-stone-200/80">
          <div class="text-center pt-4 space-y-2">
            <div class="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-2xl bg-burgundy text-gold flex items-center justify-center text-2xl sm:text-3xl shadow-md">
              <i class="ph ph-books"></i>
            </div>
            <h2 class="font-serif font-black text-lg sm:text-2xl text-stone-900 leading-tight">
              ${escapeHtml(clubName)}
            </h2>
            <div class="h-0.5 w-16 bg-burgundy/30 mx-auto"></div>
            <p class="text-xs text-stone-500 font-serif uppercase tracking-widest">Anais de ${year}</p>
          </div>

          <div class="text-center px-2 py-4 space-y-3 my-auto">
            <p class="font-serif text-xs sm:text-sm text-stone-700 italic leading-relaxed">
              "Um livro não é apenas papel e tinta, mas o ponto de encontro de ideias, emoções e debates compartilhados."
            </p>
            <p class="text-[11px] text-stone-500">
              Este tomo registra os livros sorteados e lidos pelos integrantes durante os ciclos de ${year}.
            </p>
          </div>

          <div class="text-center text-[10px] text-stone-400 font-mono border-t border-stone-200 pt-3">
            — Folha de Rosto • Edição do Clube —
          </div>
        </div>

        <!-- Página Direita: Sumário das Leituras -->
        <div class="tome-paper tome-page-right w-1/2 h-full p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 class="font-serif font-bold text-sm sm:text-base text-stone-900 flex items-center gap-2">
                <i class="ph ph-list-bullets text-burgundy"></i>
                <span>Sumário das Leituras</span>
              </h3>
              <span class="text-[11px] text-stone-500 font-bold">${this.books.length} Obras</span>
            </div>

            <div class="mt-3 space-y-1 overflow-y-auto max-h-[380px] custom-scrollbar pr-1">
              ${listHtml}
            </div>
          </div>

          <div class="pt-3 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
            <button onclick="HistoryBook.goToPage(0)" class="text-burgundy font-bold hover:underline flex items-center gap-1">
              <i class="ph ph-arrow-left"></i> Capa
            </button>
            <span class="font-mono text-[10px] text-stone-400">— 1 —</span>
            <button onclick="HistoryBook.nextPage()" class="text-burgundy font-bold hover:underline flex items-center gap-1">
              Começar <i class="ph ph-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  // 3. Página dos Livros (Mobile: 1 página por vez com abas / Desktop: 2 páginas lado a lado)
  renderBookSpread: function(item, bookIdx) {
    const w = item.winner || {};
    const cover = w.cover || DEFAULT_BOOK_COVER;
    const pageNum = bookIdx + 2;
    const totalPages = this.books.length + 2;

    // Disputa / Finalistas
    let finalistsHtml = '';
    if (item.finalists && item.finalists.length > 1) {
      const others = item.finalists.filter(f => f.title !== w.title || f.member !== w.member);
      finalistsHtml = `
        <div class="mt-2.5 p-2.5 sm:p-3 rounded-xl bg-stone-100/90 border border-stone-200 text-left">
          <div class="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1 flex items-center gap-1">
            <i class="ph ph-scales text-burgundy"></i> Disputou com ${others.length} finalista(s):
          </div>
          <div class="space-y-1">
            ${others.map(f => `
              <div class="flex items-center justify-between text-xs text-stone-600">
                <span class="truncate font-medium">${escapeHtml(f.title)}</span>
                <span class="text-[10px] text-stone-400 shrink-0 ml-2">por ${escapeHtml(f.member)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Botão de Download se disponível
    const downloadBtn = w.downloadUrl ? `
      <a href="${escapeHtml(w.downloadUrl)}" target="_blank" rel="noopener noreferrer" class="mt-2.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition">
        <i class="ph ph-download-simple text-sm"></i>
        <span>Baixar Exemplar (PDF / ePub)</span>
      </a>
    ` : '';

    // ==========================================
    // NO CELULAR (< 768px): EXIBE UMA ÚNICA PÁGINA
    // ==========================================
    if (this.isMobile) {
      // Abas de navegação interna do livro no celular
      const mobileTabControls = `
        <div class="flex items-center justify-center p-1 bg-stone-200/80 rounded-xl mb-2 shrink-0">
          <button onclick="HistoryBook.setMobileTab('work')" class="flex-1 py-1 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${this.mobileTab === 'work' ? 'bg-white text-burgundy shadow-xs' : 'text-stone-500'}">
            <i class="ph ph-book-open"></i> A Obra
          </button>
          <button onclick="HistoryBook.setMobileTab('chronicle')" class="flex-1 py-1 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${this.mobileTab === 'chronicle' ? 'bg-white text-burgundy shadow-xs' : 'text-stone-500'}">
            <i class="ph ph-scales"></i> A Crônica
          </button>
        </div>
      `;

      if (this.mobileTab === 'work') {
        // PÁGINA MOBILE A: A OBRA E A INDICAÇÃO
        return `
          <div class="tome-paper w-full h-full p-4 rounded-2xl flex flex-col justify-between shadow-2xl border border-stone-300">
            <div>
              ${mobileTabControls}
              <div class="flex items-center justify-between">
                <span class="text-[9px] font-extrabold uppercase tracking-widest text-burgundy bg-burgundy/10 px-2 py-0.5 rounded-full inline-block">
                  ${escapeHtml(item.monthLabel || item.archivedAt || 'Ciclo')}
                </span>
                <span class="text-[10px] font-mono text-stone-400">Pág. ${pageNum} (A)</span>
              </div>
            </div>

            <!-- Capa do Livro em Destaque -->
            <div class="my-auto py-2 flex flex-col items-center">
              <div class="relative group max-w-[160px] aspect-[2/3] rounded-xl overflow-hidden shadow-xl border-2 border-stone-300 transition-transform duration-300">
                <img src="${cover}" alt="${escapeHtml(w.title)}" class="w-full h-full object-cover book-cover" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;">
              </div>

              <!-- Card de quem indicou -->
              <div class="mt-3 px-3 py-1.5 rounded-xl bg-white border border-stone-200 shadow-xs flex items-center gap-2 max-w-xs w-full">
                <div class="w-6 h-6 rounded-lg bg-burgundy text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                  ${escapeHtml((w.member || 'CL').substring(0, 2).toUpperCase())}
                </div>
                <div class="min-w-0 text-left">
                  <span class="text-[8px] uppercase font-bold text-emerald-700 block">Indicação Campeã</span>
                  <span class="text-xs font-bold text-stone-900 truncate block">${escapeHtml(w.member || 'Integrante')}</span>
                </div>
              </div>

              ${downloadBtn}
            </div>

            <!-- Rodapé Mobile -->
            <div class="pt-2 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
              <button onclick="HistoryBook.prevPage()" class="text-burgundy hover:underline flex items-center gap-1 font-bold">
                <i class="ph ph-caret-left"></i> Anterior
              </button>
              <button onclick="HistoryBook.goToPage(1)" class="text-stone-400 hover:text-burgundy flex items-center gap-1 text-[11px]">
                <i class="ph ph-list-bullets"></i> Sumário
              </button>
              <button onclick="HistoryBook.setMobileTab('chronicle')" class="text-burgundy hover:underline flex items-center gap-1 font-bold">
                Crônica <i class="ph ph-caret-right"></i>
              </button>
            </div>
          </div>
        `;
      } else {
        // PÁGINA MOBILE B: A CRÔNICA E A DISPUTA
        return `
          <div class="tome-paper w-full h-full p-4 rounded-2xl flex flex-col justify-between shadow-2xl border border-stone-300">
            <div>
              ${mobileTabControls}
              <div class="flex items-center justify-between">
                <span class="text-[9px] font-extrabold uppercase tracking-widest text-burgundy bg-burgundy/10 px-2 py-0.5 rounded-full inline-block">
                  ${escapeHtml(item.monthLabel || item.archivedAt || 'Ciclo')}
                </span>
                <span class="text-[10px] font-mono text-stone-400">Pág. ${pageNum} (B)</span>
              </div>
            </div>

            <!-- Detalhes do Livro e Apuração -->
            <div class="my-auto py-2 space-y-2.5 text-left">
              <div>
                <span class="text-[9px] font-bold uppercase tracking-widest text-stone-400 block">Crônica da Escolha</span>
                <h3 class="font-serif font-black text-lg text-stone-900 leading-tight">
                  ${escapeHtml(w.title || 'Sem título')}
                </h3>
                <p class="font-serif text-xs text-stone-600 font-medium italic mt-0.5">
                  por ${escapeHtml(w.author || 'Autor não informado')}
                </p>
              </div>

              <div class="p-3 rounded-xl bg-burgundy/5 border border-burgundy/15">
                <span class="text-[9px] font-bold uppercase tracking-wider text-burgundy block mb-1">Registro da Eleição</span>
                <p class="text-xs text-stone-700 leading-relaxed">
                  Obra sorteada para o ciclo de <strong>${escapeHtml(item.monthLabel || item.archivedAt)}</strong> após aprovação dos integrantes.
                </p>
              </div>

              ${finalistsHtml}
            </div>

            <!-- Rodapé Mobile -->
            <div class="pt-2 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
              <button onclick="HistoryBook.setMobileTab('work')" class="text-burgundy hover:underline flex items-center gap-1 font-bold">
                <i class="ph ph-caret-left"></i> A Obra
              </button>
              <button onclick="HistoryBook.goToPage(1)" class="text-stone-400 hover:text-burgundy flex items-center gap-1 text-[11px]">
                <i class="ph ph-list-bullets"></i> Sumário
              </button>
              <button onclick="HistoryBook.nextPage()" class="text-burgundy hover:underline flex items-center gap-1 font-bold">
                Próximo <i class="ph ph-caret-right"></i>
              </button>
            </div>
          </div>
        `;
      }
    }

    // ==========================================
    // NO DESKTOP (>= 768px): SPREAD DUPLO (LADO A LADO)
    // ==========================================
    return `
      <div class="w-full h-full flex flex-row relative">
        <div class="tome-ribbon"></div>
        <div class="tome-spine-shadow"></div>

        <!-- Página Esquerda: A Obra e a Indicação -->
        <div class="tome-paper tome-page-left w-1/2 h-full p-6 sm:p-8 flex flex-col justify-between border-r border-stone-200/80">
          <div class="text-left">
            <span class="text-[10px] font-extrabold uppercase tracking-widest text-burgundy bg-burgundy/10 px-2.5 py-1 rounded-full inline-block">
              ${escapeHtml(item.monthLabel || item.archivedAt || 'Ciclo')}
            </span>
          </div>

          <!-- Capa Grande com Efeito e Sombra -->
          <div class="my-auto py-2 flex flex-col items-center">
            <div class="relative group max-w-[170px] sm:max-w-[210px] aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border-2 border-stone-300/80 transition-transform duration-300 hover:scale-105">
              <img src="${cover}" alt="${escapeHtml(w.title)}" class="w-full h-full object-cover book-cover" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;">
            </div>

            <!-- Card de quem indicou -->
            <div class="mt-4 px-3.5 py-2 rounded-xl bg-white border border-stone-200 shadow-xs flex items-center gap-2.5 max-w-xs w-full">
              <div class="w-7 h-7 rounded-lg bg-burgundy text-white font-bold text-xs flex items-center justify-center shrink-0">
                ${escapeHtml((w.member || 'CL').substring(0, 2).toUpperCase())}
              </div>
              <div class="min-w-0 text-left">
                <span class="text-[9px] uppercase font-bold text-emerald-700 block flex items-center gap-1">
                  <i class="ph ph-trophy text-xs"></i> Indicação Vencedora
                </span>
                <span class="text-xs font-bold text-stone-900 truncate block">${escapeHtml(w.member || 'Integrante')}</span>
              </div>
            </div>

            ${downloadBtn}
          </div>

          <div class="text-center font-mono text-[10px] text-stone-400 border-t border-stone-200 pt-2 flex items-center justify-between">
            <button onclick="HistoryBook.prevPage()" class="text-burgundy hover:underline flex items-center gap-1">
              <i class="ph ph-caret-left"></i> Anterior
            </button>
            <span>— Pág. ${pageNum} —</span>
            <span class="text-stone-300">•</span>
          </div>
        </div>

        <!-- Página Direita: A Crônica & A Disputa -->
        <div class="tome-paper tome-page-right w-1/2 h-full p-6 sm:p-8 flex flex-col justify-between">
          <div class="text-left space-y-2">
            <span class="text-[10px] font-bold uppercase tracking-widest text-stone-400">Crônica da Escolha</span>
            <h3 class="font-serif font-black text-xl sm:text-2xl text-stone-900 leading-tight">
              ${escapeHtml(w.title || 'Sem título')}
            </h3>
            <p class="font-serif text-xs sm:text-sm text-stone-600 font-medium italic">
              por ${escapeHtml(w.author || 'Autor não informado')}
            </p>
          </div>

          <div class="my-auto py-2 space-y-3">
            <div class="p-3.5 rounded-2xl bg-burgundy/5 border border-burgundy/15 text-left">
              <span class="text-[10px] font-bold uppercase tracking-wider text-burgundy block mb-1">Registro da Eleição</span>
              <p class="text-xs text-stone-700 leading-relaxed">
                Esta obra conquistou a aprovação do grupo e foi sorteada para guiar as leituras do clube no ciclo de <strong>${escapeHtml(item.monthLabel || item.archivedAt)}</strong>.
              </p>
              ${item.archivedAt ? `<span class="text-[10px] text-stone-400 mt-1.5 block">Sorteado & Arquivado em: ${escapeHtml(item.archivedAt)}</span>` : ''}
            </div>

            ${finalistsHtml}
          </div>

          <!-- Rodapé de Navegação da Página -->
          <div class="pt-3 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
            <button onclick="HistoryBook.goToPage(1)" class="text-stone-500 hover:text-burgundy flex items-center gap-1">
              <i class="ph ph-list-bullets"></i> Sumário
            </button>
            <span class="font-mono text-[10px] text-stone-400">— ${pageNum} de ${totalPages} —</span>
            <button onclick="HistoryBook.nextPage()" class="text-burgundy font-bold hover:underline flex items-center gap-1">
              Próximo <i class="ph ph-caret-right"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  // 4. Retrospectiva Final & Contracapa
  renderRetrospective: function() {
    const clubName = window.clubState?.clubName || 'Clube do Livro';
    const year = this.selectedYear;
    const booksCount = this.books.length;

    // Calcula membro com mais indicações no ano
    const memberCounts = {};
    this.books.forEach(b => {
      const m = b.winner?.member;
      if (m) memberCounts[m] = (memberCounts[m] || 0) + 1;
    });

    let topMember = 'Todos os integrantes';
    let maxWins = 0;
    Object.entries(memberCounts).forEach(([name, count]) => {
      if (count > maxWins) {
        maxWins = count;
        topMember = name;
      }
    });

    // NO CELULAR: RENDERIZA UMA ÚNICA PÁGINA (RETROSPECTIVA COMPACTA)
    if (this.isMobile) {
      return `
        <div class="tome-paper w-full h-full p-5 rounded-2xl flex flex-col justify-between shadow-2xl border border-stone-300 text-center">
          <div class="space-y-1">
            <span class="text-[9px] font-extrabold uppercase tracking-widest text-gold bg-stone-900 px-2.5 py-0.5 rounded-full inline-block">
              Retrospectiva • ${year}
            </span>
            <h3 class="font-serif font-black text-xl text-stone-900">
              Balanço Literário
            </h3>
          </div>

          <div class="my-auto py-2 space-y-2.5">
            <div class="grid grid-cols-2 gap-2">
              <div class="p-2.5 rounded-xl bg-stone-100 border border-stone-200 text-center">
                <span class="text-xl font-black text-burgundy font-serif">${booksCount}</span>
                <span class="text-[9px] font-bold text-stone-500 uppercase tracking-wider block mt-0.5">Livros Lidos</span>
              </div>
              <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-center">
                <span class="text-xl font-black text-amber-700 font-serif">${maxWins}</span>
                <span class="text-[9px] font-bold text-stone-500 uppercase tracking-wider block mt-0.5">Recorde</span>
              </div>
            </div>

            <div class="p-2.5 rounded-xl bg-white border border-stone-200 shadow-xs text-left flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-700 flex items-center justify-center text-base shrink-0">
                <i class="ph ph-medal"></i>
              </div>
              <div class="min-w-0">
                <span class="text-[8px] font-bold text-stone-400 uppercase tracking-wider block">Indicações Campeãs</span>
                <h5 class="font-bold text-xs text-stone-900 truncate">${escapeHtml(topMember)}</h5>
              </div>
            </div>

            <button onclick="generateYearMosaic()" class="w-full py-2 px-3 rounded-xl bg-stone-900 hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition">
              <i class="ph ph-image text-sm text-gold"></i>
              <span>Baixar Mosaico (PNG)</span>
            </button>
          </div>

          <div class="pt-2 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
            <button onclick="HistoryBook.goToPage(0)" class="text-burgundy font-bold hover:underline flex items-center gap-1">
              <i class="ph ph-book"></i> Capa
            </button>
            <span class="font-mono text-[10px] text-stone-400">— Fim —</span>
            <button onclick="HistoryBook.close()" class="text-stone-600 font-bold hover:underline flex items-center gap-1">
              Fechar <i class="ph ph-x"></i>
            </button>
          </div>
        </div>
      `;
    }

    // NO DESKTOP: SPREAD DUPLO
    return `
      <div class="w-full h-full flex flex-row relative">
        <div class="tome-ribbon"></div>
        <div class="tome-spine-shadow"></div>

        <!-- Página Esquerda: Retrospectiva do Ano -->
        <div class="tome-paper tome-page-left w-1/2 h-full p-6 sm:p-8 flex flex-col justify-between border-r border-stone-200/80">
          <div class="text-left">
            <span class="text-[10px] font-extrabold uppercase tracking-widest text-gold bg-stone-900 px-2.5 py-1 rounded-full inline-block">
              Retrospectiva • ${year}
            </span>
            <h3 class="font-serif font-black text-xl sm:text-2xl text-stone-900 mt-2">
              Balanço Literário
            </h3>
          </div>

          <div class="my-auto py-2 space-y-3">
            <div class="grid grid-cols-2 gap-2.5">
              <div class="p-3 rounded-xl bg-stone-100 border border-stone-200 text-center">
                <span class="text-2xl font-black text-burgundy font-serif">${booksCount}</span>
                <span class="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mt-0.5">Livros Lidos</span>
              </div>
              <div class="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
                <span class="text-2xl font-black text-amber-700 font-serif">${maxWins}</span>
                <span class="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mt-0.5">Recorde Individual</span>
              </div>
            </div>

            <div class="p-3.5 rounded-xl bg-white border border-stone-200 shadow-xs text-left flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center text-lg shrink-0">
                <i class="ph ph-medal"></i>
              </div>
              <div class="min-w-0">
                <span class="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Indicações Campeãs</span>
                <h5 class="font-bold text-xs sm:text-sm text-stone-900 truncate">${escapeHtml(topMember)}</h5>
              </div>
            </div>

            <button onclick="generateYearMosaic()" class="w-full py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition">
              <i class="ph ph-image text-base text-gold"></i>
              <span>Baixar Mosaico em Alta Resolução (PNG)</span>
            </button>
          </div>

          <div class="text-center font-mono text-[10px] text-stone-400 border-t border-stone-200 pt-2">
            — Fim do Volume de ${year} —
          </div>
        </div>

        <!-- Página Direita: Contracapa Interna -->
        <div class="tome-leather tome-page-right w-1/2 h-full p-6 sm:p-8 flex flex-col justify-between text-center relative">
          <div class="corner-ornament corner-tr"></div>
          <div class="corner-ornament corner-br"></div>

          <div class="my-auto space-y-4 z-10">
            <div class="w-14 h-14 mx-auto rounded-2xl bg-gold/15 border border-gold/40 text-gold flex items-center justify-center text-3xl shadow-lg">
              <i class="ph ph-bookmark-simple"></i>
            </div>
            <div>
              <h4 class="font-serif font-black text-xl text-amber-100 gold-emboss">
                Até o Próximo Ciclo!
              </h4>
              <p class="text-xs text-stone-300 font-serif italic max-w-xs mx-auto mt-2">
                "Novas histórias esperam por nossa próxima rodada de votação e sorteio."
              </p>
            </div>

            <div class="flex flex-col gap-2 max-w-xs mx-auto pt-2">
              <button onclick="HistoryBook.goToPage(0)" class="py-2 px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-bold transition">
                <i class="ph ph-book text-sm"></i> Voltar à Capa
              </button>
              <button onclick="HistoryBook.close()" class="py-2 px-4 rounded-xl bg-stone-900/80 hover:bg-stone-900 text-stone-300 text-xs font-semibold border border-stone-700 transition">
                Fechar Tomo
              </button>
            </div>
          </div>

          <div class="text-[10px] text-stone-400/80 font-mono z-10">
            ${escapeHtml(clubName)} • ${year}
          </div>
        </div>
      </div>
    `;
  },

  // Estado vazio quando não houver histórico arquivado
  renderEmptyState: function() {
    const clubName = window.clubState?.clubName || 'Clube do Livro';
    return `
      <div class="tome-leather w-full h-full p-8 sm:p-12 flex flex-col items-center justify-center text-center relative select-none">
        <div class="corner-ornament corner-tl"></div>
        <div class="corner-ornament corner-tr"></div>
        <div class="corner-ornament corner-bl"></div>
        <div class="corner-ornament corner-br"></div>

        <div class="w-16 h-16 rounded-3xl bg-gold/10 border border-gold/30 text-gold flex items-center justify-center text-3xl mb-4 shadow-lg">
          <i class="ph ph-books"></i>
        </div>
        <h2 class="font-serif font-black text-2xl sm:text-3xl text-amber-100 gold-emboss mb-2">
          ${escapeHtml(clubName)}
        </h2>
        <p class="font-serif italic text-sm text-stone-300 max-w-md mb-3">
          O Tomo deste ano ainda aguarda o encerramento do primeiro ciclo de leitura!
        </p>
        <p class="text-xs text-stone-400 max-w-sm mb-6">
          Ao concluir um ciclo e clicar em "Arquivar e Iniciar Novo Mês", as leituras preencherão este livro com a capa em mosaico e páginas 3D de cada obra!
        </p>

        <div class="flex flex-col sm:flex-row items-center gap-3">
          <button onclick="HistoryBook.loadDemoData()" class="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-black text-xs shadow-lg shadow-amber-950/40 transition flex items-center gap-2 border border-amber-300 hover:scale-105 active:scale-95">
            <i class="ph ph-sparkle text-sm"></i>
            <span>Ver Demonstração do Livro 3D</span>
          </button>
          <button onclick="HistoryBook.close()" class="px-5 py-2.5 rounded-2xl bg-stone-900/80 hover:bg-stone-800 text-stone-300 text-xs font-semibold border border-stone-700 transition">
            Voltar
          </button>
        </div>
      </div>
    `;
  },

  // Dados de demonstração para pré-visualização instantânea
  loadDemoData: function() {
    this.books = [
      {
        monthLabel: 'Janeiro de ' + this.selectedYear,
        archivedAt: '28/01/' + this.selectedYear,
        winner: {
          title: 'Dom Casmurro',
          author: 'Machado de Assis',
          cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400',
          member: 'Ricardo Henrique',
          downloadUrl: ''
        },
        finalists: [
          { title: 'Memórias Póstumas de Brás Cubas', member: 'Beatriz' },
          { title: 'O Cortiço', member: 'Carlos' }
        ]
      },
      {
        monthLabel: 'Fevereiro de ' + this.selectedYear,
        archivedAt: '25/02/' + this.selectedYear,
        winner: {
          title: '1984',
          author: 'George Orwell',
          cover: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&q=80&w=400',
          member: 'Beatriz',
          downloadUrl: ''
        },
        finalists: [
          { title: 'Admirável Mundo Novo', member: 'Ricardo Henrique' },
          { title: 'Fahrenheit 451', member: 'Ana' }
        ]
      },
      {
        monthLabel: 'Março de ' + this.selectedYear,
        archivedAt: '30/03/' + this.selectedYear,
        winner: {
          title: 'O Hobbit',
          author: 'J.R.R. Tolkien',
          cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=400',
          member: 'Carlos',
          downloadUrl: ''
        },
        finalists: [
          { title: 'O Nome do Vento', member: 'Beatriz' },
          { title: 'As Crônicas de Nárnia', member: 'Ana' }
        ]
      },
      {
        monthLabel: 'Abril de ' + this.selectedYear,
        archivedAt: '27/04/' + this.selectedYear,
        winner: {
          title: 'Duna',
          author: 'Frank Herbert',
          cover: 'https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?auto=format&fit=crop&q=80&w=400',
          member: 'Ana',
          downloadUrl: ''
        },
        finalists: [
          { title: 'Fundação', member: 'Carlos' },
          { title: 'Neuromancer', member: 'Ricardo Henrique' }
        ]
      }
    ];
    this.currentPage = 0;
    this.mobileTab = 'work';
    this.render();
  },

  // Barra de navegação inferior (Contador de Páginas & Setas)
  renderFooter: function() {
    const footerEl = document.getElementById('tomeFooterControls');
    if (!footerEl) return;

    const totalPages = this.books.length > 0 ? (this.books.length + 2) : 1;
    const isFirst = this.currentPage === 0;
    const isLast = this.currentPage >= totalPages - 1 && (!this.isMobile || this.mobileTab === 'chronicle');

    let pageLabel = 'Capa';
    if (this.currentPage === 1) pageLabel = 'Sumário';
    else if (this.currentPage > 1 && this.currentPage < totalPages - 1) {
      const bIdx = this.currentPage - 2;
      const b = this.books[bIdx];
      const mText = b?.monthLabel ? b.monthLabel.split(' ')[0] : `Livro ${bIdx + 1}`;
      pageLabel = this.isMobile ? `${mText} (${this.mobileTab === 'work' ? 'Obra' : 'Crônica'})` : (b?.monthLabel || `Leitura ${bIdx + 1}`);
    } else if (this.currentPage === totalPages - 1 && this.books.length > 0) {
      pageLabel = 'Retrospectiva';
    }

    footerEl.innerHTML = `
      <div class="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <button onclick="HistoryBook.prevPage()" ${isFirst ? 'disabled' : ''} class="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-stone-900/90 hover:bg-stone-800 disabled:opacity-40 disabled:pointer-events-none text-stone-200 border border-stone-700 text-xs font-bold transition flex items-center gap-1.5">
          <i class="ph ph-caret-left text-sm"></i>
          <span>Anterior</span>
        </button>

        <div class="px-3 py-1 sm:px-4 sm:py-1.5 rounded-xl bg-stone-900/90 border border-stone-800 text-stone-300 text-[11px] sm:text-xs font-mono flex items-center gap-1.5 sm:gap-2">
          <span class="font-bold text-gold truncate max-w-[120px] sm:max-w-none">${pageLabel}</span>
          <span class="text-stone-500">•</span>
          <span class="text-stone-400 shrink-0">${this.currentPage + 1}/${totalPages}</span>
        </div>

        <button onclick="HistoryBook.nextPage()" ${isLast ? 'disabled' : ''} class="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-stone-900/90 hover:bg-stone-800 disabled:opacity-40 disabled:pointer-events-none text-stone-200 border border-stone-700 text-xs font-bold transition flex items-center gap-1.5">
          <span>Próxima</span>
          <i class="ph ph-caret-right text-sm"></i>
        </button>
      </div>

      <div class="hidden sm:flex items-center gap-2 text-stone-500 text-[11px]">
        <i class="ph ph-keyboard text-xs"></i>
        <span>Use as setas <strong>←</strong> e <strong>→</strong> do teclado ou arraste para folhear</span>
      </div>
    `;
  },

  // Atalhos de teclado e gestos de toque (swipe)
  setupListeners: function() {
    this._keyHandler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        this.nextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        this.prevPage();
      } else if (e.key === 'Escape') {
        this.close();
      }
    };
    window.addEventListener('keydown', this._keyHandler);

    this._resizeHandler = () => {
      const mob = window.innerWidth < 768;
      if (mob !== this.isMobile) {
        this.isMobile = mob;
        this.render();
      }
    };
    window.addEventListener('resize', this._resizeHandler);

    // Gestos Touch (Mobile Swipe)
    const viewport = document.getElementById('historyBookModal');
    if (viewport) {
      this._touchStartHandler = (e) => {
        this.touchStartX = e.changedTouches[0].screenX;
      };
      this._touchEndHandler = (e) => {
        this.touchEndX = e.changedTouches[0].screenX;
        const diff = this.touchStartX - this.touchEndX;
        if (Math.abs(diff) > 40) {
          if (diff > 0) this.nextPage(); // Swipe para a esquerda -> avança
          else this.prevPage(); // Swipe para a direita -> volta
        }
      };
      viewport.addEventListener('touchstart', this._touchStartHandler, { passive: true });
      viewport.addEventListener('touchend', this._touchEndHandler, { passive: true });
    }
  },

  removeListeners: function() {
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    const viewport = document.getElementById('historyBookModal');
    if (viewport && this._touchStartHandler && this._touchEndHandler) {
      viewport.removeEventListener('touchstart', this._touchStartHandler);
      viewport.removeEventListener('touchend', this._touchEndHandler);
      this._touchStartHandler = null;
      this._touchEndHandler = null;
    }
  }
};

// Exposição global
window.HistoryBook = HistoryBook;
window.openHistoryBook = function(year) { HistoryBook.open(year); };
window.closeHistoryBook = function() { HistoryBook.close(); };
