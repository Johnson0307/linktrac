const router = require('express').Router();
const { createHash, timingSafeEqual } = require('node:crypto');
const Cliente = require('../models/Cliente');
const Veiculo = require('../models/Veiculo');
const Localizacao = require('../models/Localizacao');
const { ChaveIntegracao, permissoesIntegracao } = require('../models/ChaveIntegracao');
const { permite } = require('../services/acessosCliente');
const { escopoEmpresa } = require('../services/carteiraRevenda');
const { identificadorValido } = require('../services/acessoVeiculo');
const { horario } = require('../operacao/validacao');
const { consultarHistorico } = require('../services/historicoArquivo');

const camposVeiculo = 'placa marca modelo ano cor ativo';
const camposPosicao = 'latitude longitude dataHora velocidade status ignicao';
const frotaReal = { $nor: [{ marca: 'TESTE', modelo: 'SIMULACAO' }] };
const falha = (res, status, mensagem) => res.status(status).json({ sucesso: false, mensagem });
const tratar = acao => async (req, res, next) => {
  try {
    await acao(req, res, next);
  } catch (e) {
    return falha(res, 503, e.code === 'ARQUIVO_HISTORICO_INDISPONIVEL' ? e.message : 'A integração está temporariamente indisponível.');
  }
};

router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.get('/documentacao', (_req, res) => res.json(require('../operacao/parceirosOpenApi')));
router.use(tratar(async (req, res, next) => {
  const token = /^Bearer ltp_([a-f\d]{24})_([a-f\d]{64})$/.exec(req.headers.authorization || '');
  const negar = () => falha(res, 401, 'Chave de integração inválida ou revogada.');
  if (!token) return negar();
  const chave = await ChaveIntegracao.findOne({ _id: token[1], revogadaEm: { $exists: false } })
    .select('+hash clienteId permissoes').lean();
  if (!chave || !/^[a-f\d]{64}$/.test(chave.hash) ||
      !timingSafeEqual(createHash('sha256').update(token[2]).digest(), Buffer.from(chave.hash, 'hex'))) return negar();
  const cliente = await Cliente.findById(chave.clienteId).select('ativo acessos revendedoraId').lean();
  const escopo = await escopoEmpresa(cliente);
  if (!escopo) return falha(res, 403, 'Empresa indisponível para integração.');
  req.integracaoParceiro = { id: chave._id, clienteId: chave.clienteId, permissoes: chave.permissoes, acessos: escopo.acessos };
  next();
}));

const autorizar = id => (req, res, next) => {
  const p = permissoesIntegracao[id];
  const { permissoes, acessos } = req.integracaoParceiro;
  if (!permissoes.includes(id) || !permite(acessos, p.modulo, p.alterar)) {
    return falha(res, 403, 'Esta operação não está liberada para a chave.');
  }
  next();
};

const filtroVeiculos = req => ({ ...frotaReal, clienteId: req.integracaoParceiro.clienteId });
const filtroPosicoes = req => ({ veiculoId: req.params.id, fonte: { $ne: 'simulado' } });
const conferirVeiculo = tratar(async (req, res, next) => {
  if (!identificadorValido(req.params.id) ||
      !(await Veiculo.exists({ ...filtroVeiculos(req), _id: req.params.id }))) {
    return falha(res, 404, 'Veículo não encontrado.');
  }
  next();
});

function limiteDaConsulta(valor, maximo) {
  if (valor === undefined) return Math.min(100, maximo);
  if (typeof valor !== 'string' || !/^\d{1,3}$/.test(valor) || Number(valor) < 1 || Number(valor) > maximo) return null;
  return Number(valor);
}

router.get('/veiculos', autorizar('veiculos:ler'), tratar(async (req, res) => {
  const { apos } = req.query;
  const limite = limiteDaConsulta(req.query.limite, 100);
  if (!limite || (apos !== undefined && !identificadorValido(apos))) return falha(res, 400, 'Use um limite de 1 a 100 e um cursor válido.');
  const dados = await Veiculo.find({ ...filtroVeiculos(req), ...(apos ? { _id: { $gt: apos } } : {}) })
    .select(camposVeiculo).sort({ _id: 1 }).limit(limite + 1).lean();
  return res.json({ sucesso: true, dados: dados.slice(0, limite), proximo: dados.length > limite ? dados[limite - 1]._id : null });
}));

router.get('/veiculos/:id/posicao', autorizar('posicoes:ler'), conferirVeiculo, tratar(async (req, res) => {
  const dados = await Localizacao.findOne(filtroPosicoes(req)).select(camposPosicao).sort({ dataHora: -1, _id: -1 }).lean();
  return res.json({ sucesso: true, dados });
}));

router.get('/veiculos/:id/posicoes', autorizar('posicoes:ler'), conferirVeiculo, tratar(async (req, res) => {
  const { inicio, fim, antes, antesId } = req.query;
  const limite = limiteDaConsulta(req.query.limite, 500);
  if (!limite || !horario(inicio) || !horario(fim) || Date.parse(inicio) > Date.parse(fim) ||
      (antes !== undefined || antesId !== undefined) && (!horario(antes) || !identificadorValido(antesId))) {
    return falha(res, 400, 'Informe início e fim com fuso horário, limite de 1 a 500 e o cursor completo se houver.');
  }
  const filtro = { ...filtroPosicoes(req), dataHora: { $gte: new Date(inicio), $lte: new Date(fim) } };
  if (antes) filtro.$or = [{ dataHora: { $lt: new Date(antes) } }, { dataHora: new Date(antes), _id: { $lt: antesId } }];
  const dados = await consultarHistorico(Localizacao, filtro, { campos: camposPosicao, limite: limite + 1 });
  const ultimo = dados[limite - 1];
  return res.json({ sucesso: true, dados: dados.slice(0, limite),
    proximo: dados.length > limite ? { antes: ultimo.dataHora, antesId: ultimo._id } : null });
}));

router.patch('/veiculos/:id', autorizar('veiculos:editar'), tratar(async (req, res) => {
  const payload = req.body;
  if (!identificadorValido(req.params.id)) return falha(res, 404, 'Veículo não encontrado.');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Object.keys(payload).length ||
      Object.keys(payload).some(campo => !['marca', 'modelo', 'ano', 'cor'].includes(campo))) {
    return falha(res, 400, 'Envie somente marca, modelo, ano ou cor.');
  }
  const dados = {};
  for (const [campo, valor] of Object.entries(payload)) {
    if (campo === 'ano') {
      if (!Number.isInteger(valor) || valor < 1886 || valor > new Date().getFullYear() + 1) {
        return falha(res, 400, 'Informe um ano válido.');
      }
      dados.ano = valor;
    } else {
      if (typeof valor !== 'string' || valor.length > 100 || (campo !== 'cor' && !valor.trim())) {
        return falha(res, 400, 'Confira a marca, o modelo e a cor. Limite de 100 caracteres por campo.');
      }
      dados[campo] = valor.trim();
    }
  }
  const veiculo = await Veiculo.findOneAndUpdate({ ...filtroVeiculos(req), _id: req.params.id },
    { $set: dados }, { returnDocument: 'after', runValidators: true }).select(camposVeiculo).lean();
  if (!veiculo) return falha(res, 404, 'Veículo não encontrado.');
  req.user = { clienteId: req.integracaoParceiro.clienteId, id: `integração:${req.integracaoParceiro.id}` };
  return res.json({ sucesso: true, dados: veiculo });
}));

router.use((_req, res) => falha(res, 404, 'Operação de integração não encontrada.'));
module.exports = router;
