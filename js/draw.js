// ==========================================
// SORTEIO — Roleta, Animação, Card do Vencedor
// ==========================================

function renderRouletteView() {
  const tally = calculateFinalists();
  const container = document.getElementById('rouletteCardsContainer');
  const winnerContainer = document.getElementById('winnerCardContainer');
  const chancesLabel = document.getElementById('drawChancesLabel');
  const btn = document.getElementById('drawActionBtn');

  if (!container || !chancesLabel || !btn) return;

  const survivingCount = tally.filter(r => !!r.survivingBook).length;

  const cardsSignature = JSON.stringify(tally.map(res => ({
    member: res.member.name,
    book: res.survivingBook ? `${res.survivingBook.title}|${res.survivingBook.cover}` : null
  })));

  // Renderiza as cartas apenas se os finalistas/livros realmente mudaram
  if (_lastRouletteCardsSignature !== cardsSignature || container.children.length === 0) {
    _lastRouletteCardsSignature = cardsSignature;
    container.className = `grid grid-cols-2 sm:grid-cols-${Math.min(survivingCount || 5, 5)} gap-4 max-w-3xl mx-auto`;

    container.innerHTML = tally.map((res, index) => {
      const book = res.survivingBook;
      if (!book) return '';

      return `
        <div id="drawCandidate-${index}" class="roulette-card bg-stone-50 rounded-2xl p-3 border-2 border-stone-200 transition-all duration-200 flex flex-col items-center text-center relative">
          <div id="drawOnlineDot-${index}" class="absolute top-2 right-2 w-3 h-3 rounded-full border border-white shadow-sm bg-stone-300" title="Offline"></div>
          <img src="${book.cover || DEFAULT_BOOK_COVER}" class="w-20 h-28 object-cover rounded-xl shadow-md mb-2" loading="lazy" decoding="async" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;">
          <span class="text-[10px] font-bold text-burgundy uppercase truncate max-w-full">${escapeHtml(res.member.name)}</span>
          <h4 class="font-serif font-bold text-xs text-stone-900 line-clamp-2 mt-0.5">${escapeHtml(book.title)}</h4>
        </div>`;
    }).join('');
  }

  // Atualiza os indicadores de presença sem tocar nas cartas nem nas imagens
  updateRoulettePresenceIndicators();

  if (window.clubState.winner && winnerContainer) {
    renderWinnerCard(window.clubState.winner);
  } else if (winnerContainer) {
    winnerContainer.classList.add('hidden');
  }
}

function updateRoulettePresenceIndicators() {
  const tally = calculateFinalists();
  const chancesLabel = document.getElementById('drawChancesLabel');
  const btn = document.getElementById('drawActionBtn');
  if (!chancesLabel || !btn) return;

  const survivingCount = tally.filter(r => !!r.survivingBook).length;
  const now = Date.now();
  const PRESENCE_TIMEOUT = 35000; // 35s de tolerância para conexões móveis
  const onlineMembers = window.clubState.members.filter(m => (now - (window.clubState.presence?.[m.id] || 0)) < PRESENCE_TIMEOUT);
  const allOnline = onlineMembers.length === window.clubState.members.length && window.clubState.members.length > 1;

  if (survivingCount > 0) {
    btn.disabled = false;
    if (allOnline) {
      chancesLabel.innerHTML = `<span class="text-emerald-600 font-bold flex items-center justify-center gap-1"><i class="ph ph-check-circle"></i> Todos online! O sorteio está liberado.</span>`;
    } else {
      const missing = window.clubState.members.filter(m => !onlineMembers.includes(m)).map(m=>m.name).join(', ');
      chancesLabel.innerHTML = `<span class="text-amber-600 font-medium flex items-center justify-center gap-1 text-xs"><i class="ph ph-warning-circle"></i> Aguardando <strong>${missing || 'mais pessoas'}</strong> (você pode sortear se o grupo concordar)</span>`;
    }
  }

  tally.forEach((res, index) => {
    const dot = document.getElementById(`drawOnlineDot-${index}`);
    if (dot) {
      const isOnline = (now - (window.clubState.presence?.[res.member.id] || 0)) < PRESENCE_TIMEOUT;
      dot.className = `absolute top-2 right-2 w-3 h-3 rounded-full border border-white shadow-sm ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300'}`;
      dot.title = isOnline ? 'Online agora' : 'Offline';
    }
  });
}

async function initiateDraw() {
  if (isDrawing) return;
  const tally = calculateFinalists().filter(f => !!f.survivingBook);
  if (tally.length === 0) return;

  const now = Date.now();
  const PRESENCE_TIMEOUT = 35000;
  const onlineMembers = window.clubState.members.filter(m => (now - (window.clubState.presence?.[m.id] || 0)) < PRESENCE_TIMEOUT);
  
  if (onlineMembers.length < window.clubState.members.length && window.clubState.members.length > 1) {
     const missingNames = window.clubState.members.filter(m => !onlineMembers.includes(m)).map(m => m.name).join(', ');
     const confirmDraw = confirm(`Atenção: ${missingNames} parece(m) ausente(s) ou offline no momento.\n\nDeseja realizar o sorteio mesmo assim?`);
     if (!confirmDraw) return;
  }

  const winnerIndex = Math.floor(Math.random() * tally.length);
  const chosen = tally[winnerIndex];

  const winnerData = {
    book: chosen.survivingBook,
    member: chosen.member.name,
    drawnAt: new Date().toLocaleTimeString('pt-BR')
  };

  const drawEvent = {
    triggerBy: window.localCurrentUser,
    winnerIndex: winnerIndex,
    winnerData: winnerData,
    timestamp: Date.now()
  };

  if (!window.clubState.drawLogs) window.clubState.drawLogs = [];
  window.clubState.drawLogs.push(drawEvent);
  window.clubState.drawEvent = drawEvent;
  window.clubState.winner = winnerData;
  window.clubState.updatedAt = Date.now();

  // SALVAMENTO SEGURO E GRANULAR:
  // Atualiza apenas os campos do sorteio — NUNCA toca em members ou votes no Firestore!
  if (window.currentRoomId && db) {
    try {
      await db.collection("clubes").doc(window.currentRoomId).update({
        'state.drawLogs': window.clubState.drawLogs,
        'state.drawEvent': drawEvent,
        'state.winner': winnerData,
        'state.updatedAt': window.clubState.updatedAt
      });
      updateSyncStatus(true);
    } catch(err) {
      console.error('[Draw] Erro ao registrar sorteio na nuvem:', err);
    }
  }

  window.lastDrawTimestamp = drawEvent.timestamp;
  triggerSyncedDraw(drawEvent);
}

function triggerSyncedDraw(eventData) {
  if (isDrawing) return;
  isDrawing = true;

  const tally = calculateFinalists().filter(f => !!f.survivingBook);
  const btn = document.getElementById('drawActionBtn');
  if (btn) btn.classList.add('opacity-50', 'pointer-events-none');
  const winnerCard = document.getElementById('winnerCardContainer');
  if (winnerCard) winnerCard.classList.add('hidden');

  let cycles = 20 + Math.floor(Math.random() * 5); 
  let currentIndex = 0;
  let speed = 80;

  function step() {
    tally.forEach((_, idx) => {
      const card = document.getElementById(`drawCandidate-${idx}`);
      if (card) {
        card.classList.remove('border-gold', 'bg-gold/15', 'scale-105', 'shadow-lg');
        card.classList.add('border-stone-200', 'bg-stone-50');
      }
    });

    const activeCard = document.getElementById(`drawCandidate-${currentIndex}`);
    if (activeCard) {
      activeCard.classList.remove('border-stone-200', 'bg-stone-50');
      activeCard.classList.add('border-gold', 'bg-gold/15', 'scale-105', 'shadow-lg');
    }
    playSound('click');

    cycles--;
    if (cycles > 0) {
      currentIndex = (currentIndex + 1) % tally.length;
      if (cycles < 8) speed += 40;
      setTimeout(step, speed);
    } else {
      tally.forEach((_, idx) => {
        const card = document.getElementById(`drawCandidate-${idx}`);
        if (card) {
            card.classList.remove('border-gold', 'bg-gold/15', 'scale-105', 'shadow-lg');
            card.classList.add('border-stone-200', 'bg-stone-50');
        }
      });
      const winnerCardElement = document.getElementById(`drawCandidate-${eventData.winnerIndex}`);
      if (winnerCardElement) {
         winnerCardElement.classList.add('border-gold', 'bg-gold/15', 'scale-105', 'shadow-lg');
      }

      window.clubState.winner = eventData.winnerData;
      playSound('winner');

      if (window.confetti) {
        window.confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      }

      renderWinnerCard(eventData.winnerData);
      isDrawing = false;
      if (btn) btn.classList.remove('opacity-50', 'pointer-events-none');
    }
  }
  step();
}

function renderWinnerCard(winnerData) {
  const container = document.getElementById('winnerCardContainer');
  if (!container || !winnerData) return;
  const { book, member, drawnAt } = winnerData;

  const logsCount = (window.clubState.drawLogs || []).length;
  const signature = `${book?.title}|${book?.cover}|${member}|${drawnAt}|${logsCount}`;

  if (_lastWinnerCardSignature === signature && container.children.length > 0 && !container.classList.contains('hidden')) {
    return; // Card do vencedor já renderizado
  }
  _lastWinnerCardSignature = signature;

  let logsHtml = '';
  if (window.clubState.drawLogs && window.clubState.drawLogs.length > 0) {
     logsHtml = `
       <div class="mt-6 pt-4 border-t border-gold/30 text-xs text-stone-600 text-left max-h-32 overflow-y-auto custom-scrollbar">
         <strong class="text-stone-800 block mb-2"><i class="ph ph-scroll"></i> Histórico do VAR (Nesta rodada):</strong>
         <ul class="space-y-1.5 pl-1">
           ${window.clubState.drawLogs.map(log => {
              const triggerName = getMemberName(log.triggerBy);
              return `<li><span class="text-burgundy font-bold">${triggerName}</span> rodou a roleta e caiu <i>"${escapeHtml(log.winnerData.book.title)}"</i> às ${new Date(log.timestamp).toLocaleTimeString('pt-BR')}</li>`;
           }).join('')}
         </ul>
       </div>
     `;
  }

  container.innerHTML = `
    <div class="bg-gradient-to-br from-[#FAF5EC] to-[#F1E8DA] rounded-3xl p-8 border-2 border-gold shadow-2xl relative overflow-hidden pulse-gold">
      <div class="absolute -right-6 -top-6 w-32 h-32 bg-gold/10 rounded-full blur-2xl"></div>
      
      <div class="text-center mb-6">
        <span class="inline-flex items-center gap-1 px-4 py-1 rounded-full bg-gold text-stone-900 font-extrabold text-xs uppercase tracking-widest shadow-xs">
          <i class="ph ph-crown-simple text-sm"></i> Livro Escolhido do Mês
        </span>
      </div>

      <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <img src="${book.cover || DEFAULT_BOOK_COVER}" alt="${escapeHtml(book.title)}" class="w-36 h-52 object-cover rounded-2xl shadow-xl border border-gold/30 shrink-0" loading="lazy" decoding="async" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;">
        
        <div class="flex-1 text-center sm:text-left space-y-2 w-full">
          <span class="text-xs font-bold text-burgundy uppercase tracking-wider">Indicado por ${escapeHtml(member)}</span>
          <h3 class="text-2xl sm:text-3xl font-serif font-bold text-stone-900 leading-tight">${escapeHtml(book.title)}</h3>
          <p class="text-sm font-medium text-stone-600">${escapeHtml(book.author)}</p>
          ${book.description ? `<p class="text-xs text-stone-500 line-clamp-3 pt-1 italic font-serif">"${escapeHtml(book.description)}"</p>` : ''}
          
          <div class="pt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
            <button onclick="copySummaryToClipboard()" class="px-5 py-2.5 rounded-xl bg-burgundy hover:bg-burgundyLight text-white font-bold text-xs shadow-md transition flex items-center gap-2">
              <i class="ph ph-whatsapp-logo text-base"></i><span>Copiar Resumo para WhatsApp</span>
            </button>
            <button onclick="openResetCycleModal()" class="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm">
              <i class="ph ph-archive-box"></i><span>Arquivar & Iniciar Novo Mês</span>
            </button>
            <button onclick="initiateDraw()" class="px-4 py-2.5 rounded-xl bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 font-semibold text-xs transition">
              Sortear Novamente
            </button>
          </div>

          ${logsHtml}

        </div>
      </div>
    </div>
  `;

  container.classList.remove('hidden');
  container.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
