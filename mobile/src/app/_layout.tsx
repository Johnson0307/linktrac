import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../motoristaNative';
export default function RootLayout() {
  useEffect(() => {
    const abrir = (resposta: Notifications.NotificationResponse | null) => {
      if (resposta?.notification.request.content.data?.tipo === 'lembrete_ponto') { router.push('/motorista'); Notifications.clearLastNotificationResponse(); }
    };
    abrir(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(abrir);
    return () => sub.remove();
  }, []);
  return <SafeAreaProvider><Stack screenOptions={{ headerShown: false }} /></SafeAreaProvider>;
}
