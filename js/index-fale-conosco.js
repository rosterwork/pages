/* ============================================================
   FALE CONOSCO — envio de recado (qualquer usuário logado)
   Item no menu do usuário (abaixo de "Meu perfil") que abre um
   MODAL com formulário (assunto + tipo + mensagem). Exceção à
   regra "criação vai no painel": aqui o modal bloqueia a tela ao
   fundo de propósito (o recado não lida com a página; ver
   REGRAS §4). Anexa o contexto (a "tela onde o usuário está") e
   grava por recado_enviar.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  document.addEventListener('DOMContentLoaded', function () {
    var M = (RosterWork.mensagens && RosterWork.mensagens.faleConosco) || {};
    var btnAbrir = document.getElementById('btn-fale-conosco');
    var veu = document.getElementById('veu-fale-conosco');
    if (!btnAbrir || !veu) return;

    var assunto = document.getElementById('fc-assunto');
    var mensagem = document.getElementById('fc-mensagem');
    var tipoTrilho = document.getElementById('fc-tipo');
    var btnEnviar = document.getElementById('fc-enviar');
    var btnCancelar = document.getElementById('fc-cancelar');
    var tipoEscolhido = '';
    var enviando = false;

    function campoDe(el) { return el ? el.closest('.campo') : null; }
    function erro(el, msg) {
      var c = campoDe(el); if (!c) return;
      c.classList.add('campo--erro');
      var e = c.querySelector('.campo-erro-texto'); if (e) e.textContent = msg;
    }
    function limparErro(el) {
      var c = campoDe(el); if (!c) return;
      c.classList.remove('campo--erro');
      var e = c.querySelector('.campo-erro-texto'); if (e) e.textContent = '';
    }
    function limparTipo() {
      if (!tipoTrilho) return;
      var abas = tipoTrilho.querySelectorAll('.aba');
      for (var i = 0; i < abas.length; i++) abas[i].classList.remove('aba--ativa');
    }

    if (tipoTrilho) {
      var abas = tipoTrilho.querySelectorAll('.aba');
      for (var i = 0; i < abas.length; i++) {
        (function (b) {
          b.addEventListener('click', function () {
            tipoEscolhido = b.getAttribute('data-valor') || '';
            limparTipo();
            b.classList.add('aba--ativa');
            limparErro(tipoTrilho);
          });
        })(abas[i]);
      }
    }

    function temTexto() {
      return !!((assunto && assunto.value.trim()) || (mensagem && mensagem.value.trim()));
    }
    function estaAberto() { return veu.classList.contains('modal-veu--aberto'); }

    function abrir() {
      if (assunto) assunto.value = '';
      if (mensagem) mensagem.value = '';
      tipoEscolhido = '';
      limparTipo();
      limparErro(assunto); limparErro(mensagem); limparErro(tipoTrilho);
      if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
      if (RosterWork.abrirModal) RosterWork.abrirModal('veu-fale-conosco');
    }
    function fechar() { if (RosterWork.fecharModais) RosterWork.fecharModais(); }

    /* a "tela onde o usuário está" — vai junto do recado, como um print em texto */
    function contexto() {
      var pagina = '';
      var sel = document.querySelector('.menu-item--selecionado');
      if (sel) pagina = sel.getAttribute('data-pagina') || '';
      var abaAtiva = document.querySelector('.pagina-subcabecalho .aba--ativa');
      var prefs = null;
      try { prefs = JSON.parse(sessionStorage.getItem('rosterwork_preferencias')); } catch (e) {}
      return {
        pagina: pagina,
        aba: abaAtiva ? abaAtiva.textContent.trim() : '',
        unidades: (prefs && prefs.unidades_selecionadas) || [],
        navegador: navigator.userAgent,
        tela: window.innerWidth + 'x' + window.innerHeight,
        tema: document.documentElement.getAttribute('data-tema') || 'sistema',
        url: location.href
      };
    }

    function enviar() {
      if (enviando) return;
      limparErro(assunto); limparErro(mensagem); limparErro(tipoTrilho);
      var a = assunto ? assunto.value.trim() : '';
      var m = mensagem ? mensagem.value.trim() : '';
      if (!a) { erro(assunto, M.assuntoVazio); return; }
      if (!tipoEscolhido) { erro(tipoTrilho, M.selecioneTipo); return; }
      if (!m) { erro(mensagem, M.mensagemVazia); return; }

      enviando = true;
      if (RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(btnEnviar);
      RosterWork.rpc('recado_enviar', { p_tipo: tipoEscolhido, p_assunto: a, p_mensagem: m, p_contexto: contexto() })
        .then(function (r) {
          enviando = false;
          if (RosterWork.pararCarregando) RosterWork.pararCarregando(btnEnviar);
          if (r && r.success) {
            fechar();
            if (RosterWork.avisar) RosterWork.avisar({ tipo: 'sucesso', mensagem: M.enviado });
          } else if (RosterWork.avisar) {
            RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || M.falha });
          }
        })
        .catch(function () {
          enviando = false;
          if (RosterWork.pararCarregando) RosterWork.pararCarregando(btnEnviar);
          if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
        });
    }

    btnAbrir.addEventListener('click', abrir);
    if (btnCancelar) btnCancelar.addEventListener('click', fechar);
    if (btnEnviar) btnEnviar.addEventListener('click', enviar);

    /* avisa se recarregar/fechar a aba com o modal aberto e texto digitado */
    if (RosterWork.guardaSaida && RosterWork.guardaSaida.registrar) {
      RosterWork.guardaSaida.registrar(function () { return estaAberto() && temTexto(); });
    }

    /* selo numérico do menu Programador (só programador): recados não resolvidos */
    function acharSelo() {
      var item = document.querySelector('.menu-item[data-pagina="programador"]');
      return item ? item.querySelector('.menu-item-selo') : null;
    }
    function atualizarSelo() {
      if (!(RosterWork.sessao && RosterWork.sessao.ehProgramador && RosterWork.sessao.ehProgramador())) return;
      RosterWork.rpc('recados_contar_pendentes').then(function (r) {
        var s = acharSelo();
        if (!s) return;
        var n = (r && typeof r.pendentes === 'number') ? r.pendentes : 0;
        s.textContent = n > 0 ? String(n) : '';
        s.classList.toggle('oculto', n <= 0);
      }).catch(function () {});
    }
    RosterWork.recadosSelo = { atualizar: atualizarSelo };
    atualizarSelo();
  });
})();
