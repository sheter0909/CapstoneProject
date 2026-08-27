import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';

export default function SubmissionConfirmationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ entryId: string; householdId: string; segregated: string; wasteType: string; weight: string; edited?: string }>();
  const editAllowed = Boolean(params.entryId);

  const editEntry = () => router.push({ pathname: '/garbagecollector/garbage-input' as any, params });

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{params.edited === 'true' ? 'Entry updated' : 'Entry submitted'}</Text>
        <Text style={styles.title}>{params.segregated === 'segregated' ? 'Segregated' : 'Not segregated'} · {params.wasteType} · {params.weight} kg</Text>
        <Text style={styles.subtitle}>Household {params.householdId}</Text>
        {editAllowed && <Pressable style={styles.primaryButton} onPress={editEntry}><Text style={styles.primaryText}>Edit Entry</Text></Pressable>}
        <Pressable style={styles.secondaryButton} onPress={() => router.replace('/garbagecollector/quick-scan' as any)}><Text style={styles.secondaryText}>Done / Back to Scan</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, justifyContent: 'center', backgroundColor: '#F2F8F2' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: Spacing.four, gap: Spacing.three, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  eyebrow: { color: '#1F7A37', fontWeight: '800', textTransform: 'uppercase' },
  title: { color: '#1F7A37', fontSize: 20, fontWeight: '800', lineHeight: 28 },
  subtitle: { color: '#4A4A4A' },
  primaryButton: { backgroundColor: '#1F7A37', borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '800' },
  secondaryButton: { backgroundColor: '#E8F7E9', borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  secondaryText: { color: '#1F7A37', fontWeight: '800' },
});
