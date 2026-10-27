import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useCompanion } from '@/contexts/CompanionContext';
import { advisoryThresholdLimits, normalizeSettings, type AdvisoryThresholdKey } from '@/lib/model';
import { useColors } from '@/hooks/useColors';
import { Button, Notice, errorMessage, ui } from './BrandUI';

// The parent keys this editor by persisted values, so reloads and successful
// saves start with saved values without syncing props back into draft state.
export function AdvisoryThresholds() {
  const c = useColors();
  const { settings, saveSettings, ready, storageError } = useCompanion();
  const [draft, setDraft] = useState({
    windGustThresholdKph: String(settings.windGustThresholdKph),
    rainThresholdMmH: String(settings.rainThresholdMmH),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const changed = Object.entries(draft).some(([key, value]) => value !== String(settings[key as AdvisoryThresholdKey]));
  async function save() {
    setBusy(true); setError('');
    try {
      const patch = {
        windGustThresholdKph: Number(draft.windGustThresholdKph.trim()),
        rainThresholdMmH: Number(draft.rainThresholdMmH.trim()),
      };
      normalizeSettings({ ...settings, ...patch });
      await saveSettings(patch);
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <View style={ui.card} testID="advisory-thresholds">
    <Text style={ui.h2}>Wind & rain advisory thresholds</Text>
    <Text style={ui.small}>Used for enabled watch zones and active trips. These are advisory Xweather estimates, not official warning levels. They do not change BOM warnings, RFS sensitivity or your source and notification opt-ins.</Text>
    {(Object.keys(advisoryThresholdLimits) as AdvisoryThresholdKey[]).map(key => {
      const limit = advisoryThresholdLimits[key];
      return <View key={key} style={styles.field}>
        <Text style={ui.text}>{limit.label} · {limit.unit}</Text>
        <TextInput
          accessibilityLabel={`${limit.label} threshold in ${limit.unit}`}
          testID={`threshold-${key}`}
          keyboardType="number-pad"
          value={draft[key]}
          editable={ready && !busy && !storageError}
          onChangeText={value => { setDraft(current => ({ ...current, [key]: value })); setError(''); }}
          style={[ui.text, styles.input, { borderColor: c.border, backgroundColor: c.background, color: c.foreground }]}
        />
        <Text style={ui.small}>Whole number {limit.min}–{limit.max} {limit.unit} · default {limit.defaultValue}</Text>
      </View>;
    })}
    <Text style={ui.small}>Current saved thresholds: {settings.windGustThresholdKph} km/h gusts · {settings.rainThresholdMmH} mm/hour rainfall.</Text>
    <Text style={ui.small}>Saving a changed threshold establishes a fresh baseline on the next successful check. Conditions already present then are not replayed as alerts; later new threshold crossings can alert.</Text>
    {!!error && <Notice error>{error}</Notice>}
    <Button title="Save advisory thresholds" icon="check" onPress={() => void save()} busy={busy} disabled={!ready || !!storageError || !changed} testID="save-advisory-thresholds" />
  </View>;
}
const styles = StyleSheet.create({
  field: { gap: 6 },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10 },
});
