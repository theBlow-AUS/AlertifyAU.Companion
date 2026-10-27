import React, { type ReactNode } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { Path, Circle, Polyline } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import colors, { fonts } from '@/constants/colors';
import { levels, type Level, type Incident, type Place } from '@/lib/model';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

const c = colors.light;
export const ui = StyleSheet.create({
  body: { backgroundColor: c.background, flex: 1 },
  content: { padding: 20, gap: 20 },
  card: { backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 16, gap: 10 },
  title: { fontFamily: fonts.bold, color: c.foreground, fontSize: 24, letterSpacing: -0.7 },
  h2: { fontFamily: fonts.bold, color: c.foreground, fontSize: 15, letterSpacing: -0.2 },
  text: { fontFamily: fonts.regular, color: c.foreground, fontSize: 14, lineHeight: 21 },
  small: { fontFamily: fonts.regular, color: c.mutedForeground, fontSize: 12, lineHeight: 18 },
  label: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.3, color: c.mutedForeground, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  input: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 14, color: c.foreground, padding: 14, fontFamily: fonts.regular, fontSize: 15, minHeight: 50 },
});
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }
export function reportError(error: unknown) {
  if (Platform.OS === 'web') window.alert(errorMessage(error));
  else Alert.alert('Unable to complete', errorMessage(error));
}
export function confirmAction(title: string, message: string, action: string, onConfirm: () => void, destructive = false) {
  if (Platform.OS === 'web') { if (window.confirm(`${title}\n\n${message}`)) onConfirm(); }
  else Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: action, style: destructive ? 'destructive' : 'default', onPress: onConfirm }]);
}
export async function openUrl(url: string) {
  try { await Linking.openURL(url); } catch (error) { reportError(error); }
}
export function Mark() {
  return <Svg width={29} height={33} viewBox="0 0 40 44" accessibilityLabel="Alertify">
    <Path d="M20 2 38 35.5 20 42 2 35.5 20 2Z" fill={c.coral} />
    <Path d="M22.6 12.2c1.2 5.1-4.5 6.1-4.5 10.2 0 1.5.8 2.7 2.1 3.4-.4-2.2 1.2-3.6 3-4.7 3.1 3.3 3.7 5.2 2.6 7.6-1.1 2.4-3.5 3.6-6.1 3.6-4.3 0-7.2-3-7.2-7 0-3.7 2.3-6.8 5.4-9.9.4 2.6-.4 4-1.2 5.2 4.4-2.1 6.6-5.2 5.9-8.4Z" fill={c.flame} />
  </Svg>;
}
export function Header({ back = false }: { back?: boolean }) {
  const insets = useSafeAreaInsets();
  return <View style={{ backgroundColor: c.header, paddingTop: Platform.OS === 'web' ? 67 : insets.top, paddingHorizontal: 20 }}>
    <View style={[ui.spread, { height: 68 }]}>
      <View style={ui.row}>
        {back ? <Pressable accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} hitSlop={12}><Feather name="arrow-left" size={24} color={c.headerText} /></Pressable> : <Mark />}
        <View><Text style={{ color: c.headerText, fontFamily: fonts.extra, fontSize: 19, letterSpacing: -0.7 }}>alertify</Text><Text style={{ color: c.headerMuted, fontFamily: fonts.mono, fontSize: 8, letterSpacing: 1.4, marginTop: 3 }}>AWARENESS, NOT ALARM</Text></View>
      </View>
      <Pressable accessibilityLabel="Open alert preferences" onPress={() => router.push('/(tabs)/settings')} style={{ padding: 12, backgroundColor: c.headerButton, borderRadius: 28 }} testID="open-settings"><Feather name="sliders" size={18} color={c.headerMuted} /></Pressable>
    </View>
  </View>;
}
export function Screen({ children, back, refreshControl }: { children: ReactNode; back?: boolean; refreshControl?: React.ReactElement }) {
  const insets = useSafeAreaInsets();
  return <View style={ui.body}><Header back={back} /><KeyboardAwareScrollViewCompat bottomOffset={24} refreshControl={refreshControl} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 16) + 100 }} showsVerticalScrollIndicator={false}>{children}</KeyboardAwareScrollViewCompat></View>;
}
export function Button({ title, onPress, icon, secondary = false, busy = false, disabled = false, testID }: { title: string; onPress: () => void; icon?: keyof typeof Feather.glyphMap; secondary?: boolean; busy?: boolean; disabled?: boolean; testID?: string }) {
  const c = useColors();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy }} testID={testID} onPress={() => { if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined); onPress(); }} disabled={disabled || busy}
    style={({ pressed }) => ({ minHeight: 50, borderRadius: 15, paddingHorizontal: 16, backgroundColor: secondary ? c.secondary : c.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, opacity: disabled || busy ? 0.55 : pressed ? 0.78 : 1 })}>
    {busy ? <ActivityIndicator color={secondary ? c.foreground : c.primaryForeground} /> : icon ? <Feather name={icon} size={17} color={secondary ? c.secondaryForeground : c.primaryForeground} /> : null}
    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: secondary ? c.secondaryForeground : c.primaryForeground }}>{title}</Text>
  </Pressable>;
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <View style={{ backgroundColor: error ? c.warningSoft : c.secondary, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 9 }}>
    <Feather name={error ? 'alert-triangle' : 'info'} size={17} color={error ? c.warning : c.success} />
    <Text style={[ui.small, { color: error ? c.warning : c.secondaryForeground, flex: 1 }]}>{children}</Text>
  </View>;
}
export function Sensitivity({ value, onChange }: { value: Level; onChange: (next: Level) => void }) {
  return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: c.muted }}>
      {levels.map(level => <Pressable accessibilityRole="radio" accessibilityState={{ selected: value === level.value }} accessibilityLabel={level.label} key={level.value} onPress={() => onChange(level.value)} style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 10, backgroundColor: value === level.value ? c.card : c.muted }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: value === level.value ? c.accentForeground : c.mutedForeground, textAlign: 'center' }}>{level.label}</Text>
      </Pressable>)}
    </View>
    <Text style={ui.small}>{levels.find(level => level.value === value)?.detail}</Text>
  </View>;
}
export function IncidentRow({ incident, subtitle }: { incident: Incident; subtitle?: string }) {
  return <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/incident/[id]', params: { id: incident.id } })} style={({ pressed }) => ({ paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.65 : 1, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border })} testID={`incident-${incident.id}`}>
    <View style={{ backgroundColor: incident.severity >= 2 ? c.warningSoft : c.accent, padding: 10, borderRadius: 12 }}><Feather name={incident.severity >= 2 ? 'alert-triangle' : 'map-pin'} size={18} color={incident.severity >= 2 ? c.warning : c.success} /></View>
    <View style={{ flex: 1, gap: 4 }}><Text numberOfLines={2} style={[ui.h2, { fontSize: 13 }]}>{incident.title}</Text><Text style={ui.small}>{subtitle || `${incident.category} · ${incident.council || incident.type}`}</Text></View>
    <Feather name="chevron-right" size={16} color={c.mutedForeground} />
  </Pressable>;
}
export function Diagram({ coordinates, points = [], style }: { coordinates?: [number, number][]; points?: Pick<Place, 'latitude' | 'longitude'>[]; style?: StyleProp<ViewStyle> }) {
  const all = [...(coordinates ?? []), ...points.map(p => [p.longitude, p.latitude] as [number, number])];
  if (!all.length) return null;
  const minX = Math.min(...all.map(p => p[0])), maxX = Math.max(...all.map(p => p[0]));
  const minY = Math.min(...all.map(p => p[1])), maxY = Math.max(...all.map(p => p[1]));
  const project = (p: [number, number]) => [24 + (p[0] - minX) / (maxX - minX || 1) * 300, 145 - (p[1] - minY) / (maxY - minY || 1) * 120];
  return <View style={[{ height: 180, backgroundColor: c.map, overflow: 'hidden', borderRadius: 16 }, style]}>
    <Svg width="100%" height="100%" viewBox="0 0 348 180">
      {[0, 1, 2, 3, 4, 5, 6, 7].map(n => <Path key={n} d={`M${n * 50} 0 V180 M0 ${n * 30} H348`} stroke={c.border} strokeWidth={1} />)}
      {coordinates && <Polyline points={coordinates.map(p => project(p).join(',')).join(' ')} fill="none" stroke={c.primary} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />}
      {!coordinates && points.length === 2 && <Polyline points={points.map(p => project([p.longitude, p.latitude]).join(',')).join(' ')} stroke={c.warning} strokeDasharray="4,5" strokeWidth={2} />}
      {points.map((p, i) => { const pos = project([p.longitude, p.latitude]); return <Circle key={i} cx={pos[0]} cy={pos[1]} r={7} fill={i === 0 ? c.primary : c.coral} stroke={c.card} strokeWidth={3} />; })}
    </Svg>
    <Text style={[ui.small, { position: 'absolute', left: 12, top: 10, fontSize: 10, backgroundColor: c.card, padding: 5, borderRadius: 6 }]}>Location overview · not a navigation map</Text>
  </View>;
}
