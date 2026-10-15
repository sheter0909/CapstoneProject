import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { collectorApi, ApiError, SERVER_WAKING_MESSAGE, ReportReason, NotificationItem } from '@/lib/api';
import { safeBack } from '@/lib/navigation';

function friendlySendError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message; // server returned an error: show its message
  if (err instanceof Error && err.message === SERVER_WAKING_MESSAGE) return SERVER_WAKING_MESSAGE;
  return fallback;
}

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'no_garbage_out', label: 'Skip' },
  { value: 'dirty_surroundings', label: 'Dirty surroundings' },
  { value: 'other', label: 'Other' },
];

// Max length for the free-text "Other" reason the collector types in.
const OTHER_REASON_MAX = 100;

// Only "Skip" (no_garbage_out) and "Contamination" (dirty_surroundings)
// reports may issue a warning alongside the report; "Other" never does.
const WARNING_ELIGIBLE_REASONS: ReportReason[] = ['no_garbage_out', 'dirty_surroundings'];

// The "Other" text travels inside the existing Notification.message field so no
// schema/API field is added: `Household ID: ...\n\n<details>\n\nOther reason: ...`.
// startEditReport splits it back out for the edit form.
function appendOtherReason(message: string, reason: ReportReason, otherReason: string): string {
  const trimmed = otherReason.trim();
  const otherLine = reason === 'other' && trimmed ? `\n\nOther reason: ${trimmed.slice(0, OTHER_REASON_MAX)}` : '';
  return `${message}${otherLine}`.slice(0, 2000);
}

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
  const [reportOtherReason, setReportOtherReason] = useState('');
  // Warning toggle: default OFF; sends the household a First/Second/Final
  // warning (existing ladder) together with the report when ON.
  const [reportWarning, setReportWarning] = useState(false);
  const [reportSending, setReportSending] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState('');
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [myReports, setMyReports] = useState<NotificationItem[]>([]);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editReason, setEditReason] = useState<ReportReason>('no_garbage_out');
  const [editDetails, setEditDetails] = useState('');
  const [editOtherReason, setEditOtherReason] = useState('');
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
    const stripped = r.message.replace(/^Household ID: .*?\n\n/, '');
    // Split the appended "Other reason: ..." line back into its own field so
    // the edit form can show it under the same rules as the create form.
    const otherMatch = reason === 'other' ? /\n\nOther reason: ([\s\S]+)$/.exec(stripped) : null;
    setEditOtherReason(otherMatch ? otherMatch[1].trim() : '');
    setEditDetails(otherMatch ? stripped.slice(0, otherMatch.index) : stripped);
  };

  const saveEditReport = async () => {
    if (!editingReportId || editSaving) return;
    if (!editDetails.trim()) {
      setEditError('Details are required.');
      return;
    }
    if (editReason === 'other' && !editOtherReason.trim()) {
      setEditError('Specify what kind of "Other" reason this is.');
      return;
    }
    setEditError('');
    setEditSaving(true);
    try {
      const reasonLabel = REPORT_REASONS.find((x) => x.value === editReason)?.label ?? editReason;
      await collectorApi.updateReport(editingReportId, {
        message: appendOtherReason(editDetails.trim(), editReason, editOtherReason),
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

  // Effective toggle state: hidden + forced OFF whenever the reason is not
  // eligible ("Other"), so a stale ON can never leak into the request.
  const warningEnabled = reportWarning && WARNING_ELIGIBLE_REASONS.includes(reportReason);

  const handleReport = async () => {
    setReportError('');
    setReportSuccess('');
    if (!reportHouseholdId.trim() || !reportDetails.trim()) {
      setReportError('Household ID and details are required.');
      return;
    }
    if (reportReason === 'other' && !reportOtherReason.trim()) {
      setReportError('Specify what kind of "Other" reason this is.');
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
        message: appendOtherReason(
          `Household ID: ${reportHouseholdId.trim()}\n\n${reportDetails.trim()}`,
          reportReason,
          reportOtherReason,
        ),
        recipientType: 'household',
        householdId: reportHouseholdId.trim(),
        level: `Report: ${reasonLabel}`,
        reportReason,
        issueWarning: warningEnabled,
      });
      setReportHouseholdId('');
      setReportReason('no_garbage_out');
      setReportDetails('');
      setReportOtherReason('');
      setReportWarning(false);
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
                  onPress={() => {
                    setReportReason(reason.value);
                    // The warning toggle is hidden for "Other": clear it so it
                    // can't come back ON silently on a later reason switch.
                    if (!WARNING_ELIGIBLE_REASONS.includes(reason.value)) setReportWarning(false);
                  }}
                >
                  <Text style={[styles.reasonText, reportReason === reason.value && styles.reasonTextActive]}>{reason.label}</Text>
                </Pressable>
              ))}
            </View>
            {reportReason === 'other' ? (
              <>
                <Text style={styles.label}>Other Reason</Text>
                <TextInput
                  style={styles.input}
                  value={reportOtherReason}
                  onChangeText={setReportOtherReason}
                  placeholder="Specify other reason..."
                  placeholderTextColor="#999"
                  maxLength={OTHER_REASON_MAX}
                />
              </>
            ) : null}
            <Text style={styles.label}>Details</Text>
            <TextInput
              style={[styles.input, styles.messageInput]}
              value={reportDetails}
              onChangeText={setReportDetails}
              placeholder="Describe what happened..."
              placeholderTextColor="#999"
              multiline
            />
            {WARNING_ELIGIBLE_REASONS.includes(reportReason) ? (
              <View style={styles.warningRow}>
                <View style={styles.warningRowText}>
                  <Text style={styles.label}>Issue warning to household</Text>
                  <Text style={styles.mutedText}>
                    Gives the household a First/Second/Final warning together with this report.
                  </Text>
                </View>
                <Switch
                  value={reportWarning}
                  onValueChange={setReportWarning}
                  trackColor={{ false: '#D9D9D9', true: '#9CC7A0' }}
                  thumbColor={reportWarning ? '#1F7A37' : '#F4F4F4'}
                  ios_backgroundColor="#D9D9D9"
                />
              </View>
            ) : null}
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
                {reportReason === 'other' ? (
                  <Text style={styles.confirmText}>Other reason: {reportOtherReason.trim()}</Text>
                ) : null}
                <Text style={styles.confirmText}>Warning: {warningEnabled ? 'On (issued with report)' : 'Off'}</Text>
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
                    {editReason === 'other' ? (
                      <>
                        <Text style={styles.label}>Other Reason</Text>
                        <TextInput
                          style={styles.input}
                          value={editOtherReason}
                          onChangeText={setEditOtherReason}
                          placeholder="Specify other reason..."
                          placeholderTextColor="#999"
                          maxLength={OTHER_REASON_MAX}
                        />
                      </>
                    ) : null}
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
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F6F9F6',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    padding: 12,
  },
  warningRowText: {
    flex: 1,
    gap: 2,
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
