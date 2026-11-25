import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { MotoristaApp } from './motoristaCore';
const SITE = 'https://linktracbrasiliaprime.com.br';
const options: SecureStore.SecureStoreOptions = { keychainService: 'br.com.linktrac.motorista', keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
async function request(path: string, body?: unknown, token?: string, tipo = 'Motorista') {
  const controle = new AbortController(), timer = setTimeout(() => controle.abort(), 12000);
  try {
    const resposta = await fetch(SITE + '/api' + path, { method: body === undefined ? 'GET' : 'POST',
      signal: controle.signal, credentials: 'omit', redirect: 'error',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: tipo + ' ' + token } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const d = await resposta.json();
    if (!resposta.ok || d.sucesso !== true) throw Object.assign(new Error(d.mensagem || 'Não foi possível conectar à plataforma.'), { status: resposta.status });
    return d.dados;
  } finally { clearTimeout(timer); }
}
export const motoristaApp = new MotoristaApp({
  plataforma: Platform.OS, uuid: Crypto.randomUUID, request,
  store: { get: key => SecureStore.getItemAsync(key, options), set: (key, value) => SecureStore.setItemAsync(key, value, options), remove: key => SecureStore.deleteItemAsync(key, options) },
});
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });
export async function ativarNotificacoes() {
  const status = await motoristaApp.status();
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!status.pushDisponivel || !projectId || projectId !== status.projectId) throw new Error('A configuração das notificações Android/iPhone ainda precisa ser concluída pela Linktrac.');
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('jornada', {
    name: 'Lembretes de jornada', importance: AndroidImportance.HIGH,
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
  });
  let permissoes = await Notifications.getPermissionsAsync();
  if (permissoes.status !== 'granted') permissoes = await Notifications.requestPermissionsAsync();
  if (permissoes.status !== 'granted') throw new Error('Permita as notificações para receber o lembrete com a tela fechada.');
  let token: string;
  try { token = (await Notifications.getExpoPushTokenAsync({ projectId })).data; }
  catch { throw new Error('Não foi possível registrar as notificações. Confira a configuração Android/iPhone e a conexão.'); }
  await motoristaApp.configurarAvisos(true, token, projectId);
}
