// ==========================================
// MODAIS GENÉRICOS — Prompt, Confirm, Histórico, Edição
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
    const finalists = calculateFinalists().map(f => ({ member: f.member.name, title: f.survivingBook?.title || 'Sem título' }));
    window.clubState.history.unshift({
      id: 'hist_' + Date.now(),
      monthLabel: new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date()),
      archivedAt: new Date().toLocaleDateString('pt-BR'),
      winner: { title: winner.book.title, author: winner.book.author, cover: winner.book.cover, member: winner.member },
      finalists: finalists
    });
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
// HISTÓRICO DE LEITURAS
// ==========================================

function openHistoryModal() { renderHistoryList(); document.getElementById('historyModal').classList.remove('hidden'); }
function closeHistoryModal() { document.getElementById('historyModal').classList.add('hidden'); }

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
          <img src="${w.cover || DEFAULT_BOOK_COVER}" alt="${escapeHtml(w.title)}" class="w-14 h-20 object-cover rounded-xl shadow-xs shrink-0" loading="lazy" decoding="async" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;">
          <div class="min-w-0"><span class="text-[10px] font-extrabold uppercase text-burgundy bg-burgundy/10 px-2 py-0.5 rounded-full inline-block mb-1">${escapeHtml(item.monthLabel || item.archivedAt)}</span><h4 class="font-serif font-bold text-sm text-stone-900 truncate">${escapeHtml(w.title)}</h4><p class="text-xs text-stone-500 truncate">${escapeHtml(w.author)}</p><span class="text-[11px] text-stone-600 font-medium mt-0.5 block">Indicação vencedora de: <strong>${escapeHtml(w.member)}</strong></span></div>
        </div>
        <div class="flex flex-col items-end shrink-0 gap-2">
          <div class="text-right"><span class="text-[10px] text-stone-400 block">${item.archivedAt ? `Sorteado em: ${item.archivedAt}` : ''}</span>${item.finalists && item.finalists.length ? `<span class="text-[10px] text-stone-500 font-medium">Disputou com ${item.finalists.length - 1} finalistas</span>` : ''}</div>
          <button onclick="deleteHistoryItem('${item.id}')" title="Excluir registro de teste" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition text-[10px] font-bold"><i class="ph ph-trash text-sm"></i><span>Excluir</span></button>
        </div>
      </div>`;
  }).join('');
}

function deleteHistoryItem(id) {
  if (!window.clubState.history) return;
  window.clubState.history = window.clubState.history.filter(h => h.id !== id);
  persistState('state.history');
  renderHistoryList(); 
  if (typeof window.renderUI === 'function') window.renderUI(); 
  showToast('Registro excluído do histórico!', 'info');
}
