const { hash, falhar } = require('./regras');
const texto = `Autorização adicional — aplicativo Linktrac Família
Além da autorização de Pessoas e família, autorizo especificamente o aplicativo instalado no celular do menor a coletar e enviar localização, precisão, horário e, quando disponível, velocidade à Linktrac mesmo com a tela bloqueada ou durante o uso de outros aplicativos, enquanto o compartilhamento estiver ativo.
O aparelho mostrará indicação de localização e terá controles para iniciar, interromper e remover o pareamento. O menor deve ser informado de modo adequado à idade. Não há coleta oculta. A permissão do sistema precisa ser concedida no próprio celular. Somente minha conta autorizada pode acompanhar as posições na plataforma.
O app guarda a credencial e até 32 posições pendentes no armazenamento protegido do celular, para reenvio limitado à mesma sessão. O envio ocorre no máximo uma vez a cada 30 segundos por ponto coletado; frequência e precisão dependem do sistema. A fila local é limitada a 5 minutos sem confirmação da autorização: na próxima execução da tarefa após esse prazo, a coleta para e os pontos pendentes são removidos. Ao parar ou remover o pareamento, a fila também é removida. Em um celular desligado ou app sem execução, a limpeza local só pode ocorrer quando ele voltar a executar. As posições confirmadas no servidor mantêm a retenção de até 14 dias e a auditoria sem coordenadas de 180 dias descritas no termo principal.
Revogar a autorização na plataforma bloqueia novos envios no servidor. O aplicativo interrompe a coleta quando recebe essa informação. Sem internet não há bloqueio remoto instantâneo. Falta de bateria, permissões, sinal, encerramento forçado e restrições do Android/iOS podem interromper atualizações; não há garantia de localização contínua e o recurso não substitui emergência.
Esta autorização adicional não substitui a conferência do responsável e do vínculo, nem a autorização principal. Posso revogar o acompanhamento na plataforma. O aceite adicional tem versão, hash, conta e horário do servidor; não é assinatura qualificada ICP-Brasil.`;
const termoApp = Object.freeze({ versao: 'familia-app-2026-11-20-v1', texto, hash: hash(texto) });
const appDisponivel = () => process.env.FAMILIA_APP_HABILITADO === '1';
function autorizadoApp(p) {
  const c = p?.consentimentoApp;
  return Boolean(c?.versao === termoApp.versao && c.hash === termoApp.hash && c.aceitoEm &&
    String(c.por) === String(p.usuarioId) && !p.consentimento?.revogadoEm &&
    +new Date(c.aceitoEm) >= +new Date(p.consentimento?.aceitoEm));
}
function exigirApp(p) {
  if (!appDisponivel()) falhar('Aplicativo em preparação. Use a versão web até a liberação dos testes nativos.', 426);
  if (!autorizadoApp(p)) falhar('O responsável precisa ler e autorizar o aplicativo em segundo plano na plataforma.', 403);
}
module.exports = { termoApp, appDisponivel, autorizadoApp, exigirApp };
