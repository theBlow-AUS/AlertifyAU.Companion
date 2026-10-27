import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold, DMSans_800ExtraBold, useFonts } from '@expo-google-fonts/dm-sans';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { CompanionProvider } from '@/contexts/CompanionContext';
import colors from '@/constants/colors';

void SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();
function RootLayoutNav() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const handle = (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.content.data?.incidentId;
      if (typeof id === 'string') router.push({ pathname: '/incident/[id]', params: { id } });
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(handle);
    void Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) { handle(response); void Notifications.clearLastNotificationResponseAsync(); }
    }).catch(() => undefined);
    return () => subscription.remove();
  }, []);
  return <>
    <StatusBar style="light" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.light.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="place" options={{ presentation: 'card' }} />
      <Stack.Screen name="incident/[id]" />
    </Stack>
  </>;
}
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold, DMSans_800ExtraBold, SpaceMono_400Regular });
  useEffect(() => { if (fontsLoaded || fontError) void SplashScreen.hideAsync(); }, [fontsLoaded, fontError]);
  if (!fontsLoaded && !fontError) return null;
  return <QueryClientProvider client={queryClient}><SafeAreaProvider><ErrorBoundary><GestureHandlerRootView style={{ flex: 1 }}><KeyboardProvider><CompanionProvider><RootLayoutNav /></CompanionProvider></KeyboardProvider></GestureHandlerRootView></ErrorBoundary></SafeAreaProvider></QueryClientProvider>;
}
