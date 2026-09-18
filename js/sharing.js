// ==========================================
// COMPARTILHAMENTO — WhatsApp, Link, Resumo
// ==========================================

function getShareableURL() {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('sala', window.currentRoomId);
  return url.toString();
}

function openShareModal() {
  const input = document.getElementById('shareLinkInput');
  if (input) input.value = getShareableURL();
  document.getElementById('shareRoomCodeDisplay').innerText = window.currentRoomId;
  document.getElementById('shareModal').classList.remove('hidden');
}
function closeShareModal() { document.getElementById('shareModal').classList.add('hidden'); }

function copyShareLink() {
  const shareUrl = getShareableURL();
  const tempInput = document.createElement('input');
  tempInput.value = shareUrl;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand('copy');
  document.body.removeChild(tempInput);
  playSound('advance');
  showToast('Link da sala copiado!', 'success');
}

function shareDirectToWhatsApp() {
  const shareUrl = getShareableURL();
  const clubName = window.clubState.clubName || 'Clube do Livro';
  const text = `📖 *${clubName.toUpperCase()}*\n\nOlá pessoal! Aqui está o link para cadastrarmos nossos livros e realizarmos a votação e o sorteio da nossa próxima leitura:\n\n👉 ${shareUrl}\n\nSe pedir o código, a sala é: *${window.currentRoomId}* 📚☕`;
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  closeShareModal();
}

function copySummaryToClipboard() {
  const winner = window.clubState.winner;
  if (!winner) return;
  const clubName = window.clubState.clubName || 'Clube do Livro';
  const text = `🏆 *${clubName.toUpperCase()} - LIVRO ESCOLHIDO!* 🏆\n\n📖 *${winner.book.title}*\n✍️ Autor: ${winner.book.author || 'Não informado'}\n🙋 Indicado por: *${winner.member}*\n\nParabéns ao vencedor e boa leitura a todos! 📚✨`;
  const tempInput = document.createElement('textarea');
  tempInput.value = text;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand('copy');
  document.body.removeChild(tempInput);
  playSound('advance');
  showToast('Resumo formatado copiado para o WhatsApp!', 'success');
}
