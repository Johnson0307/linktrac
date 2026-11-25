const estados = ['nao_informado', 'disponivel', 'em_teste', 'concluida', 'falha'];
function validarFirmware(raw) {
  const erro = () => { throw Object.assign(new Error('Confira versão, data, situação e recursos do firmware.'), { status: 400 }); };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) erro();
  const dados = {};
  for (const [campo, max] of [['atual', 100], ['disponivel', 100], ['falha', 500]]) {
    const valor = raw[campo] ?? '';
    if (typeof valor !== 'string' || valor.length > max || /[\x00-\x1f\x7f]/.test(valor)) erro();
    dados[campo] = valor.trim();
  }
  dados.estado = raw.estado ?? 'nao_informado'; if (!estados.includes(dados.estado)) erro();
  const recursos = raw.recursos ?? [];
  if (!Array.isArray(recursos) || recursos.length > 20 || recursos.some(r => typeof r !== 'string' || !r.trim() || r.length > 100 || /[\x00-\x1f\x7f]/.test(r))) erro();
  dados.recursos = [...new Set(recursos.map(r => r.trim()))];
  const data = raw.atualizadoEm;
  if (data != null && data !== '') {
    if (typeof data !== 'string' || !require('./validacao').horario(data) || Date.parse(data) > Date.now() + 300000) erro();
    dados.atualizadoEm = new Date(data).toISOString();
  }
  if (dados.estado === 'falha' && !dados.falha) erro();
  if (dados.estado === 'concluida' && (!dados.atual || !dados.atualizadoEm)) erro();
  return dados;
}
module.exports = { validarFirmware, estados };
