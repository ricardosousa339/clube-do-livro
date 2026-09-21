// ==========================================
// VOTAÇÃO — Veto de exclusão
// ==========================================

function renderVotingSection() {
  const state = window.clubState;
  const voterId = window.localCurrentUser;
  const totalMembers = state.members.length;
  let totalVotersComplete = 0;

  document.getElementById('votingSelectorTabs').innerHTML = state.members.map(m => {
    const votedCount = Object.keys(state.votes[m.id] || {}).length;
    const isComplete = votedCount >= (totalMembers - 1) && totalMembers > 1;
    if (isComplete) totalVotersComplete++;
    const isCurrent = m.id === voterId;
    return `
      <div class="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 select-none transition ${isCurrent ? 'bg-burgundy text-white shadow-sm ring-2 ring-burgundy/25' : 'bg-white text-stone-700 border border-stone-200'}">
        <i class="ph ${isCurrent ? 'ph-user-check' : 'ph-user'} text-xs"></i>
        <span>${escapeHtml(m.name)}${isCurrent ? ' (Você)' : ''}</span>
        <span class="w-2 h-2 rounded-full shrink-0 ${isComplete ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-amber-400'}" title="${isComplete ? 'Votação finalizada' : 'Aguardando votos...'}"></span>
      </div>`;
  }).join('');

  document.getElementById('votingProgressBadge').innerText = `${totalVotersComplete} de ${totalMembers} votaram`;

  const canvas = document.getElementById('votingCanvas');
  if (!canvas) return;
  const otherMembers = state.members.filter(m => m.id !== voterId);
  const currentVoterVotes = state.votes[voterId] || {};
  const hasFinishedVoting = Object.keys(currentVoterVotes).length >= otherMembers.length && otherMembers.length > 0;

  const canvasSignature = JSON.stringify({
    voterId,
    hasFinishedVoting,
    isEditingVotes: window.isEditingVotes,
    votes: currentVoterVotes,
    totalVotersComplete,
    totalMembers,
    targets: otherMembers.map(t => `${t.id}:${t.name}:${t.book1?.title}|${t.book1?.cover}:${t.book2?.title}|${t.book2?.cover}`)
  });

  if (_lastVotingCanvasSignature === canvasSignature && canvas.children.length > 0) {
    return; // Canvas idêntico: não destrói os cards nem as capas
  }
  _lastVotingCanvasSignature = canvasSignature;

  if (hasFinishedVoting && !window.isEditingVotes) {
     canvas.innerHTML = `
        <div class="bg-gradient-to-br from-emerald-50 to-[#F2F9F5] rounded-[2rem] p-6 sm:p-8 border border-emerald-200 shadow-lg text-center relative overflow-hidden mt-6">
          <div class="absolute -left-10 -bottom-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div class="w-16 h-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto mb-4 shadow-md shadow-emerald-500/30"><i class="ph ph-check-square-offset text-3xl"></i></div>
          <h3 class="font-serif font-bold text-emerald-900 text-2xl mb-1">Votos Registrados!</h3>
          <p class="text-sm text-emerald-700 mb-8 max-w-md mx-auto">Suas exclusões foram computadas com sucesso. Aguarde os colegas terminarem.</p>
          <div class="bg-white/70 rounded-xl p-4 inline-block backdrop-blur-sm border border-emerald-100/50">
            <p class="text-xs font-bold text-stone-500 mb-3 uppercase tracking-wider">Status da Votação</p>
            <div class="flex items-center gap-3 text-sm">
              <div class="w-48 bg-stone-200 rounded-full h-2.5 overflow-hidden"><div class="bg-emerald-500 h-2.5 rounded-full transition-all duration-500" style="width: ${(totalVotersComplete / Math.max(1, totalMembers)) * 100}%"></div></div>
              <span class="font-bold text-stone-800">${totalVotersComplete}/${totalMembers} votaram</span>
            </div>
            ${(totalVotersComplete === totalMembers && totalMembers > 1) ? `<button onclick="calculateAndAdvanceToResults()" class="mt-5 px-6 py-2.5 rounded-xl bg-forest hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition w-full flex items-center justify-center gap-2"><i class="ph ph-chart-bar-horizontal text-base"></i> Apurar Resultado Final</button>` : `<p class="text-[11px] text-stone-500 mt-4 flex items-center justify-center gap-1.5"><i class="ph ph-spinner animate-spin text-emerald-600 text-sm"></i> Monitorando os outros votos...</p>`}
          </div>
          <div class="mt-8"><button onclick="window.isEditingVotes = true; window.renderUI();" class="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline decoration-emerald-300 underline-offset-4 transition">Revisar meus votos</button></div>
        </div>`;
  } else {
    canvas.innerHTML = `
      ${hasFinishedVoting ? `<div class="flex justify-end mb-2"><button onclick="window.isEditingVotes = false; window.renderUI();" class="text-xs font-bold px-4 py-2.5 rounded-xl bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition shadow-sm border border-emerald-200">Concluir Revisão de Votos</button></div>` : ''}
      <div class="space-y-6">
        ${otherMembers.map(targetMember => {
          const selectedVeto = currentVoterVotes[targetMember.id];
          return `
            <div class="bg-white rounded-3xl p-6 border border-[#EBE4D8] shadow-xs">
              <div class="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-stone-100">
                <div><span class="text-xs font-bold text-stone-400 uppercase tracking-wider">Indicações de</span><h3 class="text-lg font-serif font-bold text-stone-900">${escapeHtml(targetMember.name)}</h3></div>
                <div class="text-xs">${selectedVeto ? '<span class="text-rose-600 font-bold flex items-center gap-1.5 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100"><i class="ph ph-check-circle"></i> Veto registrado</span>' : '<span class="text-amber-600 font-medium flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100"><i class="ph ph-warning-circle"></i> Selecione 1 obra para excluir</span>'}</div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                ${renderVetoChoiceCard(voterId, targetMember, 'book1', selectedVeto === 'book1')}
                ${renderVetoChoiceCard(voterId, targetMember, 'book2', selectedVeto === 'book2')}
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }
}

function renderVetoChoiceCard(voterId, targetMember, bookKey, isSelected) {
  const book = targetMember[bookKey];
  const isBook1 = bookKey === 'book1';
  if (!book) return `<div class="p-4 rounded-2xl border border-stone-200 bg-stone-50 text-center text-xs text-stone-400">Nenhuma obra indicada ainda</div>`;
  return `
    <div onclick="castVeto('${targetMember.id}', '${bookKey}')" class="cursor-pointer p-4 rounded-2xl border-2 transition-all relative flex gap-3 ${isSelected ? 'border-rose-500 bg-rose-50/70 shadow-md ring-2 ring-rose-200' : 'border-stone-200 hover:border-stone-300 bg-white hover:bg-stone-50'}">
      <div class="w-16 aspect-[2/3] rounded-lg overflow-hidden bg-stone-200 shrink-0 shadow-sm relative book-cover-container"><img src="${book.cover || DEFAULT_BOOK_COVER}" class="w-full h-full object-cover book-cover" loading="lazy" decoding="async" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;"><div class="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-bold ${isBook1 ? 'bg-gold text-stone-900' : 'bg-stone-800 text-white'}">${isBook1 ? 'OPÇÃO 1' : 'OPÇÃO 2'}</div></div>
      <div class="flex-1 min-w-0 flex flex-col justify-between">
        <div><span class="text-[10px] font-bold uppercase tracking-wider text-stone-400">${isBook1 ? '1ª Opção' : '2ª Opção'}</span><h4 class="font-serif font-bold text-xs text-stone-900 line-clamp-2 mt-0.5">${escapeHtml(book.title)}</h4><p class="text-[11px] text-stone-500 truncate mt-0.5">${escapeHtml(book.author || 'Autor não informado')}</p></div>
        <div class="mt-2">${isSelected ? '<span class="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-100 px-2.5 py-0.5 rounded-md"><i class="ph ph-prohibit"></i> Voto para Excluir</span>' : '<span class="inline-flex items-center gap-1 text-[11px] font-medium text-stone-400 hover:text-stone-700"><i class="ph ph-hand-pointing"></i> Clique para excluir</span>'}</div>
      </div>
    </div>`;
}

function castVeto(targetMemberId, bookKey) {
  const voterId = window.localCurrentUser;
  if (!window.clubState.votes[voterId]) window.clubState.votes[voterId] = {};
  window.clubState.votes[voterId][targetMemberId] = bookKey;
  if (Object.keys(window.clubState.votes[voterId]).length >= window.clubState.members.length - 1) window.isEditingVotes = false;
  invalidateRenderCache();
  playSound('veto');
  // FIX: Update granular — só salva os votos deste usuário, não sobrescreve os dos outros
  persistState(`state.votes.${voterId}`);
}
