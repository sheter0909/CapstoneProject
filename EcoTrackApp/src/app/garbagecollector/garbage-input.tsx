import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { collectorApi } from '@/lib/api';
import { safeBack } from '@/lib/navigation';

const wasteTypes = ['Biodegradable', 'Recyclable', 'Non-biodegradable'];

export default function GarbageCollectorGarbageInputScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ entryId?: string; householdId?: string; segregated?: string; wasteType?: string; weight?: string }>();
  const editing = Boolean(params.entryId);
  const [segregated, setSegregated] = useState<'segregated' | 'not-segregated' | null>(params.segregated === 'not-segregated' ? 'not-segregated' : params.segregated === 'segregated' ? 'segregated' : null);
  const [wasteType, setWasteType] = useState(params.wasteType ?? 'Biodegradable');
  const [weight, setWeight] = useState(params.weight ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError('');
    if (!segregated) return setError('Choose Segregated or Not Segregated.');
    if (segregated === 'segregated' && !wasteType) return setError('Choose a waste type.');
    const numericWeight = Number(weight);
    if (!weight || !Number.isFinite(numericWeight) || numericWeight < 0 || numericWeight > 15) return setError('Weight must be between 0 and 15 kg.');
    setSaving(true);
    try {
      const body = { householdId: String(params.householdId ?? '0123'), segregationStatus: segregated === 'segregated' ? 'segregated' : 'not_segregated', wasteType: wasteType.toLowerCase().replace('-', '_').replace('non_biodegradable', 'non_biodegradable'), weightKg: numericWeight };
      const entry: any = editing ? await collectorApi.updateCollection(String(params.entryId), body) : await collectorApi.submitCollection(body);
      router.replace({ pathname: '/garbagecollector/submission-confirmation' as any, params: { entryId: entry.id, householdId: body.householdId, segregated, wasteType, weight: String(numericWeight), edited: editing ? 'true' : 'false' } });
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to save this entry.'); } finally { setSaving(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.title}>{editing ? 'Edit Entry' : 'Garbage Input'}</Text>
        <Text style={styles.subtitle}>Record the collection details for this household.</Text>

        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.statusButton, segregated === 'segregated' && styles.statusButtonActive]}
            onPress={() => setSegregated('segregated')}
          >
            <Text style={[styles.statusButtonText, segregated === 'segregated' && styles.statusButtonTextActive]}>Segregated</Text>
          </Pressable>
          <Pressable
            style={[styles.statusButton, segregated === 'not-segregated' && styles.statusButtonActiveRed]}
            onPress={() => setSegregated('not-segregated')}
          >
            <Text style={[styles.statusButtonText, segregated === 'not-segregated' && styles.statusButtonTextRed]}>Not Segregated</Text>
          </Pressable>
        </View>

        {segregated === 'segregated' && (
          <View style={styles.inputCard}>
            <Text style={styles.fieldLabel}>Waste Type</Text>
            <View style={styles.selectBox}>
              {wasteTypes.map((type) => (
                <Pressable key={type} onPress={() => setWasteType(type)} style={[styles.selectOption, wasteType === type && styles.selectOptionActive]}>
                  <Text style={[styles.selectLabel, wasteType === type && styles.selectLabelActive]}>{type}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Weight</Text>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              placeholder="Enter kg (max 15)"
              placeholderTextColor="#999"
              keyboardType="numeric"
              style={styles.input}
            />
          </View>
        )}

        <Pressable
          style={[styles.primaryButton, !segregated && styles.primaryButtonDisabled]}
          onPress={submit}
          disabled={saving}
        >
          <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : editing ? 'Update Entry' : 'Submit Entry'}</Text>
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable style={styles.linkButton} onPress={() => safeBack(router, '/garbagecollector/home')}>
          <Text style={styles.linkText}>{editing ? 'Cancel' : 'Back to results'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: Spacing.four,
    gap: Spacing.four,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F7A37',
  },
  subtitle: {
    color: '#4A4A4A',
    lineHeight: 22,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  statusButton: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 16,
    backgroundColor: '#F2F8F2',
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: '#D6F3D1',
  },
  statusButtonActiveRed: {
    backgroundColor: '#F9E2E2',
  },
  statusButtonText: {
    color: '#4A4A4A',
    fontWeight: '700',
  },
  statusButtonTextActive: {
    color: '#1F7A37',
  },
  statusButtonTextRed: {
    color: '#A12727',
  },
  inputCard: {
    gap: Spacing.three,
  },
  fieldLabel: {
    fontWeight: '700',
    color: '#4A4A4A',
  },
  selectBox: {
    backgroundColor: '#F7F7F7',
    borderRadius: 18,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  selectOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    marginBottom: Spacing.one,
  },
  selectOptionActive: {
    backgroundColor: '#E8F7E9',
  },
  selectLabel: {
    color: '#4A4A4A',
    fontWeight: '600',
  },
  selectLabelActive: {
    color: '#1F7A37',
  },
  input: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F7F7F7',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  primaryButton: {
    marginTop: Spacing.two,
    backgroundColor: '#1F7A37',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#9CC7A0',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  errorText: {
    color: '#A12727',
    fontWeight: '700',
    textAlign: 'center',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  linkText: {
    color: '#1F7A37',
    fontWeight: '700',
  },
});