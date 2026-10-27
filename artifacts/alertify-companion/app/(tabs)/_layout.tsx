import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useColors } from '@/hooks/useColors';
import { fonts } from '@/constants/colors';

function NativeTabLayout() {
  return <NativeTabs>
    <NativeTabs.Trigger name="index"><NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} /><NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="trips"><NativeTabs.Trigger.Icon sf="arrow.up.right" /><NativeTabs.Trigger.Label>Trips</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="live-map"><NativeTabs.Trigger.Icon sf="map" /><NativeTabs.Trigger.Label>Live Map</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="updates"><NativeTabs.Trigger.Icon sf="bell" /><NativeTabs.Trigger.Label>Updates</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="settings"><NativeTabs.Trigger.Icon sf="slider.horizontal.3" /><NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label></NativeTabs.Trigger>
  </NativeTabs>;
}
function ClassicTabLayout() {
  const c = useColors();
  return <Tabs screenOptions={{
    headerShown: false, tabBarActiveTintColor: c.tabActive, tabBarInactiveTintColor: c.headerMuted,
    tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
    tabBarStyle: { position: 'absolute', backgroundColor: Platform.OS === 'ios' ? 'transparent' : c.header, borderTopWidth: 1, borderTopColor: c.headerBorder, elevation: 0, ...(Platform.OS === 'web' ? { height: 84 } : {}) },
    tabBarBackground: () => Platform.OS === 'ios' ? <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: c.header }]} />,
  }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ focused }) => <Feather name="shield" size={21} color={focused ? c.tabActive : c.headerMuted} /> }} />
    <Tabs.Screen name="trips" options={{ title: 'Trips', tabBarIcon: ({ focused }) => <Feather name="arrow-up-right" size={23} color={focused ? c.tabActive : c.headerMuted} /> }} />
    <Tabs.Screen name="live-map" options={{ title: 'Live Map', tabBarIcon: ({ focused }) => <Feather name="map" size={21} color={focused ? c.tabActive : c.headerMuted} /> }} />
    <Tabs.Screen name="updates" options={{ title: 'Updates', tabBarIcon: ({ focused }) => <Feather name="bell" size={21} color={focused ? c.tabActive : c.headerMuted} /> }} />
    <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ focused }) => <Feather name="sliders" size={21} color={focused ? c.tabActive : c.headerMuted} /> }} />
  </Tabs>;
}
export default function TabLayout() {
  return isLiquidGlassAvailable() ? <NativeTabLayout /> : <ClassicTabLayout />;
}
