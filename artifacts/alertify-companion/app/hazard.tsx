import React from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useCompanion } from '@/contexts/CompanionContext';
import { Button, Notice, Screen, openUrl, ui } from '@/components/BrandUI';

export default function HazardDetail() {
  const { source: sourceId, id } = useLocalSearchParams<{ source: string; id: string }>();
  const { feeds } = useCompanion();
  const source = feeds.data?.sources.find(s => s.id === sourceId);
  const report = source?.reports.find(r => r.id === id);
  return <Screen back><View style={ui.content}>
    <Text style={ui.label}>{source?.name ?? 'Hazard report'} · via Alertify</Text>
    {!report ? <><Text style={ui.title}>Report unavailable</Text><Text style={ui.text}>It may have been removed or the source could not be refreshed.</Text><Button title="Refresh reports" onPress={() => void feeds.refetch()} /></> : <>
      <Text style={ui.title}>{report.title}</Text><Text style={ui.h2}>{report.category}</Text><Text style={ui.text}>{report.location}</Text>
      {(source?.status !== 'live' || feeds.isError) && <Notice error>This source is {feeds.isError ? 'not refreshed' : source?.status}. Information below is not verified current.</Notice>}
      <View style={ui.card}><Text style={ui.text}>{report.description}</Text></View>
      <Text style={ui.small}>Source update: {report.updatedAt ? new Date(report.updatedAt).toLocaleString() : 'Not supplied'}{'\n'}Fetched via Alertify: {source?.fetchedAt ? new Date(source.fetchedAt).toLocaleString() : 'Unavailable'}</Text>
      {(report.latitude === null || report.longitude === null) && <Notice>This report has no point location in Alertify’s feed. Its affected area must be checked in the report; it has not been matched to your address.</Notice>}
      <Button title="Optional: open official source" icon="external-link" secondary onPress={() => void openUrl(report.sourceUrl)} />
      <Notice>Follow current official instructions. Call 000 in an emergency. Do not interact with your phone while driving.</Notice>
    </>}
  </View></Screen>;
}
