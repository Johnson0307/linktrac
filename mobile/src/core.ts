// Sem dependência nativa: a mesma lógica é usada pelo Android, iOS e pelos testes.
export const MAX_QUEUE = 32;
export const LEASE_MS = 5 * 60_000;
export type Point = { mensagemId: string; latitude: number; longitude: number; precisao: number; dataHora: string; velocidade?: number };
export type Fix = { timestamp: number; coords: { latitude: number; longitude: number; accuracy: number | null; speed: number | null } };
export type Session = { token: string; nome: string; ativo: boolean; inicio: number; confirmado: number; ultimo: number; enviado: number; aviso: string };
export type DeviceStatus = { nome: string; pausado: boolean; appDisponivel?: boolean; autorizacaoApp?: boolean };
export type Store = { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void>; remove: (key: string) => Promise<void> };
export type Ports = { store: Store; request: (path: string, body: unknown | undefined, token: string) => Promise<any>; stopGPS: () => Promise<void>; now: () => number; uuid: () => string };
const SESSION = 'lf.session.v1';
const slot = (i: number) => 'lf.point.' + i;
const fatal = (e: any) => [400, 401, 403, 404, 409, 426].includes(e?.status);
export function toPoint(fix: Fix, inicio: number, now: number, uuid: () => string): Point | null {
  const c = fix?.coords, t = fix?.timestamp;
  if (!c || !Number.isFinite(t) || t < inicio || t < now - 86400_000 || t > now + 300_000 ||
      !Number.isFinite(c.latitude) || Math.abs(c.latitude) > 90 || !Number.isFinite(c.longitude) || Math.abs(c.longitude) > 180 ||
      c.accuracy == null || !Number.isFinite(c.accuracy) || c.accuracy < 0 || c.accuracy > 100_000) return null;
  const speed = c.speed == null ? undefined : c.speed * 3.6;
  return { mensagemId: uuid(), latitude: c.latitude, longitude: c.longitude, precisao: c.accuracy,
    dataHora: new Date(t).toISOString(), ...(speed !== undefined && Number.isFinite(speed) && speed >= 0 && speed <= 350 ? { velocidade: speed } : {}) };
}
export class Tracker {
  private tail: Promise<unknown> = Promise.resolve();
  private stopping = false;
  constructor(private p: Ports) {}
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tail.then(fn, fn); this.tail = next.catch(() => {}); return next;
  }
  private async read(): Promise<Session | null> {
    const raw = await this.p.store.get(SESSION);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!/^[a-f0-9]{64}$/i.test(s.token) || typeof s.ativo !== 'boolean') throw new Error('Acesso local inválido. Remova o pareamento.');
    return s;
  }
  private save(s: Session) { return this.p.store.set(SESSION, JSON.stringify(s)); }
  private async clearQueue() { for (let i = 0; i < MAX_QUEUE; i++) await this.p.store.remove(slot(i)); }
  private async queue() {
    const points: { index: number; point: Point }[] = [];
    for (let i = 0; i < MAX_QUEUE; i++) {
      const raw = await this.p.store.get(slot(i));
      if (raw) points.push({ index: i, point: JSON.parse(raw) });
    }
    return points.sort((a, b) => Date.parse(a.point.dataHora) - Date.parse(b.point.dataHora));
  }
  private async halt(s: Session, aviso: string, remove = false) {
    // O bloqueio local é persistido antes de qualquer operação de rede.
    s.ativo = false; s.aviso = aviso;
    await this.save(s);
    try { await this.p.stopGPS(); } finally { await this.clearQueue(); }
    if (remove) await this.p.store.remove(SESSION);
  }
  view() { return this.serial(async () => {
    const s = await this.read();
    return s ? { pareado: true, nome: s.nome, ativo: s.ativo, enviado: s.enviado, aviso: s.aviso, pendentes: (await this.queue()).length } :
      { pareado: false, nome: '', ativo: false, enviado: 0, aviso: '', pendentes: 0 };
  }); }
  pair(code: string, name: string) { return this.serial(async () => {
    if (await this.read()) throw new Error('Remova o pareamento atual antes de conectar outro aparelho.');
    const codigo = code.replace(/-/g, '').trim().toUpperCase();
    if (!/^[A-F0-9]{12}$/.test(codigo) || !name.trim() || name.trim().length > 80) throw new Error('Confira o código e o nome do aparelho.');
    const support = await this.p.request('/app-info', undefined, '');
    if (!support.appDisponivel || support.versaoProtocolo !== 1) throw new Error('O aplicativo ainda não foi liberado nesta plataforma. Seu código não foi utilizado.');
    const d = await this.p.request('/parear', { codigo, nomeAparelho: name.trim(), modalidade: 'app' }, '');
    if (!/^[a-f0-9]{64}$/i.test(d.token)) throw new Error('Resposta de pareamento inválida.');
    try {
      await this.clearQueue();
      await this.save({ token: d.token, nome: d.nome, ativo: false, inicio: 0, confirmado: 0, ultimo: 0, enviado: 0, aviso: 'Conectado. A localização ainda está interrompida.' });
    } catch (e) {
      // Não deixar uma credencial válida no servidor quando a gravação protegida falhar.
      try { await this.p.request('/desparear', {}, d.token); } catch {}
      throw e;
    }
  }); }
  start(activateGPS: () => Promise<void>) { return this.serial(async () => {
    const s = await this.read(); if (!s) throw new Error('Conecte este aparelho primeiro.');
    this.stopping = false;
    const status: DeviceStatus = await this.p.request('/status', undefined, s.token);
    if (!status.appDisponivel || !status.autorizacaoApp) throw new Error('O responsável precisa autorizar o aplicativo e o envio em segundo plano na plataforma.');
    if (!status.pausado) await this.p.request('/pausar', {}, s.token);
    await this.clearQueue();
    await this.p.request('/iniciar', {}, s.token);
    // Instante posterior ao ACK do servidor: descarta fixes anteriores à nova sessão.
    s.inicio = this.p.now(); s.confirmado = s.inicio; s.ultimo = 0; s.ativo = true; s.aviso = 'Compartilhamento ativo, inclusive com a tela bloqueada.';
    try {
      await this.save(s);
      if (this.stopping) throw new Error('Início cancelado.');
      await activateGPS();
    } catch (e) {
      await this.halt(s, 'Não foi possível iniciar o GPS. Compartilhamento interrompido.');
      try { await this.p.request('/pausar', {}, s.token); } catch {}
      throw e;
    }
  }); }
  stop(remove = false) {
    this.stopping = true;
    return this.serial(async () => {
      const s = await this.read(); if (!s) { await this.p.stopGPS(); await this.clearQueue(); return; }
      await this.halt(s, remove ? 'Aparelho removido.' : 'Compartilhamento interrompido neste aparelho.');
      try { await this.p.request(remove ? '/desparear' : '/pausar', {}, s.token); }
      catch (e: any) {
        if (!fatal(e)) {
          s.aviso = remove ? 'Acesso removido localmente. Gere um novo código no painel para invalidar o acesso anterior no servidor.' : 'GPS interrompido. A pausa no servidor será confirmada quando houver conexão.';
          await this.save(s);
        }
      }
      if (remove) await this.p.store.remove(SESSION);
    });
  }
  sync() { return this.serial(async () => {
    const s = await this.read(); if (!s) return;
    try {
      const d: DeviceStatus = await this.p.request('/status', undefined, s.token);
      if (s.ativo && (d.pausado || !d.appDisponivel || !d.autorizacaoApp)) await this.halt(s, 'Compartilhamento interrompido pela plataforma.');
      else if (!s.ativo && !d.pausado) await this.p.request('/pausar', {}, s.token);
      else if (s.ativo) { s.confirmado = this.p.now(); await this.save(s); }
    } catch (e: any) {
      if (fatal(e)) await this.halt(s, 'Autorização indisponível. Solicite novo pareamento.', true);
      else if (s.ativo && this.p.now() - s.confirmado > LEASE_MS) await this.halt(s, 'Sem confirmação da autorização por 5 minutos. Conecte à internet e inicie novamente.');
      else throw new Error('Não foi possível consultar a plataforma. Confira sua conexão.');
    }
  }); }
  receive(fixes: Fix[]) { return this.serial(async () => {
    const s = await this.read(); if (!s || !s.ativo || this.stopping) { await this.p.stopGPS(); return; }
    const now = this.p.now();
    try {
      const d: DeviceStatus = await this.p.request('/status', undefined, s.token);
      if (d.pausado || !d.appDisponivel || !d.autorizacaoApp) { await this.halt(s, 'Compartilhamento interrompido pela plataforma.'); return; }
      s.confirmado = now;
    } catch (e: any) {
      if (fatal(e)) { await this.halt(s, 'Autorização encerrada. Solicite novo pareamento.', true); return; }
      if (now - s.confirmado > LEASE_MS) { await this.halt(s, 'Sem confirmação da autorização por 5 minutos. Inicie novamente com internet.'); return; }
    }
    const queue = await this.queue();
    for (const fix of [...fixes].sort((a, b) => a.timestamp - b.timestamp)) {
      if (this.stopping) return;
      const p = toPoint(fix, s.inicio, now, this.p.uuid);
      if (!p || Date.parse(p.dataHora) - s.ultimo < 30_000) continue;
      // A fila protegida é limitada a 32 pontos (~16 minutos a 30s), cada item <2KB.
      let index = Array.from({ length: MAX_QUEUE }, (_, i) => i).find(i => !queue.some(q => q.index === i));
      if (index === undefined) index = queue.shift()!.index;
      await this.p.store.set(slot(index), JSON.stringify(p));
      queue.push({ index, point: p }); s.ultimo = Date.parse(p.dataHora);
    }
    await this.save(s);
    if (!queue.length || this.stopping) return;
    try {
      await this.p.request('/posicoes', { pontos: queue.map(q => q.point) }, s.token);
      for (const q of queue) await this.p.store.remove(slot(q.index));
      s.enviado = this.p.now(); s.aviso = 'Localização enviada à Linktrac.'; await this.save(s);
    } catch (e: any) {
      if (fatal(e)) await this.halt(s, 'Envio interrompido. Confira autorização e horário automático do aparelho.', [401, 403, 404].includes(e.status));
      else { s.aviso = 'Sem envio confirmado. Pontos aguardam protegidos neste aparelho.'; await this.save(s); }
    }
  }); }
}
