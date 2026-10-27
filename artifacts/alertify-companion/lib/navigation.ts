import { Linking, Platform } from 'react-native';
import { navigationUrl, type NavigationApp, type Place } from './model';

export async function openNavigation(app: NavigationApp, destination: Place, start?: Place) {
  if (Platform.OS !== 'web') {
    const native = app === 'Waze'
      ? `waze://?ll=${destination.latitude},${destination.longitude}&navigate=yes`
      : Platform.OS === 'ios'
        ? `comgooglemaps://?daddr=${destination.latitude},${destination.longitude}${start ? `&saddr=${start.latitude},${start.longitude}` : ''}&directionsmode=driving`
        : `google.navigation:q=${destination.latitude},${destination.longitude}&mode=d`;
    if (await Linking.canOpenURL(native)) {
      await Linking.openURL(native);
      return;
    }
  }
  await Linking.openURL(navigationUrl(app, destination, start));
}
