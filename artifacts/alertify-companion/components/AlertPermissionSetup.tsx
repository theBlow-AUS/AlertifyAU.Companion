import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCompanion } from '@/contexts/CompanionContext';
import { enableNotifications } from '@/lib/monitor';
import { requestCurrentLocationPermission } from '@/lib/location';

const INTRO_KEY = 'alertify.permission-setup-intro.v1';

/** Explain the optional features before displaying any operating-system prompt. */
export function AlertPermissionSetup() {
  const { ready, settings, storageError, saveSettings } = useCompanion();
  const shown = useRef(false);
  useEffect(() => {
    if (Platform.OS === 'web' || !ready || storageError || shown.current || settings.notifications) return;
    let cancelled = false;
    async function setup() {
      try {
        await enableNotifications();
        await saveSettings({ notifications: true });
        await requestCurrentLocationPermission();
        await saveSettings({ currentLocationAlerts: true });
      } catch (error) {
        Alert.alert('Alert setup', `${error instanceof Error ? error.message : 'Alert setup could not finish.'}\n\nYou can review permissions and alert options in Settings. Background trip location is a separate opt-in.`);
      }
    }
    void AsyncStorage.getItem(INTRO_KEY).then(seen => {
      if (cancelled || seen || shown.current) return;
      shown.current = true;
      Alert.alert(
        'Set up on-device alerts?',
        'Alertify can send notifications for selected hazards near your watch addresses and current location. Set up asks for notification and foreground location access. Background location is only requested separately when you opt in for a Trip Watch. Checks can be delayed and are not guaranteed.',
        [
          { text: 'Not now', style: 'cancel', onPress: () => { void AsyncStorage.setItem(INTRO_KEY, 'seen').catch(() => undefined); } },
          { text: 'Set up', onPress: () => {
            void AsyncStorage.setItem(INTRO_KEY, 'seen').catch(() => undefined);
            void setup();
          } },
        ],
        { cancelable: false },
      );
    }).catch(() => { /* Do not show a permission prompt if saved consent cannot be read. */ });
    return () => { cancelled = true; };
  }, [ready, settings.notifications, storageError, saveSettings]);
  return null;
}
