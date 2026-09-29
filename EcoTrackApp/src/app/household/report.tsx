import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { householdApi } from '@/lib/api';
import { safeBack } from '@/lib/navigation';

const REPORT_REASONS = ['Littering', 'Improper segregation', 'Other'];
type Recipient = 'admin' | 'collector';

export default function HouseholdReportScreen() {
  const router = useRouter();
  const [recipient, setRecipient] = useState<Recipient>('admin');
  const [collectorId, setCollectorId] = useState('');
  const [location, setLocation] = useState('');
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    if (!location.trim() || !details.trim()) {
      setError('Location and details are required.');
      return;
    }
    if (recipient === 'collector' && !collectorId.trim()) {
      setError('Collector ID is required when reporting to the garbage collector.');
      return;
    }
    setSending(true);
    try {
      await householdApi.sendNotification({
        title: `Report: ${reason} — ${location.trim()}`.slice(0, 120),
        message: `Location/neighbor: ${location.trim()}\n\n${details.trim()}`,
        recipientType: recipient,
        ...(recipient === 'collector' ? { collectorId: collectorId.trim() } : {}),
        level: `Report: ${reason}`,
      });
      setLocation('');
      setCollectorId('');
      setReason(REPORT_REASONS[0]);
      setDetails('');
      setSuccess('Report submitted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit report.');
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Report a Concern</Text>
        <Text style={styles.subtitle}>Flag littering or improper segregation in your area.</Text>

        <Text style={styles.label}>Send to</Text>
        <View style={styles.reasonRow}>
          {(
            [
              { value: 'admin', label: 'Admin' },
              { value: 'collector', label: 'Garbage Collector' },
            ] as { value: Recipient; label: string }[]
          ).map((option) => (
            <Pressable
              key={option.value}
              style={[styles.reasonOption, recipient === option.value && styles.reasonOptionActive]}
              onPress={() => setRecipient(option.value)}
            >
              <Text style={[styles.reasonText, recipient === option.value && styles.reasonTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {recipient === 'collector' ? (
          <>
            <Text style={styles.label}>Collector ID</Text>
            <TextInput
              style={styles.input}
              value={collectorId}
              onChangeText={setCollectorId}
              placeholder="e.g. GC-0003"
              placeholderTextColor="#999"
              autoCapitalize="characters"
            />
          </>
        ) : null}

        <Text style={styles.label}>Reported location / neighbor</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. house beside the chapel, Purok 3"
          placeholderTextColor="#999"
        />
        <Text style={styles.label}>Reason</Text>
        <View style={styles.reasonRow}>
          {REPORT_REASONS.map((item) => (
            <Pressable
              key={item}
              style={[styles.reasonOption, reason === item && styles.reasonOptionActive]}
              onPress={() => setReason(item)}
            >
              <Text style={[styles.reasonText, reason === item && styles.reasonTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Details</Text>
        <TextInput
          style={[styles.input, styles.messageInput]}
          value={details}
          onChangeText={setDetails}
          placeholder="Describe what happened..."
          placeholderTextColor="#999"
          multiline
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {success ? <Text style={styles.successText}>{success}</Text> : null}
        <Pressable style={styles.primaryButton} onPress={handleSubmit} disabled={sending}>
          <Text style={styles.primaryButtonText}>{sending ? 'Submitting...' : 'Submit Report'}</Text>
        </Pressable>

        <Pressable style={styles.backButton} onPress={() => safeBack(router, '/household')}>
          <Text style={styles.backText}>Back to Dashboard</Text>
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
    gap: Spacing.three,
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
    color: '#555',
    fontSize: 14,
    marginBottom: Spacing.two,
  },
  reasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonOption: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9D9D9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  reasonOptionActive: {
    borderColor: '#1F7A37',
    backgroundColor: '#E1F7DF',
  },
  reasonText: {
    color: '#555',
    fontWeight: '600',
    fontSize: 14,
  },
  reasonTextActive: {
    color: '#1F7A37',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A4A4A',
  },
  input: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9D9D9',
    backgroundColor: '#FFFFFF',
    fontSize: 15,
  },
  messageInput: {
    height: 96,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: '#1F7A37',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  errorText: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 14,
  },
  successText: {
    color: '#1F7A37',
    fontWeight: '600',
    fontSize: 14,
  },
  backButton: {
    marginTop: Spacing.four,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F7A37',
    paddingVertical: 14,
    alignItems: 'center',
  },
  backText: {
    color: '#1F7A37',
    fontWeight: '700',
  },
});
