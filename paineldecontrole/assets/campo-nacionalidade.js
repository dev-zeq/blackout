/* Campo de Nacionalidade padrão dos formulários públicos (botões).
 *
 * Opções fixas + "Outra nacionalidade", que abre um campo de texto obrigatório
 * ("Informe a nacionalidade"). Mesmo visual do contrato-form.html
 * (.radio-group / .radio-pill / .pill-label, já definidos no CSS de cada form).
 *
 * COMO USAR EM UM FORMULÁRIO NOVO
 *   1. <script src="assets/campo-nacionalidade.js"></script> antes do script do form.
 *   2. No estado inicial: <chave>: 'Brasileiro(a)', <chave>_outro: ''
 *      (ex.: nacionalidade / a_nacionalidade / pd_nacionalidade).
 *   3. Na etapa:      ${Nacionalidade.campoHtml(s, 'a_nacionalidade')}
 *   4. Ao salvar:     Nacionalidade.ler(s, 'a_nacionalidade');
 *   5. Ao validar:    const e = Nacionalidade.validar(s, 'a_nacionalidade'); if (e) return e;
 *   6. Ao enviar:     nacionalidade: Nacionalidade.final(s, 'a_nacionalidade')
 *   7. Ao editar:     Nacionalidade.carregar(s, 'a_nacionalidade', pessoa.nacionalidade);
 * O que vai pro banco é sempre uma string simples (ex. "Haitiano(a)" ou o texto
 * digitado em "Outra"), a mesma que o painel (index.html) já formata.
 * Não precisa de bind: a troca de botão é tratada por delegação de eventos.
 */
(function () {
  var PADRAO = ['Brasileiro(a)', 'Venezuelano(a)', 'Haitiano(a)'];
  var OUTRA = 'Outra';
  var estado = null; // último `s` visto por campoHtml (os forms têm um só)

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function pill(name, value, checked, label) {
    var id = name + '_' + value.replace(/\W/g, '');
    return '<label class="radio-pill"><input type="radio" name="' + name + '" id="' + id + '" value="' + esc(value) + '"' + (checked ? ' checked' : '') + '><span class="pill-label" for="' + id + '">' + esc(label || value) + '</span></label>';
  }
  function outroHtml(s, key) {
    if (s[key] !== OUTRA) return '';
    return '<div class="field"><label>Informe a nacionalidade *</label><input type="text" id="f_' + key + '_outro" value="' + esc(s[key + '_outro']) + '"></div>';
  }

  var N = {
    PADRAO: PADRAO,
    campoHtml: function (s, key) {
      estado = s;
      var nome = 'f_' + key;
      return '<div class="field"><label>Nacionalidade *</label><div class="radio-group">'
        + PADRAO.map(function (n) { return pill(nome, n, s[key] === n); }).join('')
        + pill(nome, OUTRA, s[key] === OUTRA, 'Outra nacionalidade')
        + '</div></div><div id="cond_' + key + '" data-nac-cond="' + key + '">' + outroHtml(s, key) + '</div>';
    },
    ler: function (s, key) {
      var r = document.querySelector('input[name="f_' + key + '"]:checked');
      if (r) s[key] = r.value;
      var inp = document.getElementById('f_' + key + '_outro');
      s[key + '_outro'] = (s[key] === OUTRA && inp) ? inp.value.trim() : '';
    },
    final: function (s, key) {
      return s[key] === OUTRA ? String(s[key + '_outro'] || '').trim() : s[key];
    },
    validar: function (s, key) {
      return N.final(s, key) ? null : 'Informe a nacionalidade.';
    },
    carregar: function (s, key, salva) {
      if (!salva) { s[key] = 'Brasileiro(a)'; s[key + '_outro'] = ''; }
      else if (PADRAO.indexOf(salva) >= 0) { s[key] = salva; s[key + '_outro'] = ''; }
      else { s[key] = OUTRA; s[key + '_outro'] = salva; }
    }
  };

  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (!estado || !t || t.type !== 'radio' || !/^f_(.+)$/.test(t.name || '')) return;
    var key = t.name.slice(2);
    var cond = document.querySelector('[data-nac-cond="' + key + '"]');
    if (!cond) return;
    estado[key] = t.value;
    cond.innerHTML = outroHtml(estado, key);
  });
  document.addEventListener('input', function (ev) {
    var t = ev.target;
    var m = estado && t && /^f_(.+)_outro$/.exec(t.id || '');
    if (m && document.querySelector('[data-nac-cond="' + m[1] + '"]')) estado[m[1] + '_outro'] = t.value;
  });

  window.Nacionalidade = N;
})();
