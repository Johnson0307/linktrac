const { createHash } = require('node:crypto');
const { data, horario } = require('../operacao/validacao');
const falhar = (mensagem, status = 400) => { throw Object.assign(new Error(mensagem), { status }); };
const hash = valor => createHash('sha256').update(valor).digest('hex');
const versao = 'familia-2026-11-20-v1';
const texto = `Autorização de compartilhamento de localização — Pessoas e família
Declaro ser pai, mãe ou responsável legal pelo menor identificado neste cadastro e que os dados informados são verdadeiros. Solicito a análise da minha identidade, maioridade, contato e vínculo antes da liberação do aparelho.
Autorizo especificamente a coleta da localização, horário, precisão e, quando disponível, velocidade do aparelho vinculado, para acompanhamento e segurança pessoal do menor. O acesso de acompanhamento nesta versão é exclusivo da minha conta. Não há compartilhamento público ou uso de localização para publicidade. A Linktrac registra as consultas para auditoria; a equipe que analisa o vínculo não recebe acesso ao mapa do menor.
Comprometo-me a explicar o funcionamento em linguagem adequada à idade do menor e a usar o recurso no seu melhor interesse, respeitando sua privacidade. A permissão de localização deve ser concedida no próprio aparelho, onde há indicação do compartilhamento e opção de interrompê-lo. A simples assinatura desta declaração não comprova o vínculo e não dispensa sua verificação.
As posições ficam disponíveis por até 14 dias da coleta; a exclusão física automática pode ocorrer posteriormente, sem disponibilização após o prazo. A revogação nesta plataforma interrompe o envio, remove o pareamento e exclui as posições do banco ativo. Cópias de segurança seguem seu ciclo restrito de descarte e não são usadas para consultas comuns. Registros mínimos de ações e aceite, sem coordenadas, têm retenção de 180 dias nesta versão. Dados de cadastro permanecem enquanto o cadastro existir.
Posso revogar a autorização e excluir o cadastro do menor pela plataforma. Perda do vínculo ou dúvida sobre a autorização deve ser informada à administração da Linktrac para suspensão imediata. Ao atingir 18 anos, este fluxo de acompanhamento por responsável deixa de aceitar ou exibir posições.
Esta versão web transmite somente enquanto a página está aberta e ativa; não garante localização contínua com a tela bloqueada. GPS pode ter imprecisão ou indisponibilidade. Este recurso não substitui atendimento de emergência.
O aceite é registrado na conta autenticada com a versão do termo, hash, data e horário do servidor. Não é apresentado como assinatura qualificada ICP-Brasil.`;
const termo = Object.freeze({ versao, hash: hash(texto), texto, retencaoDias: 14, auditoriaDias: 180 });
function hoje() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function idade(nascimento, referencia = hoje()) {
  if (!data(nascimento) || nascimento < '1900-01-01' || nascimento > referencia) falhar('Confira a data de nascimento.');
  return Number(referencia.slice(0,4)) - Number(nascimento.slice(0,4)) - (referencia.slice(5) < nascimento.slice(5) ? 1 : 0);
}
function campo(valor, nome, max = 120) {
  if (typeof valor !== 'string' || !valor.trim() || valor.length > max || /[\x00-\x1f\x7f]/.test(valor)) falhar('Confira ' + nome + '.');
  return valor.trim();
}
function validarResponsavel(body) {
  const nome = campo(body?.nome, 'o nome'), nascimento = body?.nascimento;
  if (idade(nascimento) < 18) falhar('O cadastro de responsável exige maioridade.');
  const contato = campo(body.contato, 'o contato', 30).replace(/[()+\s-]/g,'');
  if (!/^\d{10,15}$/.test(contato)) falhar('Informe telefone com DDD para conferência do contato.');
  return { nome, nascimento, contato };
}
function validarMenor(body) {
  const nome = campo(body?.nome, 'o nome'), nascimento = body?.nascimento;
  if (idade(nascimento) >= 18) falhar('Este cadastro é exclusivo para menores de 18 anos.');
  if (!['pai','mae','responsavel_legal'].includes(body.vinculo)) falhar('Informe seu vínculo com o menor.');
  return { nome, nascimento, vinculo: body.vinculo };
}
function verificacaoValida(v,usuarioId) { return Boolean(v?.estado === 'verificado' && v.por && String(v.por) !== String(usuarioId) && v.em && Number.isFinite(+new Date(v.em)) && typeof v.referencia === 'string' && v.referencia.trim()); }
function autorizado(responsavel, pessoa) {
  return Boolean(responsavel && pessoa && String(responsavel._id) === String(pessoa.responsavelId) &&
    String(responsavel.clienteId) === String(pessoa.clienteId) && String(responsavel.usuarioId) === String(pessoa.usuarioId) &&
    verificacaoValida(responsavel.verificacao,responsavel.usuarioId) && verificacaoValida(pessoa.verificacao,pessoa.usuarioId) && pessoa.ativo &&
    pessoa.consentimento?.versao === termo.versao && pessoa.consentimento?.hash === termo.hash &&
    pessoa.consentimento?.aceitoEm && String(pessoa.consentimento?.por) === String(pessoa.usuarioId) && !pessoa.consentimento?.revogadoEm && idade(responsavel.nascimento) >= 18 && idade(pessoa.nascimento) < 18);
}
function exigirAutorizacao(r,p) { if (!autorizado(r,p)) falhar('Acompanhamento indisponível: confira verificação, autorização e idade.', 403); }
function validarPontos(body, pessoa, agora = Date.now()) {
  if (!Array.isArray(body?.pontos) || !body.pontos.length || body.pontos.length > 200) falhar('Envie entre 1 e 200 posições.');
  const vistos = new Set();
  return body.pontos.map(p => {
    if (typeof p?.mensagemId !== 'string' || !/^[\w.-]{1,80}$/.test(p.mensagemId) || vistos.has(p.mensagemId)) falhar('Identificador de posição inválido ou repetido no lote.');
    vistos.add(p.mensagemId);
    if (!Number.isFinite(p.latitude) || Math.abs(p.latitude) > 90 || !Number.isFinite(p.longitude) || Math.abs(p.longitude) > 180 ||
        !Number.isFinite(p.precisao) || p.precisao < 0 || p.precisao > 100000 || !horario(p.dataHora)) falhar('Confira coordenadas, precisão e horário da posição.');
    const timestamp = Date.parse(p.dataHora), inicio = Math.max(+new Date(pessoa.pareadoEm), +new Date(pessoa.inicioCompartilhamentoEm), +new Date(pessoa.consentimento.aceitoEm));
    if (!Number.isFinite(inicio) || timestamp < inicio || timestamp < agora - 86400000 || timestamp > agora + 300000) falhar('Posição anterior à autorização, fora do compartilhamento ou com horário inválido.');
    if (p.velocidade !== undefined && (!Number.isFinite(p.velocidade) || p.velocidade < 0 || p.velocidade > 350)) falhar('Velocidade inválida.');
    return { mensagemId: p.mensagemId, latitude: p.latitude, longitude: p.longitude, precisao: p.precisao,
      ...(p.velocidade !== undefined ? { velocidade: p.velocidade } : {}), dataHora: new Date(timestamp),
      expiraEm: new Date(timestamp + 14 * 86400000) };
  });
}
function pessoaPublica(p, r, agora = Date.now()) {
  const acesso = autorizado(r,p), ultima = p.ultimaPosicao;
  return { _id: p._id, nome: p.nome, nascimento: p.nascimento, vinculo: p.vinculo,
    verificacao: p.verificacao?.estado || 'pendente', autorizado: acesso,
    consentimento: { aceitoEm: p.consentimento?.aceitoEm, revogadoEm: p.consentimento?.revogadoEm },
    aparelho: { nome: p.aparelhoNome, pareadoEm: p.pareadoEm, pausado: p.pausado },
    ultimaPosicao: acesso && !p.pausado && ultima?.expiraEm && +new Date(ultima.expiraEm) > agora ? ultima : null };
}
module.exports = { termo, hash, falhar, idade, campo, validarResponsavel, validarMenor, autorizado, exigirAutorizacao, validarPontos, pessoaPublica };
