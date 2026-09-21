// ==========================================
// MODAIS GENÉRICOS — Prompt, Confirm, Histórico, Hall da Fama, Edição
// ==========================================

var promptModalCallback = null;

function openPromptModal(title, defaultValue, callback) {
  promptModalCallback = callback;
  document.getElementById('promptModalTitle').innerText = title;
  const input = document.getElementById('promptModalInput');
  input.value = defaultValue || '';
  document.getElementById('customPromptModal').classList.remove('hidden');
  setTimeout(() => input.focus(), 50);
}

function closePromptModal(confirmed) {
  const input = document.getElementById('promptModalInput');
  const val = input.value;
  document.getElementById('customPromptModal').classList.add('hidden');
  if (confirmed && promptModalCallback) promptModalCallback(val);
  promptModalCallback = null;
}

function openEditClubNameModal() {
  openPromptModal('Editar Nome do Clube:', window.clubState.clubName, (newName) => {
    if (newName && newName.trim()) { window.clubState.clubName = newName.trim(); persistState('state.clubName'); showToast('Nome do clube atualizado!', 'success'); }
  });
}

function openEditMemberNameModal(memberId, currentName) {
  openPromptModal(`Renomear "${currentName}":`, currentName, (newName) => {
    if (newName && newName.trim()) {
      const mem = window.clubState.members.find(m => m.id === memberId);
      if (mem) { mem.name = newName.trim(); persistState('state.members'); showToast('Nome do integrante atualizado!', 'success'); }
    }
  });
}

// ==========================================
// RESET / NOVO CICLO
// ==========================================

function openResetCycleModal() { document.getElementById('confirmModal').classList.remove('hidden'); }
function closeConfirmModal() { document.getElementById('confirmModal').classList.add('hidden'); }

function handleArchiveAndStartNewMonth() {
  const winner = window.clubState.winner;
  if (winner && winner.book) {
    if (!window.clubState.history) window.clubState.history = [];
    const finalists = calculateFinalists().map(f => ({ member: f.member.name, memberId: f.member.id, title: f.survivingBook?.title || 'Sem título', author: f.survivingBook?.author || '', cover: f.survivingBook?.cover || '' }));

    // Salvar dados de veto para o Hall da Fama (Carrasco, Diferentão)
    const vetoData = {};
    window.clubState.members.forEach(voter => {
      const voterVotes = window.clubState.votes[voter.id] || {};
      vetoData[voter.id] = { name: voter.name, votes: { ...voterVotes } };
    });

    // Dados de resultado de eliminação para cada membro
    const eliminationData = calculateFinalists().map(f => ({
      memberId: f.member.id,
      memberName: f.member.name,
      eliminatedBook: f.eliminatedBook ? { title: f.eliminatedBook.title, author: f.eliminatedBook.author } : null,
      survivingBook: f.survivingBook ? { title: f.survivingBook.title, author: f.survivingBook.author } : null,
      eliminatedKey: f.eliminatedKey,
      vetoesBook1: f.vetoesBook1,
      vetoesBook2: f.vetoesBook2
    }));

    window.clubState.history.unshift({
      id: 'hist_' + Date.now(),
      monthLabel: new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date()),
      archivedAt: new Date().toLocaleDateString('pt-BR'),
      winner: { title: winner.book.title, author: winner.book.author, cover: winner.book.cover, member: winner.member },
      finalists: finalists,
      vetoData: vetoData,
      eliminationData: eliminationData
    });

    // GELADEIRA: Finalistas que sobreviveram ao veto mas perderam o sorteio
    if (!window.clubState.fridge) window.clubState.fridge = [];
    finalists.forEach(f => {
      if (f.title !== winner.book.title || f.member !== winner.member) {
        // Verificar se já não está na geladeira
        const alreadyInFridge = window.clubState.fridge.some(item => item.title === f.title && item.memberName === f.member);
        if (!alreadyInFridge) {
          window.clubState.fridge.push({
            title: f.title,
            author: f.author || '',
            cover: f.cover || '',
            memberName: f.member,
            memberId: f.memberId,
            addedAt: Date.now(),
            fromMonth: new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date())
          });
        }
      }
    });

    // CICLO FECHADO: Adicionar vencedor ao ciclo
    if (!window.clubState.closedCycle) window.clubState.closedCycle = { enabled: true, winners: [] };
    if (window.clubState.closedCycle.enabled) {
      const winnerMember = window.clubState.members.find(m => m.name === winner.member);
      if (winnerMember && !window.clubState.closedCycle.winners.includes(winnerMember.id)) {
        window.clubState.closedCycle.winners.push(winnerMember.id);
      }
      // Se todos venceram, reiniciar ciclo
      const allMemberIds = window.clubState.members.map(m => m.id);
      const allWon = allMemberIds.every(id => window.clubState.closedCycle.winners.includes(id));
      if (allWon && allMemberIds.length > 0) {
        window.clubState.closedCycle.winners = [];
        showToast('🎉 Ciclo completo! Todos venceram — novo ciclo iniciado!', 'success');
      }
    }
  }
  window.clubState.members.forEach(m => { m.book1 = null; m.book2 = null; });
  window.clubState.votes = {};
  // FIX: stage é local
  window.localStage = 'nominations';
  localStorage.setItem('clubeDoLivro_localStage', 'nominations');
  window.clubState.winner = null;
  window.clubState.drawEvent = null;
  window.clubState.drawLogs = [];
  closeConfirmModal();
  invalidateRenderCache();
  persistState();
  showToast('Leitura arquivada no histórico! Iniciando novo ciclo.', 'success');
}

function handleSoftResetOnly() {
  window.clubState.members.forEach(m => { m.book1 = null; m.book2 = null; });
  window.clubState.votes = {};
  // FIX: stage é local
  window.localStage = 'nominations';
  localStorage.setItem('clubeDoLivro_localStage', 'nominations');
  window.clubState.winner = null;
  window.clubState.drawEvent = null;
  window.clubState.drawLogs = [];
  closeConfirmModal();
  invalidateRenderCache();
  persistState();
  showToast('Indicações da rodada atual foram reiniciadas.', 'info');
}

// ==========================================
// HISTÓRICO DE LEITURAS — COM ABAS
// ==========================================

var _historyActiveTab = 'readings';

function openHistoryModal() { 
  _historyActiveTab = 'readings';
  renderHistoryModalContent();
  document.getElementById('historyModal').classList.remove('hidden'); 
}
function closeHistoryModal() { document.getElementById('historyModal').classList.add('hidden'); }

function switchHistoryTab(tab) {
  _historyActiveTab = tab;
  renderHistoryModalContent();
}

function renderHistoryModalContent() {
  const container = document.getElementById('historyListContainer');
  const countLabel = document.getElementById('historyTotalCountText');
  const tabsContainer = document.getElementById('historyTabsContainer');
  const history = window.clubState.history || [];
  
  if (!container) return;

  // Render tabs
  if (tabsContainer) {
    tabsContainer.innerHTML = `
      <div class="flex gap-1 bg-stone-100 p-1 rounded-xl">
        <button onclick="switchHistoryTab('readings')" class="flex-1 px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${_historyActiveTab === 'readings' ? 'bg-white text-burgundy shadow-sm' : 'text-stone-500 hover:text-stone-700'}">
          <i class="ph ph-books text-sm"></i> Leituras
        </button>
        <button onclick="switchHistoryTab('hallOfFame')" class="flex-1 px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${_historyActiveTab === 'hallOfFame' ? 'bg-white text-burgundy shadow-sm' : 'text-stone-500 hover:text-stone-700'}">
          <i class="ph ph-trophy text-sm"></i> Hall da Fama
        </button>
        <button onclick="switchHistoryTab('fridge')" class="flex-1 px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${_historyActiveTab === 'fridge' ? 'bg-white text-sky-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}">
          <i class="ph ph-snowflake text-sm"></i> Geladeira
        </button>
      </div>
    `;
  }

  if (_historyActiveTab === 'readings') {
    renderHistoryList();
  } else if (_historyActiveTab === 'hallOfFame') {
    renderHallOfFame();
  } else if (_historyActiveTab === 'fridge') {
    renderFridgeTab();
  }
}

function renderHistoryList() {
  const container = document.getElementById('historyListContainer');
  const countLabel = document.getElementById('historyTotalCountText');
  const history = window.clubState.history || [];
  if (!container) return;
  if (history.length === 0) {
    container.innerHTML = `<div class="text-center py-12 text-stone-400"><i class="ph ph-books text-4xl mb-2 inline-block opacity-40"></i><p class="text-xs">Nenhum ciclo concluído no histórico ainda.</p><p class="text-[11px] text-stone-400 mt-1">Ao finalizar um mês com o sorteio, clique em "Arquivar & Iniciar Novo Mês" para guardar a escolha aqui!</p></div>`;
    if (countLabel) countLabel.innerText = '0 livros arquivados';
    return;
  }
  if (countLabel) countLabel.innerText = `${history.length} livro(s) arquivado(s)`;
  container.innerHTML = history.map((item) => {
    const w = item.winner;
    return `
      <div class="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div class="flex items-center gap-3 min-w-0">
          <img src="${w.cover || DEFAULT_BOOK_COVER}" alt="${escapeHtml(w.title)}" class="w-14 aspect-[2/3] object-cover rounded-lg shadow-xs shrink-0 book-cover" loading="lazy" decoding="async" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;">
          <div class="min-w-0"><span class="text-[10px] font-extrabold uppercase text-burgundy bg-burgundy/10 px-2 py-0.5 rounded-full inline-block mb-1">${escapeHtml(item.monthLabel || item.archivedAt)}</span><h4 class="font-serif font-bold text-sm text-stone-900 truncate">${escapeHtml(w.title)}</h4><p class="text-xs text-stone-500 truncate">${escapeHtml(w.author)}</p><span class="text-[11px] text-stone-600 font-medium mt-0.5 block">Indicação vencedora de: <strong>${escapeHtml(w.member)}</strong></span></div>
        </div>
        <div class="flex flex-col items-end shrink-0 gap-2">
          <div class="text-right"><span class="text-[10px] text-stone-400 block">${item.archivedAt ? `Sorteado em: ${item.archivedAt}` : ''}</span>${item.finalists && item.finalists.length ? `<span class="text-[10px] text-stone-500 font-medium">Disputou com ${item.finalists.length - 1} finalistas</span>` : ''}</div>
          <div class="flex items-center gap-1.5">
            <button onclick="openEditHistoryModal('${item.id}')" title="Editar dados da leitura" class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 transition text-[10px] font-bold"><i class="ph ph-pencil-simple text-xs"></i><span>Editar</span></button>
            <button onclick="deleteHistoryItem('${item.id}')" title="Excluir registro" class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition text-[10px] font-bold"><i class="ph ph-trash text-xs"></i><span>Excluir</span></button>
          </div>
        </div>
      </div>`;
  }).join('');

  // Botão de gerar mosaico
  if (history.length > 0) {
    container.innerHTML += `
      <div class="mt-4 pt-4 border-t border-stone-200">
        <button onclick="generateYearMosaic()" class="w-full py-3 rounded-2xl bg-gradient-to-r from-[#2D211C] to-[#3D2F28] hover:from-[#3D2F28] hover:to-[#4a3b32] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition">
          <i class="ph ph-grid-four text-base text-gold"></i>
          <span>Gerar Mosaico Anual (Retrospectiva)</span>
        </button>
      </div>
    `;
  }
}

// ==========================================
// HALL DA FAMA — ESTATÍSTICAS DO GRUPO
// ==========================================

function renderHallOfFame() {
  const container = document.getElementById('historyListContainer');
  const countLabel = document.getElementById('historyTotalCountText');
  const history = window.clubState.history || [];
  if (!container) return;

  if (history.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 text-stone-400">
        <i class="ph ph-trophy text-4xl mb-2 inline-block opacity-40"></i>
        <p class="text-xs">Sem dados suficientes para o Hall da Fama.</p>
        <p class="text-[11px] text-stone-400 mt-1">Complete pelo menos um ciclo para ver as estatísticas!</p>
      </div>`;
    if (countLabel) countLabel.innerText = 'Estatísticas do Clube';
    return;
  }

  if (countLabel) countLabel.innerText = `Baseado em ${history.length} leitura(s)`;

  // ====== PÉ QUENTE: Mais livros sorteados ======
  const winCounts = {};
  history.forEach(h => {
    const member = h.winner?.member;
    if (member) winCounts[member] = (winCounts[member] || 0) + 1;
  });
  const peQuente = Object.entries(winCounts).sort((a, b) => b[1] - a[1])[0];

  // ====== CARRASCO: Mais vetos atendidos (seu veto coincide com o livro eliminado) ======
  const carrascoCount = {};
  history.forEach(h => {
    const vetoData = h.vetoData || {};
    const elimData = h.eliminationData || [];
    
    Object.entries(vetoData).forEach(([voterId, voterInfo]) => {
      const voterName = voterInfo.name;
      const votes = voterInfo.votes || {};
      
      Object.entries(votes).forEach(([targetId, votedBookKey]) => {
        // Verificar se o livro vetado por este voter foi realmente eliminado
        const targetElim = elimData.find(e => e.memberId === targetId);
        if (targetElim && targetElim.eliminatedKey === votedBookKey) {
          carrascoCount[voterName] = (carrascoCount[voterName] || 0) + 1;
        }
      });
    });
  });
  const carrasco = Object.entries(carrascoCount).sort((a, b) => b[1] - a[1])[0];

  // ====== DIFERENTÃO: Mais votos em livros que NÃO foram eliminados ======
  const diferentaoCount = {};
  history.forEach(h => {
    const vetoData = h.vetoData || {};
    const elimData = h.eliminationData || [];
    
    Object.entries(vetoData).forEach(([voterId, voterInfo]) => {
      const voterName = voterInfo.name;
      const votes = voterInfo.votes || {};
      
      Object.entries(votes).forEach(([targetId, votedBookKey]) => {
        const targetElim = elimData.find(e => e.memberId === targetId);
        if (targetElim && targetElim.eliminatedKey !== votedBookKey) {
          diferentaoCount[voterName] = (diferentaoCount[voterName] || 0) + 1;
        }
      });
    });
  });
  const diferentao = Object.entries(diferentaoCount).sort((a, b) => b[1] - a[1])[0];

  let html = '<div class="space-y-4">';

  // Card: Pé Quente
  html += renderHallCard(
    '🔥', 'Pé Quente', 'Teve mais livros sorteados como vencedor',
    peQuente ? peQuente[0] : null,
    peQuente ? `${peQuente[1]} vitória(s) no sorteio` : null,
    'from-amber-50 to-orange-50', 'border-amber-200', 'text-amber-800', 'bg-amber-100'
  );

  // Card: Carrasco
  html += renderHallCard(
    '⚔️', 'Carrasco', 'Teve mais vetos que realmente eliminaram livros',
    carrasco ? carrasco[0] : null,
    carrasco ? `${carrasco[1]} veto(s) certeiros` : null,
    'from-rose-50 to-red-50', 'border-rose-200', 'text-rose-800', 'bg-rose-100'
  );

  // Card: Diferentão
  html += renderHallCard(
    '🦄', 'Diferentão', 'Mais votou em livros que não foram eliminados',
    diferentao ? diferentao[0] : null,
    diferentao ? `${diferentao[1]} voto(s) contra a maioria` : null,
    'from-violet-50 to-purple-50', 'border-violet-200', 'text-violet-800', 'bg-violet-100'
  );

  html += '</div>';
  container.innerHTML = html;
}

function renderHallCard(emoji, title, description, winner, stat, gradFrom, borderColor, textColor, bgColor) {
  if (!winner) {
    return `
      <div class="p-5 rounded-2xl bg-gradient-to-br ${gradFrom} border ${borderColor} opacity-60">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl ${bgColor} flex items-center justify-center text-2xl shrink-0">${emoji}</div>
          <div>
            <h4 class="font-serif font-bold text-sm ${textColor}">${title}</h4>
            <p class="text-[11px] text-stone-500">${description}</p>
            <p class="text-xs text-stone-400 italic mt-1">Dados insuficientes</p>
          </div>
        </div>
      </div>`;
  }

  return `
    <div class="hall-card p-5 rounded-2xl bg-gradient-to-br ${gradFrom} border ${borderColor} shadow-sm">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl ${bgColor} flex items-center justify-center text-2xl shrink-0 shadow-xs">${emoji}</div>
        <div class="flex-1 min-w-0">
          <h4 class="font-serif font-bold text-sm ${textColor}">${title}</h4>
          <p class="text-[11px] text-stone-500">${description}</p>
        </div>
      </div>
      <div class="mt-3 pt-3 border-t ${borderColor.replace('border-', 'border-')}/50 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-white/80 ${textColor} font-bold text-xs flex items-center justify-center shadow-xs">${winner.substring(0, 2).toUpperCase()}</div>
          <span class="font-bold text-sm text-stone-900">${escapeHtml(winner)}</span>
        </div>
        <span class="text-[11px] font-bold ${textColor} ${bgColor} px-2.5 py-1 rounded-full">${stat}</span>
      </div>
    </div>`;
}

// ==========================================
// ABA DA GELADEIRA NO HISTÓRICO
// ==========================================
function renderFridgeTab() {
  const container = document.getElementById('historyListContainer');
  const countLabel = document.getElementById('historyTotalCountText');
  const fridge = window.clubState.fridge || [];

  if (!container) return;
  if (countLabel) countLabel.innerText = `${fridge.length} livro(s) na geladeira`;

  if (fridge.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 text-stone-400">
        <i class="ph ph-snowflake text-4xl mb-2 inline-block opacity-40"></i>
        <p class="text-xs">A geladeira está vazia!</p>
        <p class="text-[11px] text-stone-400 mt-1">Livros finalistas que perderem o sorteio aparecerão aqui automaticamente.</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="bg-sky-50 rounded-xl p-3 mb-3 border border-sky-100">
      <p class="text-xs text-sky-800"><i class="ph ph-info text-sm"></i> Estes livros quase ganharam em meses anteriores. Na fase de indicações, você pode re-indicar qualquer um com um toque!</p>
    </div>
    <div class="space-y-2">
      ${fridge.map((item, idx) => `
        <div class="p-3 rounded-2xl bg-stone-50 border border-stone-200 flex items-center gap-3 justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <img src="${item.cover || DEFAULT_BOOK_COVER}" class="w-12 aspect-[2/3] object-cover rounded-lg shadow-xs shrink-0 book-cover" loading="lazy" decoding="async" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;">
            <div class="min-w-0">
              <h5 class="font-serif font-bold text-xs text-stone-900 truncate">${escapeHtml(item.title)}</h5>
              <p class="text-[10px] text-stone-500 truncate">${escapeHtml(item.author || '')}</p>
              <span class="text-[10px] text-sky-600 font-medium">Indicação de ${escapeHtml(item.memberName || '')} • ${escapeHtml(item.fromMonth || '')}</span>
            </div>
          </div>
          <button onclick="removeFridgeItem(${idx})" title="Remover da geladeira" class="shrink-0 p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 transition">
            <i class="ph ph-trash text-sm"></i>
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

function removeFridgeItem(index) {
  if (!window.clubState.fridge) return;
  const item = window.clubState.fridge[index];
  window.clubState.fridge.splice(index, 1);
  persistState('state.fridge');
  renderHistoryModalContent();
  showToast(`"${item?.title}" removido da geladeira.`, 'info');
}

function deleteHistoryItem(id) {
  if (!confirm('Deseja excluir este registro do histórico?')) return;
  if (!window.clubState.history) return;
  window.clubState.history = window.clubState.history.filter(h => h.id !== id);
  persistState('state.history');
  renderHistoryModalContent(); 
  if (typeof window.renderUI === 'function') window.renderUI(); 
  showToast('Registro excluído do histórico!', 'info');
}

// ==========================================
// EDIÇÃO DE LIVRO DO HISTÓRICO (ADMIN)
// ==========================================
function openEditHistoryModal(id) {
  if (!window.clubState.history) return;
  const item = window.clubState.history.find(h => h.id === id);
  if (!item || !item.winner) return showToast('Registro não encontrado.', 'warning');

  const modal = document.getElementById('editHistoryModal');
  if (!modal) return;

  document.getElementById('editHistoryId').value = item.id;
  document.getElementById('editHistoryTitle').value = item.winner.title || '';
  document.getElementById('editHistoryAuthor').value = item.winner.author || '';
  document.getElementById('editHistoryCoverUrl').value = item.winner.cover || '';
  document.getElementById('editHistoryMonthLabel').value = item.monthLabel || item.archivedAt || '';

  const preview = document.getElementById('editHistoryCoverPreview');
  if (preview) {
    preview.src = item.winner.cover || DEFAULT_BOOK_COVER;
    preview.onerror = function() { this.onerror = null; this.src = DEFAULT_BOOK_COVER; };
  }

  modal.classList.remove('hidden');
  setupHistoryCoverDropZone();
}

function closeEditHistoryModal() {
  const modal = document.getElementById('editHistoryModal');
  if (modal) modal.classList.add('hidden');
}

function updateHistoryCoverPreview() {
  const url = (document.getElementById('editHistoryCoverUrl')?.value || '').trim();
  const preview = document.getElementById('editHistoryCoverPreview');
  if (preview && url) {
    preview.src = url;
    preview.onerror = function() { this.onerror = null; this.src = DEFAULT_BOOK_COVER; };
  }
}

function searchGoogleForHistoryCover() {
  const title = (document.getElementById('editHistoryTitle')?.value || '').trim();
  const author = (document.getElementById('editHistoryAuthor')?.value || '').trim();
  if (!title && !author) return showToast('Preencha o título ou autor antes de buscar.', 'warning');

  const query = `${title} ${author} capa livro`.trim();
  window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`, '_blank');
}

async function saveHistoryItemEdit() {
  const id = document.getElementById('editHistoryId')?.value;
  if (!id || !window.clubState.history) return;

  const item = window.clubState.history.find(h => h.id === id);
  if (!item || !item.winner) return showToast('Registro não encontrado.', 'danger');

  const title = (document.getElementById('editHistoryTitle')?.value || '').trim();
  const author = (document.getElementById('editHistoryAuthor')?.value || '').trim();
  const coverUrl = (document.getElementById('editHistoryCoverUrl')?.value || '').trim();
  const monthLabel = (document.getElementById('editHistoryMonthLabel')?.value || '').trim();

  if (!title) return showToast('Informe ao menos o título do livro.', 'warning');

  item.winner.title = title;
  item.winner.author = author || 'Autor não informado';
  item.winner.cover = coverUrl || item.winner.cover || DEFAULT_BOOK_COVER;
  if (monthLabel) item.monthLabel = monthLabel;

  invalidateRenderCache();
  await persistState('state.history');
  renderHistoryModalContent();
  if (typeof window.renderUI === 'function') window.renderUI();
  closeEditHistoryModal();
  showToast('Leitura atualizada com sucesso!', 'success');
}

function setupHistoryCoverDropZone() {
  const dropZone = document.getElementById('historyCoverDropZone');
  if (!dropZone || dropZone._dropInitialized) return;
  dropZone._dropInitialized = true;

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-burgundy', 'bg-burgundy/5');
    dropZone.classList.remove('border-stone-300');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-burgundy', 'bg-burgundy/5');
    dropZone.classList.add('border-stone-300');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-burgundy', 'bg-burgundy/5');
    dropZone.classList.add('border-stone-300');

    const htmlData = e.dataTransfer.getData('text/html');
    const textData = e.dataTransfer.getData('text/plain');
    let imageUrl = '';

    if (htmlData) {
      const match = htmlData.match(/src=["']([^"']+)["']/i);
      if (match && match[1]) imageUrl = match[1];
    }

    if (!imageUrl && textData && (textData.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)/i) || textData.match(/^https?:\/\//))) {
      imageUrl = textData;
    }

    if (imageUrl) {
      const coverInput = document.getElementById('editHistoryCoverUrl');
      if (coverInput) {
        coverInput.value = imageUrl;
        updateHistoryCoverPreview();
      }
      showToast('Imagem capturada! Verifique o preview.', 'success');
    } else {
      showToast('Não foi possível extrair a URL da imagem arrastada.', 'warning');
    }
  });
}
