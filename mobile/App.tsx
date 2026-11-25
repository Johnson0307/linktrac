import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Link } from 'expo-router';
import { reconcile, requestPermissions, SITE, startGPS, tracker } from './src/native';

const empty = { pareado: false, nome: '', ativo: false, enviado: 0, aviso: '', pendentes: 0 };
function Screen() {
  const [state, setState] = useState(empty), [code, setCode] = useState(''), [device, setDevice] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const refresh = useCallback(async () => { setState(await tracker.view()); }, []);
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (e: any) { setError(e.message || 'Não foi possível concluir. Tente novamente.'); }
    finally { await refresh().catch(() => setError('Não foi possível ler o armazenamento protegido.')); setBusy(false); }
  };
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try { const next = await reconcile(); if (alive) { setState(next); setError(''); } }
      catch (e: any) { if (alive) { setError(e.message || 'Não foi possível consultar a conexão.'); await refresh().catch(() => {}); } }
    };
    void check();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') void check(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void check(); }, 30000);
    return () => { alive = false; sub.remove(); clearInterval(timer); };
  }, [refresh]);
  const Button = ({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) =>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy }} disabled={disabled || busy} onPress={onPress}
      style={[styles.button, secondary && styles.secondary, (disabled || busy) && styles.disabled]}>
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
    </Pressable>;
  return <SafeAreaView style={styles.safe}><StatusBar style="dark" />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
      <Text style={styles.brand}>LINKTRAC</Text><Text accessibilityRole="header" style={styles.title}>Família</Text>
      <Text style={styles.subtitle}>Acompanhamento com autorização e controle no próprio celular.</Text>
      <View style={styles.card}>
        <View style={[styles.badge, state.ativo && styles.badgeActive]}><Text style={styles.badgeText}>{state.ativo ? 'LOCALIZAÇÃO ATIVA' : 'LOCALIZAÇÃO INTERROMPIDA'}</Text></View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {state.aviso ? <Text accessibilityLiveRegion="polite" style={styles.paragraph}>{state.aviso}</Text> : null}
        {!state.pareado ? <>
          <Text accessibilityRole="header" style={styles.heading}>Conectar este celular</Text>
          <Text style={styles.paragraph}>Este deve ser o celular do menor que será acompanhado. O responsável gera o código em Pessoas e família → Adicionar ou trocar aparelho.</Text>
          <Text style={styles.label}>Código de pareamento</Text>
          <TextInput accessibilityLabel="Código de pareamento" autoCapitalize="characters" autoCorrect={false} maxLength={14} editable={!busy} style={styles.input} value={code} onChangeText={setCode} placeholder="XXXX-XXXX-XXXX" />
          <Text style={styles.label}>Nome deste aparelho</Text>
          <TextInput accessibilityLabel="Nome deste aparelho" autoCorrect={false} maxLength={80} editable={!busy} style={styles.input} value={device} onChangeText={setDevice} placeholder="Ex.: Celular do João" />
          <Text style={styles.small}>É apenas um nome para identificar o celular. Não informe telefone, IMEI ou senha. O código vale 15 minutos e só funciona uma vez.</Text>
          <Button title={busy ? 'Conectando…' : 'Parear este aparelho'} onPress={() => void run(async () => { await tracker.pair(code, device); setCode(''); })} />
        </> : <>
          <Text style={styles.heading}>Olá, {state.nome}</Text>
          <Text style={styles.paragraph}>O responsável autorizado pode consultar sua localização e até 14 dias de histórico. Você pode interromper o envio aqui.</Text>
          <Text style={styles.small}>{state.enviado ? 'Último envio confirmado: ' + new Date(state.enviado).toLocaleString('pt-BR') : 'Nenhum envio confirmado neste aplicativo.'}</Text>
          {!!state.pendentes && <Text style={styles.small}>{state.pendentes} posições aguardando envio protegido.</Text>}
          <Button title="Iniciar compartilhamento" disabled={state.ativo} onPress={() => Alert.alert('Permitir localização em segundo plano?',
            'Durante o compartilhamento, este app coleta a localização mesmo com a tela bloqueada ou enquanto você usa outros aplicativos, e a envia à Linktrac para o responsável. O sistema mostrará um aviso de localização. Você pode interromper a qualquer momento. Sem confirmação da autorização por 5 minutos, a coleta é interrompida.',
            [{ text: 'Agora não', style: 'cancel' }, { text: 'Permitir e iniciar', onPress: () => void run(async () => { await requestPermissions(); await tracker.start(startGPS); }) }])} />
          <Button title="Interromper compartilhamento" secondary disabled={!state.ativo} onPress={() => void run(() => tracker.stop())} />
          <Button title="Remover este aparelho" secondary onPress={() => Alert.alert('Remover o pareamento?', 'O GPS será interrompido e o acesso salvo neste celular será removido. Para conectar novamente, será necessário outro código.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Remover', style: 'destructive', onPress: () => void run(() => tracker.stop(true)) }])} />
        </>}
      </View>
      <Text style={styles.small}>O celular precisa estar ligado, com localização e permissões ativas. Falta de internet, economia de bateria ou encerramento forçado podem interromper as atualizações. Este recurso não substitui atendimento de emergência.</Text>
      <Button title="Abrir painel do responsável" secondary onPress={() => void Linking.openURL(SITE + '/pessoas')} />
      <Link href="/motorista" style={styles.secondaryText}>Entrar como motorista</Link>
      <Button title="Configurações de permissão do celular" secondary onPress={() => void Linking.openSettings()} />
      <Text style={styles.footer}>Linktrac Família · Piloto para testes</Text>
    </ScrollView></SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><Screen /></SafeAreaProvider>; }
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F1F7FA' }, container: { padding: 24, paddingBottom: 40, maxWidth: 620, width: '100%', alignSelf: 'center', gap: 12 },
  brand: { color: '#159FC8', fontWeight: '800', letterSpacing: 3, fontSize: 18, marginTop: 20 }, title: { color: '#183543', fontWeight: '800', fontSize: 38 },
  subtitle: { color: '#526775', fontSize: 16, lineHeight: 24, marginBottom: 8 }, card: { backgroundColor: 'white', borderRadius: 20, padding: 22, gap: 14, borderWidth: 1, borderColor: '#DCE7ED' },
  heading: { fontWeight: '700', color: '#183543', fontSize: 22 }, paragraph: { fontSize: 16, lineHeight: 24, color: '#334E5D' },
  badge: { backgroundColor: '#E9EEF2', padding: 10, borderRadius: 10 }, badgeActive: { backgroundColor: '#CAEFDD' }, badgeText: { color: '#183543', fontWeight: '700', fontSize: 12 },
  label: { color: '#334E5D', fontWeight: '600', fontSize: 15 }, input: { borderWidth: 1, borderColor: '#B8CCD6', borderRadius: 10, padding: 14, color: '#183543', backgroundColor: '#FAFCFD', fontSize: 17 },
  button: { backgroundColor: '#087DA1', minHeight: 50, padding: 14, borderRadius: 10, justifyContent: 'center' }, buttonText: { color: 'white', fontWeight: '700', textAlign: 'center', fontSize: 16 },
  secondary: { backgroundColor: '#E8F1F6' }, secondaryText: { color: '#164A61' }, disabled: { opacity: 0.45 },
  small: { color: '#526775', fontSize: 13, lineHeight: 20 }, error: { color: '#9A2435', fontSize: 15, lineHeight: 22 }, footer: { color: '#526775', textAlign: 'center', marginTop: 12, fontSize: 12 },
});
