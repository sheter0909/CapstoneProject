import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { collectorApi } from '@/lib/api';
import { safeBack } from '@/lib/navigation';

const REPORT_REASONS = ['Uncollected trash', 'Contamination', 'Other'];

export default function CollectorContactScreen() {
  const router = useRouter();
  const [showMessage, setShowMessage] = useState(false);
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [msgError, setMsgError] = useState('');
  const [msgSuccess, setMsgSuccess] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [reportHouseholdId, setReportHouseholdId] = useState('');
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState('');

  const handleMessageAdmin = async () => {
    setMsgError('');
    setMsgSuccess('');
    if (!msgTitle.trim() || !msgBody.trim()) {
      setMsgError('Title and message are required.');
      return;
    }
    setMsgSending(true);
    try {
      await collectorApi.sendNotification({
        title: msgTitle.trim(),
        message: msgBody.trim(),
        recipientType: 'admin',
        level: 'Collector Concern',
      });
      setMsgTitle('');
      setMsgBody('');
      setMsgSuccess('Message sent to admin.');
    } catch (err) {
      setMsgError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setMsgSending(false);
    }
  };

  const handleReport = async () => {
    setReportError('');
    setReportSuccess('');
    if (!reportHouseholdId.trim() || !reportDetails.trim()) {
      setReportError('Household ID and details are required.');
      return;
    }
    setReportSending(true);
    try {
      await collectorApi.sendNotification({
        title: `Report: ${reportReason} — ${reportHouseholdId.trim()}`.slice(0, 120),
        message: `Household ID: ${reportHouseholdId.trim()}\n\n${reportDetails.trim()}`,
        recipientType: 'household',
        householdId: reportHouseholdId.trim(),
        level: `Report: ${reportReason}`,
      });
      setReportHouseholdId('');
      setReportReason(REPORT_REASONS[0]);
      setReportDetails('');
      setReportSuccess('Report submitted. The barangay admin will review this.');
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Unable to submit report.');
    } finally {
      setReportSending(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Flag & Contact</Text>
        <Text style={styles.subtitle}>Message the barangay admin or flag a household for review.</Text>

        <Pressable style={styles.composeToggle} onPress={() => setShowMessage((value) => !value)}>
          <Text style={styles.composeToggleText}>{showMessage ? 'Hide message form' : 'Message Admin'}</Text>
        </Pressable>

        {showMessage ? (
          <View style={styles.composeBox}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={msgTitle}
              onChangeText={setMsgTitle}
              placeholder="e.g. Blocked road in Purok 3"
              placeholderTextColor="#999"
            />
            <Text style={styles.label}>Message</Text>
            <TextInput
              style={[styles.input, styles.messageInput]}
              value={msgBody}
              onChangeText={setMsgBody}
              placeholder="Describe the issue..."
              placeholderTextColor="#999"
              multiline
            />
            {msgError ? <Text style={styles.errorText}>{msgError}</Text> : null}
            {msgSuccess ? <Text style={styles.successText}>{msgSuccess}</Text> : null}
            <Pressable style={styles.primaryButton} onPress={handleMessageAdmin} disabled={msgSending}>
              <Text style={styles.primaryButtonText}>{msgSending ? 'Sending...' : 'Send Message'}</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable style={styles.composeToggle} onPress={() => setShowReport((value) => !value)}>
          <Text style={styles.composeToggleText}>{showReport ? 'Hide report form' : 'Report a Household'}</Text>
        </Pressable>

        {showReport ? (
          <View style={styles.composeBox}>
            <Text style={styles.label}>Household ID</Text>
            <TextInput
              style={styles.input}
              value={reportHouseholdId}
              onChangeText={setReportHouseholdId}
              placeholder="e.g. 202319"
              placeholderTextColor="#999"
              autoCapitalize="none"
            />
            <Text style={styles.label}>Reason</Text>
            <View style={styles.reasonRow}>
              {REPORT_REASONS.map((reason) => (
                <Pressable
                  key={reason}
                  style={[styles.reasonOption, reportReason === reason && styles.reasonOptionActive]}
                  onPress={() => setReportReason(reason)}
                >
                  <Text style={[styles.reasonText, reportReason === reason && styles.reasonTextActive]}>{reason}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Details</Text>
            <TextInput
              style={[styles.input, styles.messageInput]}
              value={reportDetails}
              onChangeText={setReportDetails}
              placeholder="Describe what happened..."
              placeholderTextColor="#999"
              multiline
            />
            {reportError ? <Text style={styles.errorText}>{reportError}</Text> : null}
            {reportSuccess ? <Text style={styles.successText}>{reportSuccess}</Text> : null}
            <Pressable style={styles.primaryButton} onPress={handleReport} disabled={reportSending}>
              <Text style={styles.primaryButtonText}>{reportSending ? 'Submitting...' : 'Submit Report'}</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable style={styles.backButton} onPress={() => safeBack(router, '/garbagecollector')}>
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
  composeToggle: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F7A37',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#F3F9F4',
  },
  composeToggleText: {
    color: '#1F7A37',
    fontWeight: '700',
    fontSize: 14,
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
  composeBox: {
    gap: 8,
    backgroundColor: '#F6F9F6',
    borderRadius: 18,
    padding: Spacing.three,
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
