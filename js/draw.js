// ==========================================
// SORTEIO — Roleta, Animação, Card do Vencedor, Ciclo Fechado
// ==========================================

function getEligibleForDraw() {
  const tally = calculateFinalists().filter(f => !!f.survivingBook);
  const cycle = window.clubState.closedCycle;

  if (!cycle || !cycle.enabled || !Array.isArray(cycle.winners) || cycle.winners.length === 0) {
    return { eligible: tally, champions: [], allTally: tally };
  }

  const eligible = tally.filter(f => !cycle.winners.includes(f.member.id));
  const champions = tally.filter(f => cycle.winners.includes(f.member.id));

  // Se todos foram filtrados (todos os finalistas já foram campeões neste ciclo), todos concorrem
  if (eligible.length === 0 && tally.length > 0) {
    return { eligible: tally, champions: [], allTally: tally };
  }

  return { eligible, champions, allTally: tally };
}

function renderRouletteView() {
  const { eligible, champions, allTally } = getEligibleForDraw();
  const container = document.getElementById('rouletteCardsContainer');
  const winnerContainer = document.getElementById('winnerCardContainer');
  const chancesLabel = document.getElementById('drawChancesLabel');
  const btn = document.getElementById('drawActionBtn');

  if (!container || !chancesLabel || !btn) return;

  const cardsSignature = JSON.stringify({
    eligible: eligible.map(r => ({ member: r.member.name, book: r.survivingBook ? `${r.survivingBook.title}|${r.survivingBook.cover}` : null })),
    champions: champions.map(r => r.member.name),
    cycleEnabled: window.clubState.closedCycle?.enabled
  });

  // Renderiza as cartas apenas se os finalistas/livros realmente mudaram
  if (_lastRouletteCardsSignature !== cardsSignature || container.children.length === 0) {
    _lastRouletteCardsSignature = cardsSignature;

    const cycle = window.clubState.closedCycle;
    let cycleStatusHtml = '';
    if (cycle && cycle.enabled) {
      const totalMembers = window.clubState.members.length;
      const champCount = (cycle.winners || []).length;
      const remaining = totalMembers - champCount;
      cycleStatusHtml = `
        <div class="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
          <div class="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1"><i class="ph ph-circle-notch"></i> Ciclo Fechado Ativo</div>
          <div class="text-xs text-amber-700">${champCount} de ${totalMembers} membros já venceram • ${remaining > 1 ? `${remaining} ainda disputam` : remaining === 1 ? 'Último participante!' : 'Ciclo completo!'}</div>
        </div>
      `;
    }

    const allCards = allTally.map((res, index) => {
      const book = res.survivingBook;
      if (!book) return '';
      const isChampion = champions.some(c => c.member.id === res.member.id);

      if (isChampion) {
        return `
          <div id="drawCandidate-${index}" class="roulette-card bg-stone-100 rounded-2xl p-3 border-2 border-stone-300 transition-all duration-200 flex flex-col items-center text-center relative opacity-60">
            <div class="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[8px] font-black bg-gold text-stone-900 shadow-xs">🏆 CAMPEÃO</div>
            <div id="drawOnlineDot-${index}" class="absolute top-2 right-2 w-3 h-3 rounded-full border border-white shadow-sm bg-stone-300" title="Offline"></div>
            <img src="${book.cover || DEFAULT_BOOK_COVER}" class="w-20 aspect-[2/3] object-cover rounded-lg shadow-md mb-2 grayscale opacity-70 book-cover" loading="lazy" decoding="async" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;">
            <span class="text-[10px] font-bold text-stone-400 uppercase truncate max-w-full">${escapeHtml(res.member.name)}</span>
            <h4 class="font-serif font-bold text-xs text-stone-500 line-clamp-2 mt-0.5">${escapeHtml(book.title)}</h4>
            <span class="text-[8px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded mt-1 inline-block">Fora da Roleta</span>
          </div>`;
      }

      return `
        <div id="drawCandidate-${index}" class="roulette-card bg-stone-50 rounded-2xl p-3 border-2 border-stone-200 transition-all duration-200 flex flex-col items-center text-center relative">
          <div id="drawOnlineDot-${index}" class="absolute top-2 right-2 w-3 h-3 rounded-full border border-white shadow-sm bg-stone-300" title="Offline"></div>
          <img src="${book.cover || DEFAULT_BOOK_COVER}" class="w-20 aspect-[2/3] object-cover rounded-lg shadow-md mb-2 book-cover" loading="lazy" decoding="async" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;">
          <span class="text-[10px] font-bold text-burgundy uppercase truncate max-w-full">${escapeHtml(res.member.name)}</span>
          <h4 class="font-serif font-bold text-xs text-stone-900 line-clamp-2 mt-0.5">${escapeHtml(book.title)}</h4>
        </div>`;
    }).join('');

    const totalCols = Math.min(allTally.filter(r => !!r.survivingBook).length || 5, 5);
    container.className = `grid grid-cols-2 sm:grid-cols-${totalCols} gap-4 max-w-3xl mx-auto`;

    // Insert cycle status before cards
    const parentSection = container.parentElement;
    const existingStatus = parentSection?.querySelector('.cycle-status-badge');
    if (existingStatus) existingStatus.remove();
    if (cycleStatusHtml) {
      const statusDiv = document.createElement('div');
      statusDiv.className = 'cycle-status-badge';
      statusDiv.innerHTML = cycleStatusHtml;
      container.parentElement.insertBefore(statusDiv, container);
    }

    container.innerHTML = allCards;

    // Se sobrou apenas 1 elegível, mostra mensagem especial
    if (eligible.length === 1 && cycle && cycle.enabled) {
      const lastOne = eligible[0];
      chancesLabel.innerHTML = `<span class="text-gold font-bold flex items-center justify-center gap-1">🎉 ${escapeHtml(lastOne.member.name)} é o último do ciclo! O sorteio é simbólico.</span>`;
    }
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
  const allTally = calculateFinalists();
  const chancesLabel = document.getElementById('drawChancesLabel');
  const btn = document.getElementById('drawActionBtn');
  if (!chancesLabel || !btn) return;

  const { eligible } = getEligibleForDraw();
  const survivingCount = eligible.length;
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

  allTally.forEach((res, index) => {
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
  const { eligible, allTally } = getEligibleForDraw();
  if (eligible.length === 0) return;

  const now = Date.now();
  const PRESENCE_TIMEOUT = 35000;
  const onlineMembers = window.clubState.members.filter(m => (now - (window.clubState.presence?.[m.id] || 0)) < PRESENCE_TIMEOUT);
  
  if (onlineMembers.length < window.clubState.members.length && window.clubState.members.length > 1) {
     const missingNames = window.clubState.members.filter(m => !onlineMembers.includes(m)).map(m => m.name).join(', ');
     const confirmDraw = confirm(`Atenção: ${missingNames} parece(m) ausente(s) ou offline no momento.\n\nDeseja realizar o sorteio mesmo assim?`);
     if (!confirmDraw) return;
  }

  const winnerIndex = Math.floor(Math.random() * eligible.length);
  const chosen = eligible[winnerIndex];

  // Encontra o índice no allTally para a animação
  const globalIndex = allTally.findIndex(t => t.member.id === chosen.member.id);

  const winnerData = {
    book: chosen.survivingBook,
    member: chosen.member.name,
    memberId: chosen.member.id,
    drawnAt: new Date().toLocaleTimeString('pt-BR')
  };

  const drawEvent = {
    triggerBy: window.localCurrentUser,
    winnerIndex: globalIndex >= 0 ? globalIndex : winnerIndex,
    winnerData: winnerData,
    timestamp: Date.now(),
    eligibleIndices: eligible.map(e => allTally.findIndex(t => t.member.id === e.member.id))
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

  const { allTally, eligible } = getEligibleForDraw();
  const btn = document.getElementById('drawActionBtn');
  if (btn) btn.classList.add('opacity-50', 'pointer-events-none');
  const winnerCard = document.getElementById('winnerCardContainer');
  if (winnerCard) winnerCard.classList.add('hidden');

  // Usar apenas os indices elegíveis para a animação
  const eligibleIndices = eventData.eligibleIndices || eligible.map((e, i) => {
    const idx = allTally.findIndex(t => t.member.id === e.member.id);
    return idx >= 0 ? idx : i;
  });

  let cycles = 20 + Math.floor(Math.random() * 5); 
  let currentStep = 0;
  let speed = 80;

  function step() {
    // Limpa highlights de todos
    allTally.forEach((_, idx) => {
      const card = document.getElementById(`drawCandidate-${idx}`);
      if (card) {
        card.classList.remove('border-gold', 'bg-gold/15', 'scale-105', 'shadow-lg');
        if (!card.querySelector('.text-\\[8px\\]')) { // Não é campeão
          card.classList.add('border-stone-200', 'bg-stone-50');
        }
      }
    });

    // Destaca o card elegível atual
    const activeGlobalIndex = eligibleIndices[currentStep % eligibleIndices.length];
    const activeCard = document.getElementById(`drawCandidate-${activeGlobalIndex}`);
    if (activeCard) {
      activeCard.classList.remove('border-stone-200', 'bg-stone-50');
      activeCard.classList.add('border-gold', 'bg-gold/15', 'scale-105', 'shadow-lg');
    }
    playSound('click');

    cycles--;
    if (cycles > 0) {
      currentStep++;
      if (cycles < 8) speed += 40;
      setTimeout(step, speed);
    } else {
      // Limpa todos
      allTally.forEach((_, idx) => {
        const card = document.getElementById(`drawCandidate-${idx}`);
        if (card) {
            card.classList.remove('border-gold', 'bg-gold/15', 'scale-105', 'shadow-lg');
            if (!card.querySelector('.text-\\[8px\\]')) {
              card.classList.add('border-stone-200', 'bg-stone-50');
            }
        }
      });
      // Destaca o vencedor
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

  // Ciclo Fechado status
  const cycle = window.clubState.closedCycle;
  let cycleHtml = '';
  if (cycle && cycle.enabled) {
    const totalMembers = window.clubState.members.length;
    const champCount = (cycle.winners || []).length;
    // Conta o vencedor atual se não estiver no array ainda
    const winnerMember = window.clubState.members.find(m => m.name === member);
    const effectiveCount = (winnerMember && !cycle.winners.includes(winnerMember.id)) ? champCount + 1 : champCount;
    
    cycleHtml = `
      <div class="mt-4 p-3 rounded-xl bg-amber-50/80 border border-amber-200/60 text-xs text-amber-800">
        <strong><i class="ph ph-circle-notch"></i> Ciclo Fechado:</strong> ${effectiveCount} de ${totalMembers} membros já venceram.
        ${effectiveCount >= totalMembers ? ' 🎉 Ciclo completo no próximo mês!' : ` ${member} sai da roleta no próximo mês.`}
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
        <img src="${book.cover || DEFAULT_BOOK_COVER}" alt="${escapeHtml(book.title)}" class="w-36 sm:w-44 aspect-[2/3] object-cover rounded-2xl shadow-xl border border-gold/30 shrink-0 book-cover" loading="lazy" decoding="async" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;">
        
        <div class="flex-1 text-center sm:text-left space-y-2.5 w-full">
          <span class="text-sm font-bold text-burgundy uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1.5">
            <i class="ph ph-sparkle text-gold text-base"></i> Indicado por ${escapeHtml(member)}
          </span>
          <h3 class="text-3xl sm:text-4xl font-serif font-bold text-stone-900 leading-tight">${escapeHtml(book.title)}</h3>
          <p class="text-base sm:text-lg font-medium text-stone-700">${escapeHtml(book.author)}</p>
          ${book.description ? `<p class="text-sm text-stone-600 line-clamp-3 pt-1 italic font-serif">"${escapeHtml(book.description)}"</p>` : ''}
          
          <div class="pt-4 flex flex-wrap gap-2.5 justify-center sm:justify-start">
            <button onclick="downloadCurrentMonthCard()" class="px-4.5 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-white font-bold text-sm transition flex items-center gap-2 shadow-sm">
              <i class="ph ph-download-simple text-base text-gold"></i><span>Baixar Card</span>
            </button>
            <button onclick="shareMonthCardWhatsApp()" class="px-4.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition flex items-center gap-2 shadow-sm shadow-emerald-700/20">
              <i class="ph ph-whatsapp-logo text-base"></i><span>Enviar para o WhatsApp</span>
            </button>
            <button onclick="copySummaryToClipboard()" class="px-4.5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-sm transition flex items-center gap-2">
              <i class="ph ph-copy text-base"></i><span>Copiar Texto</span>
            </button>
            <button onclick="openResetCycleModal()" class="px-4.5 py-2.5 rounded-xl bg-burgundy hover:bg-burgundyLight text-white font-bold text-sm transition flex items-center gap-1.5 shadow-sm">
              <i class="ph ph-archive-box text-base"></i><span>Arquivar & Iniciar Novo Mês</span>
            </button>
            <button onclick="initiateDraw()" class="px-4 py-2.5 rounded-xl bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 font-semibold text-sm transition">
              Sortear Novamente
            </button>
          </div>

          ${cycleHtml}
          ${logsHtml}

        </div>
      </div>
    </div>
  `;

  container.classList.remove('hidden');
  container.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
