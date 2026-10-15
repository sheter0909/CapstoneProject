import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { collectorApi, ApiError, SERVER_WAKING_MESSAGE, ReportReason, NotificationItem } from '@/lib/api';
import { safeBack } from '@/lib/navigation';

function friendlySendError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message; // server returned an error: show its message
  if (err instanceof Error && err.message === SERVER_WAKING_MESSAGE) return SERVER_WAKING_MESSAGE;
  return fallback;
}

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'no_garbage_out', label: 'No garbage out' },
  { value: 'dirty_surroundings', label: 'Dirty surroundings' },
  { value: 'other', label: 'Other' },
];

export default function CollectorContactScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ householdId?: string }>();
  const scannedId = Array.isArray(params.householdId) ? params.householdId[0] : params.householdId;
  const [showMessage, setShowMessage] = useState(false);
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [msgError, setMsgError] = useState('');
  const [msgSuccess, setMsgSuccess] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [reportHouseholdId, setReportHouseholdId] = useState(scannedId?.trim() ?? '');
  const [reportReason, setReportReason] = useState<ReportReason>('no_garbage_out');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState('');
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [myReports, setMyReports] = useState<NotificationItem[]>([]);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editReason, setEditReason] = useState<ReportReason>('no_garbage_out');
  const [editDetails, setEditDetails] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());

  const loadMyReports = async () => {
    try {
      const rows = await collectorApi.myReports();
      setMyReports(Array.isArray(rows) ? rows : []);
    } catch {
      // Non-blocking: the report form works without this list.
    }
  };

  useEffect(() => {
    let mounted = true;
    collectorApi
      .myReports()
      .then((rows) => {
        if (mounted) setMyReports(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  function timeLeftText(r: NotificationItem): string {
    if (!r.editableUntil) return '';
    const ms = new Date(r.editableUntil).getTime() - nowMs;
    if (ms <= 0) return 'Read-only';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${m}m left to edit` : `${m}m left to edit`;
  }

  const startEditReport = (r: NotificationItem) => {
    setEditError('');
    setEditingReportId(r.id);
    const reason = (['no_garbage_out', 'dirty_surroundings', 'other'] as const).includes(r.reportReason as ReportReason)
      ? (r.reportReason as ReportReason)
      : 'other';
    setEditReason(reason);
    setEditDetails(r.message.replace(/^Household ID: .*?\n\n/, ''));
  };

  const saveEditReport = async () => {
    if (!editingReportId || editSaving) return;
    if (!editDetails.trim()) {
      setEditError('Details are required.');
      return;
    }
    setEditError('');
    setEditSaving(true);
    try {
      const reasonLabel = REPORT_REASONS.find((x) => x.value === editReason)?.label ?? editReason;
      await collectorApi.updateReport(editingReportId, {
        message: editDetails.trim(),
        reportReason: editReason,
        title: `Report: ${reasonLabel} — ${myReports.find((x) => x.id === editingReportId)?.householdId ?? ''}`.slice(0, 120),
      });
      setEditingReportId(null);
      await loadMyReports();
    } catch (err) {
      setEditError(friendlySendError(err, 'Unable to save changes. Please try again.'));
    } finally {
      setEditSaving(false);
    }
  };

  const confirmWithdraw = async () => {
    if (!withdrawId) return;
    setEditError('');
    try {
      await collectorApi.dismissReport(withdrawId);
      setWithdrawId(null);
      await loadMyReports();
    } catch (err) {
      setWithdrawId(null);
      setReportError(friendlySendError(err, 'Unable to withdraw the report. Please try again.'));
    }
  };

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
        title: msgTitle.trim().slice(0, 120),
        message: msgBody.trim().slice(0, 2000),
        recipientType: 'admin',
        level: 'Collector Concern',
      });
      setMsgTitle('');
      setMsgBody('');
      setMsgSuccess('Message sent to admin.');
    } catch (err) {
      setMsgError(friendlySendError(err, 'Unable to send message. Please check your connection and try again.'));
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
    // Confirm step before saving: review the household, reason and details.
    setShowReportConfirm(true);
  };

  const handleConfirmReport = async () => {
    setReportError('');
    setReportSuccess('');
    setReportSending(true);
    try {
      const reasonLabel = REPORT_REASONS.find((r) => r.value === reportReason)?.label ?? reportReason;
      await collectorApi.sendNotification({
        title: `Report: ${reasonLabel} — ${reportHouseholdId.trim()}`.slice(0, 120),
        message: `Household ID: ${reportHouseholdId.trim()}\n\n${reportDetails.trim()}`,
        recipientType: 'household',
        householdId: reportHouseholdId.trim(),
        level: `Report: ${reasonLabel}`,
        reportReason,
      });
      setReportHouseholdId('');
      setReportReason('no_garbage_out');
      setReportDetails('');
      setShowReportConfirm(false);
      setReportSuccess('Report submitted. The barangay admin will review this.');
      await loadMyReports();
    } catch (err) {
      setShowReportConfirm(false);
      setReportError(friendlySendError(err, 'Unable to submit report. Please check your connection and try again.'));
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
            <Pressable style={[styles.primaryButton, msgSending && styles.primaryButtonDisabled]} onPress={handleMessageAdmin} disabled={msgSending}>
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
                  key={reason.value}
                  style={[styles.reasonOption, reportReason === reason.value && styles.reasonOptionActive]}
                  onPress={() => setReportReason(reason.value)}
                >
                  <Text style={[styles.reasonText, reportReason === reason.value && styles.reasonTextActive]}>{reason.label}</Text>
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
            <Pressable style={[styles.primaryButton, reportSending && styles.primaryButtonDisabled]} onPress={handleReport} disabled={reportSending}>
              <Text style={styles.primaryButtonText}>{reportSending ? 'Submitting...' : 'Review Report'}</Text>
            </Pressable>
            {showReportConfirm ? (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmTitle}>Confirm this report?</Text>
                <Text style={styles.confirmText}>Household: {reportHouseholdId.trim()}</Text>
                <Text style={styles.confirmText}>
                  Reason: {REPORT_REASONS.find((r) => r.value === reportReason)?.label ?? reportReason}
                </Text>
                <Text style={styles.confirmText}>Details: {reportDetails.trim()}</Text>
                <View style={styles.confirmRow}>
                  <Pressable
                    style={[styles.primaryButton, styles.confirmButton, reportSending && styles.primaryButtonDisabled]}
                    onPress={handleConfirmReport}
                    disabled={reportSending}
                  >
                    <Text style={styles.primaryButtonText}>{reportSending ? 'Submitting...' : 'Confirm Submit'}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.backButton, styles.confirmButton]}
                    onPress={() => setShowReportConfirm(false)}
                    disabled={reportSending}
                  >
                    <Text style={styles.backText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        <Pressable style={styles.backButton} onPress={() => safeBack(router, '/garbagecollector')}>
          <Text style={styles.backText}>Back to Dashboard</Text>
        </Pressable>

        <View style={styles.reportsBox}>
          <Text style={styles.label}>My recent reports</Text>
          {myReports.length === 0 ? (
            <Text style={styles.mutedText}>No reports filed in the last 24 hours.</Text>
          ) : (
            myReports.map((r) => (
              <View key={r.id} style={styles.reportCard}>
                <Text style={styles.reportCardTitle}>
                  {REPORT_REASONS.find((x) => x.value === r.reportReason)?.label ?? r.reportReason ?? 'Report'} · {r.householdId ?? ''}
                </Text>
                <Text style={styles.mutedText}>
                  {new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {timeLeftText(r)}
                </Text>
                {editingReportId === r.id ? (
                  <View style={styles.editBox}>
                    <Text style={styles.label}>Reason</Text>
                    <View style={styles.reasonRow}>
                      {REPORT_REASONS.map((option) => (
                        <Pressable
                          key={option.value}
                          style={[styles.reasonOption, editReason === option.value && styles.reasonOptionActive]}
                          onPress={() => setEditReason(option.value)}
                        >
                          <Text style={[styles.reasonText, editReason === option.value && styles.reasonTextActive]}>{option.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.label}>Details</Text>
                    <TextInput
                      style={[styles.input, styles.messageInput]}
                      value={editDetails}
                      onChangeText={setEditDetails}
                      placeholder="Describe what happened..."
                      placeholderTextColor="#999"
                      multiline
                    />
                    {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
                    <View style={styles.confirmRow}>
                      <Pressable
                        style={[styles.primaryButton, styles.confirmButton, editSaving && styles.primaryButtonDisabled]}
                        onPress={saveEditReport}
                        disabled={editSaving}
                      >
                        <Text style={styles.primaryButtonText}>{editSaving ? 'Saving...' : 'Save'}</Text>
                      </Pressable>
                      <Pressable style={[styles.backButton, styles.confirmButton]} onPress={() => setEditingReportId(null)} disabled={editSaving}>
                        <Text style={styles.backText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : withdrawId === r.id ? (
                  <View style={styles.confirmBox}>
                    <Text style={styles.confirmTitle}>Withdraw this report?</Text>
                    <Text style={styles.confirmText}>The household will no longer see it, and it will not count as a violation.</Text>
                    <View style={styles.confirmRow}>
                      <Pressable style={[styles.primaryButton, styles.confirmButton]} onPress={confirmWithdraw}>
                        <Text style={styles.primaryButtonText}>Confirm Withdraw</Text>
                      </Pressable>
                      <Pressable style={[styles.backButton, styles.confirmButton]} onPress={() => setWithdrawId(null)}>
                        <Text style={styles.backText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : r.editable ? (
                  <View style={styles.confirmRow}>
                    <Pressable style={[styles.smallButton, styles.confirmButton]} onPress={() => startEditReport(r)}>
                      <Text style={styles.smallButtonText}>Edit</Text>
                    </Pressable>
                    <Pressable style={[styles.smallButton, styles.confirmButton]} onPress={() => setWithdrawId(r.id)}>
                      <Text style={styles.smallButtonText}>Withdraw</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.mutedText}>Read-only</Text>
                )}
              </View>
            ))
          )}
        </View>
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
    boxShadow: '0px 8px 12px rgba(0,0,0,0.05)',
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
  confirmBox: {
    gap: 6,
    backgroundColor: '#FFF8E6',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8C547',
    padding: Spacing.three,
    marginTop: 4,
  },
  confirmTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4A4A4A',
  },
  confirmText: {
    fontSize: 14,
    color: '#4A4A4A',
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  confirmButton: {
    flex: 1,
    marginTop: 0,
  },
  reportsBox: {
    gap: 8,
    backgroundColor: '#F6F9F6',
    borderRadius: 18,
    padding: Spacing.three,
  },
  reportCard: {
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9D9D9',
    padding: 12,
  },
  reportCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F7A37',
  },
  mutedText: {
    fontSize: 13,
    color: '#6B7280',
  },
  editBox: {
    gap: 8,
    marginTop: 4,
  },
  smallButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F7A37',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  smallButtonText: {
    color: '#1F7A37',
    fontWeight: '700',
    fontSize: 14,
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
  primaryButtonDisabled: {
    opacity: 0.6,
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
