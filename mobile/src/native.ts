import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { PermissionsAndroid, Platform } from 'react-native';
import { Tracker } from './core';

export const SITE = 'https://linktracbrasiliaprime.com.br';
const TASK = 'linktrac-familia-location-v1';
const options: SecureStore.SecureStoreOptions = {
  keychainService: 'br.com.linktrac.familia',
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};
async function request(path: string, body: unknown | undefined, token: string) {
  const control = new AbortController(), timer = setTimeout(() => control.abort(), 12000);
  try {
    const r = await fetch(SITE + '/api/familia-dispositivo' + path, {
      method: body === undefined ? 'GET' : 'POST', signal: control.signal,
      redirect: 'error', credentials: 'omit',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const d = await r.json();
    if (!r.ok || d.sucesso !== true) throw Object.assign(new Error(d.mensagem || 'Operação indisponível.'), { status: r.status });
    return d.dados;
  } finally { clearTimeout(timer); }
}
export async function stopGPS() {
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.stopLocationUpdatesAsync(TASK);
}
export const tracker = new Tracker({
  store: {
    get: key => SecureStore.getItemAsync(key, options),
    set: (key, value) => SecureStore.setItemAsync(key, value, options),
    remove: key => SecureStore.deleteItemAsync(key, options),
  }, request, stopGPS, now: Date.now, uuid: Crypto.randomUUID,
});

// Escopo global: permite ao sistema carregar a tarefa sem montar a interface.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
  try {
    if (error) { await tracker.stop(); return; }
    if (data?.locations) await tracker.receive(data.locations);
  } catch {
    // Falha de armazenamento/permissão: parar a coleta, sem registrar coordenadas ou tokens em logs.
    await stopGPS().catch(() => {});
  }
});

export async function requestPermissions() {
  if (Platform.OS === 'web') throw new Error('Instale a versão Android ou iPhone para compartilhar em segundo plano.');
  if (!(await TaskManager.isAvailableAsync())) throw new Error('Use uma compilação própria do Linktrac Família. Expo Go não atende este teste.');
  if (!(await Location.hasServicesEnabledAsync())) throw new Error('Ative a localização nas configurações do celular.');
  if ((await Location.requestForegroundPermissionsAsync()).status !== 'granted') throw new Error('Permita a localização para continuar.');
  if ((await Location.requestBackgroundPermissionsAsync()).status !== 'granted') throw new Error('Permita a localização em segundo plano nas configurações do celular e tente novamente.');
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    const notification = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    if (notification !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Permita as notificações para manter visível o aviso de compartilhamento.');
  }
}
export function startGPS() {
  return Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 15,
    timeInterval: 30000,
    deferredUpdatesInterval: 30000,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.OtherNavigation,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Linktrac Família — localização ativa',
      notificationBody: 'Seu responsável pode acompanhar sua localização. Abra o app para interromper.',
      notificationColor: '#159FC8',
      killServiceOnDestroy: true,
    },
  });
}
export async function reconcile() {
  const v = await tracker.view(), running = await Location.hasStartedLocationUpdatesAsync(TASK);
  const permission = await Location.getBackgroundPermissionsAsync();
  // Não reiniciar rastreamento automaticamente após falha, revogação ou fechamento forçado.
  if (v.ativo && (!running || permission.status !== 'granted')) await tracker.stop();
  if (!v.ativo && running) await stopGPS();
  await tracker.sync();
  return tracker.view();
}
