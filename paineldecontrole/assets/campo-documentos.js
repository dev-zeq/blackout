/* Máscaras de documentos para formulários novos: CPF (000.000.000-00), CNPJ
 * (00.000.000/0000-00) e CEP (00000-000), aplicadas por id do campo (terminado
 * em "cpf", "cnpj" ou "cep"). Mesma lógica das máscaras de CPF/CNPJ já usadas
 * nos formulários de Declaração/Procuração (sem cortar nem inventar dígitos),
 * mais o CEP. Também expõe Documentos.cpfValido(valor) (dígitos verificadores).
 * Basta incluir <script src="assets/campo-documentos.js"></script>.
 */
(function () {
  var TAM = { cpf: 11, cnpj: 14, cep: 8 };
  function tipo(el) { var m = /(cpf|cnpj|cep)$/i.exec(el.id || ''); return m ? m[1].toLowerCase() : null; }
  function ehCampo(el) { return el && el.tagName === 'INPUT' && !!tipo(el); }
  function mascarar(d, t) {
    if (t === 'cpf') return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
    if (t === 'cep') return d.replace(/^(\d{5})(\d)/, '$1-$2');
    return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4').replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
  }
  function aplicar(el) {
    var t = tipo(el), d = (el.value || '').replace(/\D/g, '');
    if (!d || d.length > TAM[t]) return;
    var novo = mascarar(d, t);
    if (novo === el.value) return;
    var foco = document.activeElement === el;
    var antes = foco ? el.value.slice(0, el.selectionStart || 0).replace(/\D/g, '').length : 0;
    el.value = novo;
    if (foco) { var pos = 0, c = 0; while (pos < novo.length && c < antes) { if (/\d/.test(novo[pos])) c++; pos++; } try { el.setSelectionRange(pos, pos); } catch (e) {} }
  }
  document.addEventListener('input', function (ev) { if (ehCampo(ev.target)) aplicar(ev.target); });
  new MutationObserver(function () {
    document.querySelectorAll('input').forEach(function (el) { if (ehCampo(el) && (el.value || '').replace(/\D/g, '').length === TAM[tipo(el)]) aplicar(el); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  function cpfValido(v) {
    var d = String(v || '').replace(/\D/g, '');
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    for (var t = 9; t < 11; t++) {
      var s = 0; for (var i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i);
      var dv = ((s * 10) % 11) % 10; if (dv !== Number(d[t])) return false;
    }
    return true;
  }
  window.Documentos = { cpfValido: cpfValido, mascarar: function (v, t) { var d = String(v || '').replace(/\D/g, ''); return d.length === TAM[t] ? mascarar(d, t) : v; } };
})();
