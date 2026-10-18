/* Campo de telefone celular com DDD (lista oficial de DDDs + número), mesmo
 * comportamento do formulário de currículo (curriculo-form.html): DDD num
 * <select>, número com 8 ou 9 dígitos (8 dígitos ganham o "9" na frente) —
 * aqui com máscara 00000-0000 enquanto digita.
 *
 * USO (formulário novo)
 *   1. <script src="assets/campo-telefone.js"></script>
 *   2. ${Telefone.campoHtml(obj, 'tel', 'idUnico', 'Telefone celular', true)}
 *      → guarda em obj.tel_ddd / obj.tel_num (atualiza sozinho, sem bind).
 *   3. Telefone.validar(obj, 'tel', obrigatorio) → mensagem de erro ou null
 *   4. Telefone.formatar(obj, 'tel') → "(47) 99999-9999" ('' se vazio/inválido)
 */
(function () {
  var DDDS = [['11','SP'],['12','SP'],['13','SP'],['14','SP'],['15','SP'],['16','SP'],['17','SP'],['18','SP'],['19','SP'],['21','RJ'],['22','RJ'],['24','RJ'],['27','ES'],['28','ES'],['31','MG'],['32','MG'],['33','MG'],['34','MG'],['35','MG'],['37','MG'],['38','MG'],['41','PR'],['42','PR'],['43','PR'],['44','PR'],['45','PR'],['46','PR'],['47','SC'],['48','SC'],['49','SC'],['51','RS'],['53','RS'],['54','RS'],['55','RS'],['61','DF'],['62','GO'],['64','GO'],['63','TO'],['65','MT'],['66','MT'],['67','MS'],['68','AC'],['69','RO'],['71','BA'],['73','BA'],['74','BA'],['75','BA'],['77','BA'],['79','SE'],['81','PE'],['87','PE'],['82','AL'],['83','PB'],['84','RN'],['85','CE'],['88','CE'],['86','PI'],['89','PI'],['91','PA'],['93','PA'],['94','PA'],['92','AM'],['97','AM'],['95','RR'],['96','AP'],['98','MA'],['99','MA']];
  var reg = {}; // idKey -> { obj, prop }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function normalizar(numero) {
    var d = String(numero || '').replace(/\D/g, '');
    if (d.length === 8) return '9' + d;
    if (d.length === 9) return d;
    return null;
  }
  function mascara(numero) {
    var d = String(numero || '').replace(/\D/g, '').slice(0, 9);
    return d.length > 5 ? d.slice(0, d.length === 9 ? 5 : 4) + '-' + d.slice(d.length === 9 ? 5 : 4) : d;
  }
  var T = {
    DDDS: DDDS,
    normalizar: normalizar,
    campoHtml: function (obj, prop, idKey, label, obrigatorio) {
      reg[idKey] = { obj: obj, prop: prop };
      var m = obrigatorio ? ' *' : '';
      var opts = DDDS.map(function (p) { return '<option value="' + p[0] + '"' + (obj[prop + '_ddd'] === p[0] ? ' selected' : '') + '>' + p[0] + ' — ' + p[1] + '</option>'; }).join('');
      return '<div class="field"><label>DDD' + m + '</label><select id="f_' + idKey + '_ddd" data-tel="' + idKey + '"><option value="">Selecione</option>' + opts + '</select></div>'
        + '<div class="field"><label>' + esc(label) + m + '</label><input type="tel" inputmode="numeric" id="f_' + idKey + '_num" data-tel="' + idKey + '" value="' + esc(mascara(obj[prop + '_num'])) + '" placeholder="8 ou 9 dígitos"></div>';
    },
    validar: function (obj, prop, obrigatorio) {
      var ddd = obj[prop + '_ddd'], num = obj[prop + '_num'];
      if (!ddd && !num) return obrigatorio ? 'Preencha o DDD e o número do telefone.' : null;
      if (!ddd || !num) return 'Preencha o DDD e o número do telefone.';
      if (!normalizar(num)) return 'Telefone inválido — informe 8 ou 9 dígitos (sem o DDD).';
      return null;
    },
    formatar: function (obj, prop) {
      var n = normalizar(obj[prop + '_num']);
      return (obj[prop + '_ddd'] && n) ? '(' + obj[prop + '_ddd'] + ') ' + mascara(n) : '';
    }
  };
  function aoMudar(ev) {
    var t = ev.target, k = t && t.getAttribute && t.getAttribute('data-tel');
    if (!k || !reg[k]) return;
    var r = reg[k];
    if (t.id === 'f_' + k + '_num') { t.value = mascara(t.value); r.obj[r.prop + '_num'] = t.value; }
    else r.obj[r.prop + '_ddd'] = t.value;
  }
  document.addEventListener('input', aoMudar);
  document.addEventListener('change', aoMudar);
  window.Telefone = T;
})();
