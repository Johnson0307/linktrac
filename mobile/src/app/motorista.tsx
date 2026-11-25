import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { motoristaApp, ativarNotificacoes } from '../motoristaNative';
import type { AvisoPonto, EstadoMotorista } from '../motoristaCore';
function Botao({ nome, acao, ocupado }: { nome: string; acao: () => void; ocupado: boolean }) {
  return <Pressable accessibilityRole="button" disabled={ocupado} onPress={acao} style={[estilos.botao, ocupado && { opacity: 0.5 }]}><Text style={estilos.botaoTexto}>{nome}</Text></Pressable>;
}
export default function Motorista() {
  const [estado, setEstado] = useState<EstadoMotorista | null>(null), [avisos, setAvisos] = useState<AvisoPonto[]>([]);
  const [identificador, setIdentificador] = useState(''), [senha, setSenha] = useState('');
  const [erro, setErro] = useState(''), [ocupado, setOcupado] = useState(false), [conectado, setConectado] = useState(false);
  const atualizar = useCallback(async () => {
    const sessao = await motoristaApp.sessao(); setConectado(Boolean(sessao));
    if (!sessao) { setEstado(null); setAvisos([]); return; }
    const [status, lista] = await Promise.all([motoristaApp.status(), motoristaApp.avisos()]);
    setEstado(status); setAvisos(lista);
  }, []);
  async function executar(acao: () => Promise<unknown>) {
    if (ocupado) return; setOcupado(true); setErro('');
    try { await acao(); await atualizar(); }
    catch (e: any) { setErro(e.message || 'Não foi possível concluir. Tente novamente.'); }
    finally { setOcupado(false); }
  }
  useEffect(() => {
    let ativo = true;
    const conferir = () => { if (ativo) void atualizar().catch((e: Error) => { if (ativo) setErro(e.message); }); };
    conferir();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') conferir(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') conferir(); }, 30000);
    return () => { ativo = false; sub.remove(); clearInterval(timer); };
  }, [atualizar]);
  return <SafeAreaView style={estilos.tela}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={estilos.conteudo}>
    <Text style={estilos.marca}>LINKTRAC</Text><Text accessibilityRole="header" style={estilos.titulo}>Motorista</Text>
    <Text style={estilos.texto}>Lembretes de jornada. Faça a marcação no sistema de ponto da sua empresa, com o veículo parado.</Text>
    {erro ? <Text accessibilityRole="alert" style={estilos.erro}>{erro}</Text> : null}
    {!conectado ? <View style={estilos.cartao}>
      <Text style={estilos.texto}>Entre com a conta Motorista criada pelo gestor. O e-mail dessa conta precisa corresponder ao seu cadastro ativo de motorista.</Text>
      <TextInput accessibilityLabel="CPF ou CNPJ" value={identificador} onChangeText={setIdentificador} autoCapitalize="none" autoCorrect={false} maxLength={250} placeholder="CPF ou CNPJ" style={estilos.campo} editable={!ocupado} />
      <TextInput accessibilityLabel="Senha" value={senha} onChangeText={setSenha} secureTextEntry autoCapitalize="none" maxLength={1000} placeholder="Senha" style={estilos.campo} editable={!ocupado} />
      <Botao ocupado={ocupado} nome={ocupado ? 'Entrando…' : 'Entrar como motorista'} acao={() => void executar(async () => { try { await motoristaApp.entrar(identificador, senha); } finally { setSenha(''); } })} />
    </View> : <>
      {estado && <View style={estilos.cartao}>
        <Text style={estilos.subtitulo}>Olá, {estado.nome}</Text>
        <Text style={estilos.texto}>{estado.pushAtivo ? 'Avisos habilitados neste celular.' : 'Avisos deste celular desativados.'}</Text>
        {!estado.lembrete.ativo && <Text style={estilos.texto}>O gestor ainda precisa ativar o lembrete de ponto para a empresa.</Text>}
        {!estado.pushDisponivel && <Text style={estilos.texto}>A configuração de envio Android/iPhone está pendente na Linktrac. Você pode consultar os avisos com o app aberto.</Text>}
        <Botao ocupado={ocupado} nome="Ativar avisos neste celular" acao={() => Alert.alert('Receber lembretes de ponto?', 'Este celular será associado à sua conta. Expo, Google ou Apple encaminham um aviso genérico, sem placa, nome ou localização na tela bloqueada. Os detalhes só aparecem após abrir o app. Isso não registra ponto nem ativa GPS do motorista.', [
          { text: 'Agora não', style: 'cancel' }, { text: 'Permitir avisos', onPress: () => void executar(ativarNotificacoes) },
        ])} />
        <Botao ocupado={ocupado} nome="Desativar avisos" acao={() => void executar(() => motoristaApp.configurarAvisos(false))} />
      </View>}
      {avisos.map(aviso => <View key={aviso._id} style={estilos.cartao}>
        <Text style={estilos.subtitulo}>Confira seu ponto</Text><Text style={estilos.texto}>{aviso.mensagem}</Text>
        <Text style={estilos.texto}>Este aviso não registra nem confirma uma batida.</Text>
        {aviso.pontoUrl === 'https://app.tangerino.com.br/Tangerino/' && <Botao ocupado={ocupado} nome="Abrir Sólides Ponto" acao={() => void executar(() => Linking.openURL('https://app.tangerino.com.br/Tangerino/'))} />}
        <Botao ocupado={ocupado} nome="Dispensar lembrete" acao={() => void executar(() => motoristaApp.dispensar(aviso._id))} />
      </View>)}
      {estado && !avisos.length && <Text style={estilos.texto}>Nenhum lembrete pendente. Você pode registrar o ponto antes de ligar o veículo, diretamente no fornecedor.</Text>}
      <Botao ocupado={ocupado} nome="Atualizar" acao={() => void executar(atualizar)} />
      <Botao ocupado={ocupado} nome="Sair e desconectar este celular" acao={() => void executar(() => motoristaApp.sair())} />
    </>}
    <Text style={estilos.pequeno}>Notificações exigem internet e permissão do celular. Economia de bateria, falta de conexão ou encerramento forçado podem atrasar ou impedir o aviso. Não há coleta de GPS neste módulo.</Text>
    <Link href="/" style={estilos.link}>Voltar para Família</Link>
  </ScrollView></SafeAreaView>;
}
const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#F1F7FA' }, conteudo: { padding: 24, gap: 16, maxWidth: 620, width: '100%', alignSelf: 'center' },
  marca: { color: '#159FC8', fontWeight: '800', letterSpacing: 3, fontSize: 18 }, titulo: { fontSize: 36, fontWeight: '800', color: '#183543' },
  subtitulo: { fontSize: 22, fontWeight: '700', color: '#183543' }, texto: { color: '#334E5D', fontSize: 16, lineHeight: 24 },
  cartao: { padding: 20, backgroundColor: 'white', borderRadius: 16, gap: 14 }, campo: { borderWidth: 1, borderColor: '#B8CCD6', padding: 14, borderRadius: 10, fontSize: 17 },
  botao: { backgroundColor: '#087DA1', padding: 14, borderRadius: 10, minHeight: 50, justifyContent: 'center' }, botaoTexto: { color: 'white', fontWeight: '700', textAlign: 'center', fontSize: 16 },
  erro: { color: '#9A2435', fontSize: 15, lineHeight: 22 }, pequeno: { color: '#526775', fontSize: 13, lineHeight: 20 }, link: { color: '#087DA1', paddingVertical: 15 },
});
