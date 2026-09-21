// ==========================================
// RESULTADOS — Apuração e Grid de Finalistas
// ==========================================

function calculateFinalists() {
  const state = window.clubState;
  const results = [];
  state.members.forEach(member => {
    let vetoesBook1 = 0; let vetoesBook2 = 0;
    state.members.forEach(voter => {
      if (voter.id !== member.id) {
        const voterChoice = state.votes[voter.id]?.[member.id];
        if (voterChoice === 'book1') vetoesBook1++;
        if (voterChoice === 'book2') vetoesBook2++;
      }
    });
    let eliminatedKey = 'book2'; let survivingKey = 'book1'; let isTie = false;
    if (vetoesBook1 > vetoesBook2) { eliminatedKey = 'book1'; survivingKey = 'book2'; } 
    else if (vetoesBook2 > vetoesBook1) { eliminatedKey = 'book2'; survivingKey = 'book1'; } 
    else { isTie = true; eliminatedKey = 'book2'; survivingKey = 'book1'; }
    results.push({ member, vetoesBook1, vetoesBook2, isTie, eliminatedKey, survivingKey, survivingBook: member[survivingKey], eliminatedBook: member[eliminatedKey] });
  });
  return results;
}

function calculateAndAdvanceToResults() {
  const missingVoters = [];
  window.clubState.members.forEach(m => {
    if (Object.keys(window.clubState.votes[m.id] || {}).length < window.clubState.members.length - 1) missingVoters.push(m.name);
  });
  if (missingVoters.length > 0) showToast(`Votos pendentes de: ${missingVoters.join(', ')}. Mas você pode apurar se todos concordarem.`, 'warning');
  playSound('advance');
  changeStage('results');
}

function renderResultsGrid() {
  const tally = calculateFinalists();
  const grid = document.getElementById('resultsGrid');
  const bannerList = document.getElementById('finalistsBannerList');
  if (!grid || !bannerList) return;

  const resultsSignature = JSON.stringify(tally.map(res => ({
    id: res.member.id,
    name: res.member.name,
    survivingKey: res.survivingKey,
    isTie: res.isTie,
    vetoes1: res.vetoesBook1,
    vetoes2: res.vetoesBook2,
    b1: res.member.book1 ? `${res.member.book1.title}|${res.member.book1.cover}` : null,
    b2: res.member.book2 ? `${res.member.book2.title}|${res.member.book2.cover}` : null
  })));

  if (_lastResultsSignature === resultsSignature && grid.children.length > 0) {
    return; // Resultados idênticos: mantém imagens sem recriar
  }
  _lastResultsSignature = resultsSignature;

  grid.innerHTML = tally.map(res => {
    const mem = res.member;
    const b1 = mem.book1;
    const b2 = mem.book2;
    const isB1Surviving = res.survivingKey === 'book1';

    return `
      <div class="bg-white rounded-3xl p-6 border border-[#EBE4D8] shadow-xs flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-stone-100">
            <div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-xl bg-burgundy/10 text-burgundy font-bold text-xs flex items-center justify-center">${escapeHtml(mem.name.substring(0, 2).toUpperCase())}</div><h3 class="font-serif font-bold text-stone-900 text-sm">${escapeHtml(mem.name)}</h3></div>
            ${res.isTie ? '<span class="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⚖️ Desempate: 1ª Opção Vence</span>' : '<span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">✓ Votação Concluída</span>'}
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="p-3 rounded-2xl border ${isB1Surviving ? 'border-emerald-400 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/30 opacity-70'} flex gap-3 relative">
              <img src="${b1?.cover || DEFAULT_BOOK_COVER}" class="w-14 aspect-[2/3] object-cover rounded-lg shrink-0 shadow-xs book-cover" loading="lazy" decoding="async" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;">
              <div class="min-w-0 flex-1 flex flex-col justify-between">
                <div><span class="text-[9px] font-black uppercase tracking-wider text-stone-400">1ª Opção</span><h4 class="font-serif font-bold text-xs text-stone-900 line-clamp-2 leading-tight">${escapeHtml(b1?.title || 'Sem título')}</h4></div>
                <div class="mt-1 flex items-center justify-between"><span class="text-[10px] font-bold ${isB1Surviving ? 'text-emerald-700' : 'text-rose-600'}">${isB1Surviving ? '★ SOBREVIVEU' : '✕ ELIMINADO'}</span><span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-stone-600 border">${res.vetoesBook1} veto(s)</span></div>
              </div>
            </div>
            <div class="p-3 rounded-2xl border ${!isB1Surviving ? 'border-emerald-400 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/30 opacity-70'} flex gap-3 relative">
              <img src="${b2?.cover || DEFAULT_BOOK_COVER}" class="w-14 aspect-[2/3] object-cover rounded-lg shrink-0 shadow-xs book-cover" loading="lazy" decoding="async" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;">
              <div class="min-w-0 flex-1 flex flex-col justify-between">
                <div><span class="text-[9px] font-black uppercase tracking-wider text-stone-400">2ª Opção</span><h4 class="font-serif font-bold text-xs text-stone-900 line-clamp-2 leading-tight">${escapeHtml(b2?.title || 'Sem título')}</h4></div>
                <div class="mt-1 flex items-center justify-between"><span class="text-[10px] font-bold ${!isB1Surviving ? 'text-emerald-700' : 'text-rose-600'}">${!isB1Surviving ? '★ SOBREVIVEU' : '✕ ELIMINADO'}</span><span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-stone-600 border">${res.vetoesBook2} veto(s)</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');

  bannerList.innerHTML = tally.map(res => {
    const book = res.survivingBook;
    if (!book) return '';
    return `
      <div class="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center gap-3">
        <img src="${book.cover || DEFAULT_BOOK_COVER}" class="w-12 aspect-[2/3] object-cover rounded-lg shadow-sm shrink-0 book-cover" loading="lazy" decoding="async" onerror="this.onerror=null; this.src=DEFAULT_BOOK_COVER;">
        <div class="min-w-0"><span class="text-[10px] font-bold text-gold uppercase tracking-wider block truncate">${escapeHtml(res.member.name)}</span><h5 class="font-serif font-bold text-xs text-white truncate">${escapeHtml(book.title)}</h5><p class="text-[10px] text-stone-300 truncate">${escapeHtml(book.author || '')}</p></div>
      </div>`;
  }).join('');
}
