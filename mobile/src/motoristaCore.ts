import type { Store } from './core';
export type AvisoPonto = { _id: string; mensagem: string; ocorridoEm: string; pontoUrl: string | null };
export type EstadoMotorista = { nome: string; expiraEm: string; pushAtivo: boolean; pushDisponivel: boolean; projectId: string | null; lembrete: { ativo: boolean } };
export type SessaoMotorista = { token: string; expiraEm: string };
export type PortasMotorista = { store: Store; uuid: () => string; plataforma: string;
  request: (path: string, body?: unknown, credencial?: string, tipo?: 'Bearer' | 'Motorista') => Promise<any> };
const CHAVE = 'lm.session.v1', INSTALACAO = 'lm.instalacao.v1';
export class MotoristaApp {
  constructor(private p: PortasMotorista) {}
  async sessao(): Promise<SessaoMotorista | null> {
    const raw = await this.p.store.get(CHAVE); if (!raw) return null;
    const s = JSON.parse(raw);
    if (!/^[a-f0-9]{64}$/.test(s.token) || !Number.isFinite(Date.parse(s.expiraEm))) throw new Error('Acesso salvo inválido. Remova o acesso deste aplicativo.');
    return s;
  }
  async entrar(identificador: string, senha: string) {
    if (await this.sessao()) throw new Error('Saia da conta atual antes de conectar outra.');
    if (!identificador.trim() || !senha || identificador.length > 250 || senha.length > 1000) throw new Error('Informe seu CPF ou CNPJ e sua senha.');
    const login = await this.p.request('/auth/login', { identificador: identificador.trim(), senha });
    if (login.usuario?.role !== 'motorista' || typeof login.token !== 'string') throw new Error('Use uma conta com perfil Motorista. O gestor cadastra seu acesso na plataforma.');
    let instalacao = await this.p.store.get(INSTALACAO);
    if (!instalacao) { instalacao = this.p.uuid(); await this.p.store.set(INSTALACAO, instalacao); }
    const acesso = await this.p.request('/motorista-app/registrar', { instalacao, plataforma: this.p.plataforma, pushAtivo: false }, login.token, 'Bearer');
    if (!/^[a-f0-9]{64}$/.test(acesso.token) || !Number.isFinite(Date.parse(acesso.expiraEm))) throw new Error('Resposta de acesso inválida.');
    try { await this.p.store.set(CHAVE, JSON.stringify({ token: acesso.token, expiraEm: acesso.expiraEm })); }
    catch {
      await this.p.request('/motorista-app/desconectar', {}, acesso.token, 'Motorista').catch(() => {});
      throw new Error('Não foi possível salvar o acesso protegido neste celular.');
    }
    return this.status();
  }
  private async chamar(path: string, body?: unknown) {
    const s = await this.sessao(); if (!s) throw new Error('Entre com sua conta de motorista.');
    return this.p.request('/motorista-app' + path, body, s.token, 'Motorista');
  }
  status(): Promise<EstadoMotorista> { return this.chamar('/status'); }
  avisos(): Promise<AvisoPonto[]> { return this.chamar('/lembretes'); }
  dispensar(id: string) {
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new Error('Lembrete inválido.');
    return this.chamar('/lembretes/' + id + '/dispensar', {});
  }
  configurarAvisos(ativo: boolean, pushToken?: string, projectId?: string) {
    return this.chamar('/notificacoes', { ativo, ...(ativo ? { pushToken, projectId, consentimento: true } : {}) });
  }
  async sair() {
    const s = await this.sessao();
    if (!s) return;
    // Só esquece a credencial após revogar no servidor, evitando avisos para uma conta antiga.
    try { await this.p.request('/motorista-app/desconectar', {}, s.token, 'Motorista'); }
    catch (e: any) { if (e.status !== 401) throw new Error('Conecte-se à internet para desconectar este celular com segurança.'); }
    await this.p.store.remove(CHAVE);
  }
}
