import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAuthToken, removeAuthToken, saveAuthToken } from '@/components/auth-storage';
import {
  createLoan,
  createOtp,
  fetchLoans,
  fetchSummary,
  repayLoan,
  verifyOtp,
  type Loan,
  type LoanSummary,
} from '@/components/ledger-api';

const colors = {
  background: '#F5F6F0',
  surface: '#FFFFFF',
  ink: '#18352D',
  muted: '#75827B',
  line: '#E7EAE3',
  green: '#1B6B4B',
  paleGreen: '#E9F3EC',
  red: '#B84037',
  paleRed: '#FCECE9',
  yellow: '#F3C86A',
};

type LoginStep = 'phone' | 'otp';

function formatMoney(value: string | number) {
  const amount = Number(value);
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getToday() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isOverdue(loan: Loan) {
  return loan.status === 'pending' && loan.due_date.slice(0, 10) < getToday();
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export default function HomeScreen() {
  const [step, setStep] = useState<LoginStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [developmentOtp, setDevelopmentOtp] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [summary, setSummary] = useState<LoanSummary>({
    total_lent: 0,
    total_repaid: 0,
    overdue_amount: 0,
  });
  const [entries, setEntries] = useState<Loan[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [friendName, setFriendName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [processingLoanId, setProcessingLoanId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadLedger = useCallback(async (authToken: string) => {
    const [summaryResult, entriesResult] = await Promise.allSettled([
      fetchSummary(authToken),
      fetchLoans(authToken),
    ]);

    if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);
    if (entriesResult.status === 'fulfilled') setEntries(entriesResult.value);

    const loadError = [summaryResult, entriesResult].find(
      (result) => result.status === 'rejected',
    );
    if (loadError?.status === 'rejected') setError(messageFrom(loadError.reason));
  }, []);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      try {
        const savedToken = await getAuthToken();
        if (savedToken && active) {
          setToken(savedToken);
          await loadLedger(savedToken);
        }
      } catch (restoreError) {
        if (active) setError(messageFrom(restoreError));
      } finally {
        if (active) setIsRestoringSession(false);
      }
    };

    void restoreSession();
    return () => {
      active = false;
    };
  }, [loadLedger]);

  const loadSummary = useCallback(async (authToken: string) => {
    const result = await fetchSummary(authToken);
    setSummary(result);
  }, []);

  const refreshSummary = async () => {
    if (!token) return;
    setRefreshing(true);
    setError('');
    try {
      await loadLedger(token);
    } catch (refreshError) {
      setError(messageFrom(refreshError));
    } finally {
      setRefreshing(false);
    }
  };

  const requestOtp = async () => {
    const numericPhone = Number(phone);
    if (!/^\d{8,15}$/.test(phone) || !Number.isSafeInteger(numericPhone)) {
      setError('Enter a valid phone number with 8 to 15 digits.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const response = await createOtp(numericPhone);
      setDevelopmentOtp(response.development_otp ?? '');
      setOtp('');
      setStep('otp');
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setBusy(false);
    }
  };

  const signIn = async () => {
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter the 6-digit code sent to your phone.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const result = await verifyOtp(Number(phone), otp.trim());
      await saveAuthToken(result.token);
      setToken(result.token);
      await loadLedger(result.token);
    } catch (signInError) {
      setError(messageFrom(signInError));
    } finally {
      setBusy(false);
    }
  };

  const saveEntry = async () => {
    if (!token) return;
    const parsedAmount = Number(amount);
    const validDate =
      /^\d{4}-\d{2}-\d{2}$/.test(dueDate) &&
      !Number.isNaN(new Date(`${dueDate}T00:00:00`).getTime()) &&
      new Date(`${dueDate}T00:00:00`).toISOString().slice(0, 10) === dueDate;

    if (!friendName.trim()) {
      setError('Add the person’s name.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!validDate) {
      setError('Enter a valid due date in YYYY-MM-DD format.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const loan = await createLoan(token, {
        friend_name: friendName.trim(),
        amount: parsedAmount,
        due_date: dueDate,
      });
      setEntries((current) => [loan, ...current]);
      setShowForm(false);
      setFriendName('');
      setAmount('');
      setDueDate('');
      try {
        await loadSummary(token);
      } catch (summaryError) {
        setError(`Entry saved, but the summary could not be refreshed: ${messageFrom(summaryError)}`);
      }
    } catch (saveError) {
      setError(messageFrom(saveError));
    } finally {
      setBusy(false);
    }
  };

  const markRepaid = async (loan: Loan) => {
    if (!token) return;
    setBusy(true);
    setProcessingLoanId(loan.id);
    setError('');
    try {
      const updatedLoan = await repayLoan(token, loan.id);
      setEntries((current) =>
        current.map((entry) => (entry.id === updatedLoan.id ? updatedLoan : entry)),
      );
      try {
        await loadSummary(token);
      } catch (summaryError) {
        setError(`Entry updated, but the summary could not be refreshed: ${messageFrom(summaryError)}`);
      }
    } catch (repayError) {
      setError(messageFrom(repayError));
    } finally {
      setBusy(false);
      setProcessingLoanId(null);
    }
  };

  const signOut = async () => {
    setIsSigningOut(true);
    setError('');
    try {
      await removeAuthToken();
      setToken(null);
      setStep('phone');
      setPhone('');
      setOtp('');
      setEntries([]);
      setSummary({ total_lent: 0, total_repaid: 0, overdue_amount: 0 });
    } catch (signOutError) {
      setError(messageFrom(signOutError));
    } finally {
      setIsSigningOut(false);
    }
  };

  if (isRestoringSession) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color={colors.green} size="large" />
          <Text style={styles.loadingText}>Restoring your ledger…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.loginScreen}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.loginContent}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>M</Text>
            </View>
            <Text style={styles.brandName}>MiniLedger</Text>
            <Text style={styles.loginTitle}>
              {step === 'phone' ? 'Keep money matters simple.' : 'Check your messages.'}
            </Text>
            <Text style={styles.loginDescription}>
              {step === 'phone'
                ? 'A little clarity goes a long way. Sign in with your phone number to keep track of what’s owed.'
                : `Enter the 6-digit code sent to +${phone}.`}
            </Text>

            <View style={styles.loginForm}>
              {step === 'phone' ? (
                <View style={styles.inputWrap}>
                  <Text style={styles.inputPrefix}>+</Text>
                  <TextInput
                    accessibilityLabel="Phone number"
                    autoComplete="tel"
                    keyboardType="phone-pad"
                    maxLength={15}
                    onChangeText={(value) => setPhone(value.replace(/\D/g, ''))}
                    placeholder="Phone number"
                    placeholderTextColor={colors.muted}
                    style={styles.loginInput}
                    value={phone}
                  />
                </View>
              ) : (
                <View>
                  <TextInput
                    accessibilityLabel="One-time password"
                    autoComplete="one-time-code"
                    keyboardType="number-pad"
                    maxLength={6}
                    onChangeText={(value) => setOtp(value.replace(/\D/g, ''))}
                    placeholder="6-digit code"
                    placeholderTextColor={colors.muted}
                    style={[styles.textInput, styles.otpInput]}
                    value={otp}
                  />
                  {developmentOtp ? (
                    <Text style={styles.developmentOtpHint}>
                      Development code: {developmentOtp}
                    </Text>
                  ) : null}
                </View>
              )}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={step === 'phone' ? requestOtp : signIn}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && !busy && styles.pressed,
                  busy && styles.disabledButton,
                ]}>
                {busy ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {step === 'phone' ? 'Send verification code' : 'Verify and continue'}
                  </Text>
                )}
              </Pressable>

              {step === 'otp' ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => {
                    setStep('phone');
                    setOtp('');
                    setDevelopmentOtp('');
                    setError('');
                  }}
                  style={styles.backButton}>
                  <Text style={styles.backButtonText}>Change phone number</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <Text style={styles.loginFooter}>Your personal ledger, in your pocket.</Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const outstanding = Math.max(
    Number(summary.total_lent) - Number(summary.total_repaid),
    0,
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.dashboardContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshSummary} tintColor={colors.green} />
        }
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerBrand}>
            <View style={styles.smallBrandMark}>
              <Text style={styles.smallBrandMarkText}>M</Text>
            </View>
            <Text style={styles.headerTitle}>MiniLedger</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={isSigningOut}
            onPress={signOut}
            style={styles.signOutButton}>
            {isSigningOut ? (
              <ActivityIndicator color={colors.green} size="small" />
            ) : (
              <Text style={styles.signOutText}>Sign out</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.eyebrow}>YOUR LEDGER</Text>
        <Text style={styles.greeting}>A clearer picture, every day.</Text>
        <Text style={styles.sectionSubheading}>Here’s how things stand.</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryCardTop}>
            <Text style={styles.summaryLabel}>STILL TO COME BACK</Text>
            <View style={styles.summaryDot} />
          </View>
          <Text style={styles.outstandingAmount}>{formatMoney(outstanding)}</Text>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryFoot}>
            <Text style={styles.summaryFootLabel}>Overdue</Text>
            <Text style={styles.summaryFootAmount}>{formatMoney(summary.overdue_amount)}</Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TOTAL LENT</Text>
            <Text style={styles.statAmount}>{formatMoney(summary.total_lent)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>PAID BACK</Text>
            <Text style={styles.statAmount}>{formatMoney(summary.total_repaid)}</Text>
          </View>
        </View>

        <View style={styles.entriesHeading}>
          <View>
            <Text style={styles.sectionTitle}>Your entries</Text>
            <Text style={styles.sectionSubheading}>A little record of what’s owed.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setError('');
              setShowForm(true);
            }}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
            <Text style={styles.addButtonText}>+ Add entry</Text>
          </Pressable>
        </View>

        {error ? (
          <View accessibilityRole="alert" style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        {entries.length ? (
          <View style={styles.entryList}>
            {entries.map((entry) => {
              const overdue = isOverdue(entry);
              return (
                <View
                  key={entry.id}
                  style={[styles.entryCard, overdue && styles.overdueEntryCard]}>
                  <View style={styles.entryTop}>
                    <View style={styles.entryAvatar}>
                      <Text style={styles.entryAvatarText}>
                        {entry.friend_name.trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.entryDetails}>
                      <Text style={styles.entryName}>{entry.friend_name}</Text>
                      <Text style={[styles.entryDue, overdue && styles.overdueText]}>
                        {entry.status === 'repaid'
                          ? 'Paid back'
                          : overdue
                            ? `Overdue · ${formatDate(entry.due_date)}`
                            : `Due ${formatDate(entry.due_date)}`}
                      </Text>
                    </View>
                    <Text style={[styles.entryAmount, overdue && styles.overdueText]}>
                      {formatMoney(entry.amount)}
                    </Text>
                  </View>
                  {entry.status === 'pending' ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => markRepaid(entry)}
                      style={styles.repaidButton}>
                      {processingLoanId === entry.id ? (
                        <ActivityIndicator color={colors.green} size="small" />
                      ) : (
                        <Text style={styles.repaidButtonText}>Mark as paid back</Text>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyMark}>
              <Text style={styles.emptyMarkText}>+</Text>
            </View>
            <Text style={styles.emptyTitle}>Your ledger starts here</Text>
            <Text style={styles.emptyDescription}>
              Add the first entry when you lend someone money. Entries you add will appear here.
            </Text>
          </View>
        )}

      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setShowForm(false)}
        transparent
        visible={showForm}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}>
          <Pressable
            accessibilityLabel="Close add entry form"
            onPress={() => setShowForm(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.formSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeading}>
              <View>
                <Text style={styles.sheetTitle}>Add an entry</Text>
                <Text style={styles.sheetSubtitle}>Keep it simple, keep it clear.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowForm(false)}
                style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>PERSON</Text>
            <TextInput
              autoCapitalize="words"
              maxLength={100}
              onChangeText={setFriendName}
              placeholder="Who did you lend to?"
              placeholderTextColor={colors.muted}
              style={styles.textInput}
              value={friendName}
            />

            <Text style={styles.fieldLabel}>AMOUNT</Text>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={(value) => setAmount(value.replace(/[^\d.]/g, ''))}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              style={styles.textInput}
              value={amount}
            />

            <Text style={styles.fieldLabel}>DUE DATE</Text>
            <TextInput
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              style={styles.textInput}
              value={dueDate}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={saveEntry}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && !busy && styles.pressed,
                busy && styles.disabledButton,
                styles.saveButton,
              ]}>
              {busy ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.primaryButtonText}>Save entry</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 14,
  },
  loginScreen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  loginContent: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
  },
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  brandMarkText: {
    color: colors.surface,
    fontSize: 28,
    fontWeight: '700',
  },
  brandName: {
    color: colors.green,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 36,
  },
  loginTitle: {
    color: colors.ink,
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '700',
    letterSpacing: -0.8,
    maxWidth: 340,
  },
  loginDescription: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
    maxWidth: 350,
  },
  loginForm: {
    marginTop: 30,
  },
  inputWrap: {
    minHeight: 58,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 17,
  },
  inputPrefix: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '600',
    marginRight: 10,
  },
  loginInput: {
    flex: 1,
    paddingVertical: 15,
    color: colors.ink,
    fontSize: 16,
  },
  textInput: {
    minHeight: 54,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 13,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    color: colors.ink,
    fontSize: 16,
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 22,
    letterSpacing: 8,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  disabledButton: {
    opacity: 0.65,
  },
  pressed: {
    opacity: 0.82,
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 17,
  },
  backButtonText: {
    color: colors.green,
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: colors.red,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  developmentOtpHint: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
  },
  loginFooter: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    color: colors.muted,
    fontSize: 12,
  },
  dashboardContent: {
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingBottom: 38,
  },
  header: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 31,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  smallBrandMark: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.green,
  },
  smallBrandMarkText: {
    color: colors.surface,
    fontSize: 18,
    fontWeight: '700',
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  signOutButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  signOutText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  eyebrow: {
    color: colors.green,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.7,
  },
  greeting: {
    color: colors.ink,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 7,
  },
  sectionSubheading: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: colors.green,
    borderRadius: 21,
    padding: 22,
    marginTop: 21,
  },
  summaryCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: '#D0E3D7',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.3,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.yellow,
  },
  outstandingAmount: {
    color: colors.surface,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.7,
    marginTop: 14,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 19,
    marginBottom: 14,
  },
  summaryFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryFootLabel: {
    color: '#D0E3D7',
    fontSize: 13,
  },
  summaryFootAmount: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    minHeight: 87,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statAmount: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 11,
  },
  entriesHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 31,
    marginBottom: 15,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: colors.green,
    borderRadius: 12,
    minHeight: 40,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '700',
  },
  errorBanner: {
    borderColor: '#F1CFCA',
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: colors.paleRed,
    padding: 12,
    marginBottom: 12,
  },
  errorBannerText: {
    color: colors.red,
    fontSize: 13,
    lineHeight: 19,
  },
  entryList: {
    gap: 10,
  },
  entryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  overdueEntryCard: {
    backgroundColor: '#FFF8F6',
    borderColor: '#E9BDB7',
  },
  entryTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryAvatar: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: colors.paleGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryAvatarText: {
    color: colors.green,
    fontSize: 17,
    fontWeight: '700',
  },
  entryDetails: {
    flex: 1,
    marginLeft: 11,
  },
  entryName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  entryDue: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 5,
  },
  overdueText: {
    color: colors.red,
  },
  entryAmount: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  repaidButton: {
    alignSelf: 'flex-end',
    borderRadius: 9,
    backgroundColor: colors.paleGreen,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginTop: 12,
  },
  repaidButtonText: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 27,
  },
  emptyMark: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.paleGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMarkText: {
    color: colors.green,
    fontSize: 27,
    fontWeight: '400',
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 13,
  },
  emptyDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
  },
  listNote: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 10,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 30, 23, 0.4)',
  },
  formSheet: {
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 11,
    paddingHorizontal: 22,
    paddingBottom: 28,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    backgroundColor: '#D6DBD2',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 17,
  },
  sheetHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 19,
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '700',
  },
  sheetSubtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  closeButtonText: {
    color: colors.muted,
    fontSize: 25,
    lineHeight: 28,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 7,
    marginTop: 13,
  },
  saveButton: {
    marginTop: 22,
  },
});
