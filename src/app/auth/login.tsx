import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { CricketHaptics } from '../../services/haptics';
import { AuthService, DEV_TEST_ACCOUNTS } from '../../services/authService';

interface CountryCode {
  code: string;
  name: string;
  flag: string;
}

const COUNTRY_CODES: CountryCode[] = [
  { code: '+91', name: 'India', flag: '🇮🇳' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+1', name: 'United States', flag: '🇺🇸' },
  { code: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: '+92', name: 'Pakistan', flag: '🇵🇰' },
  { code: '+971', name: 'UAE', flag: '🇦🇪' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬' },
  { code: '+27', name: 'South Africa', flag: '🇿🇦' },
  { code: '+64', name: 'New Zealand', flag: '🇳🇿' },
  { code: '+94', name: 'Sri Lanka', flag: '🇱🇰' },
];

export default function LoginScreen() {
  const { updateUserProfile, userProfile } = useCricket();

  // Mode: Sign In vs Sign Up
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  // Signup Step: credentials form vs email OTP verification
  const [signupStep, setSignupStep] = useState<'form' | 'otp'>('form');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Optional Contact Phone (Not used for login)
  const [optionalPhone, setOptionalPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(COUNTRY_CODES[0]);
  const [countryModalVisible, setCountryModalVisible] = useState(false);

  // Email Confirmation OTP State
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const [isResendActive, setIsResendActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const otpInputs = useRef<(TextInput | null)[]>([]);

  // 60-second countdown timer for Email OTP
  useEffect(() => {
    let interval: any = null;
    if (authMode === 'signup' && signupStep === 'otp' && timer > 0) {
      interval = setInterval(() => {
        setTimer((t) => t - 1);
      }, 1000);
    } else if (timer === 0) {
      setIsResendActive(true);
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [authMode, signupStep, timer]);

  // Handle routine Sign In with Email + Password
  const handleSignIn = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your registered email address.');
      return;
    }
    if (!password) {
      Alert.alert('Password Required', 'Please enter your account password.');
      return;
    }

    try {
      setIsSubmitting(true);
      CricketHaptics.toggle();
      const authResult = await AuthService.signInWithEmail(email, password);

      // Store canonical authenticated Supabase account identity
      await updateUserProfile({
        id: authResult.user.id,
        email: authResult.profile.email,
        phoneNumber: authResult.profile.phoneNumber || undefined,
        name: authResult.profile.displayName || email.split('@')[0],
        isGuest: false,
        isVerified: true,
      });

      // Canonical authenticated account profile loaded

      CricketHaptics.milestone();
      Alert.alert(
        'Signed In Successfully! 🏏',
        `Welcome back, ${authResult.profile.displayName}! Connected with account ${authResult.profile.email}.`,
        [{ text: 'Continue', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (err: any) {
      CricketHaptics.wicket();
      Alert.alert('Sign In Failed', err.message || 'Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Password Reset Request
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your account email to receive reset instructions.');
      return;
    }
    try {
      CricketHaptics.toggle();
      const res = await AuthService.sendPasswordResetEmail(email.trim());
      Alert.alert('Password Reset', res.message);
    } catch (err: any) {
      Alert.alert('Reset Error', err.message || 'Could not send reset email.');
    }
  };

  // Handle initiating Sign Up with Email + Password
  const handleSignUpSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert('Password Too Short', 'Password must be at least 6 characters.');
      return;
    }

    const fullOptionalPhone = optionalPhone.trim()
      ? `${selectedCountry.code}${optionalPhone.trim()}`
      : undefined;

    try {
      setIsSubmitting(true);
      CricketHaptics.toggle();
      const result = await AuthService.signUpWithEmail(
        email.trim(),
        password,
        fullName.trim() || undefined,
        fullOptionalPhone
      );

      if (result.requiresOtp) {
        setSignupStep('otp');
        setTimer(60);
        setIsResendActive(false);
        Alert.alert('Verification Code Sent', result.message);
      } else if (result.session && result.user) {
        // Auto-confirmed or session established immediately
        await updateUserProfile({
          id: result.user.id,
          email: email.trim().toLowerCase(),
          phoneNumber: fullOptionalPhone,
          name: fullName.trim() || email.split('@')[0],
          isGuest: false,
          isVerified: true,
        });

        CricketHaptics.milestone();
        Alert.alert('Account Verified! 🏏', 'Welcome to Cric! Your profile is ready.', [
          { text: 'Open Arena', onPress: () => router.replace('/(tabs)') },
        ]);
      }
    } catch (err: any) {
      CricketHaptics.wicket();
      Alert.alert('Registration Notice', err.message || 'Failed to create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle verifying Email Confirmation OTP
  const handleVerifyEmailOtp = async () => {
    const entered = otpDigits.join('');
    if (entered.length < 6) {
      Alert.alert('Incomplete Code', 'Please enter all 6 digits of the confirmation code.');
      return;
    }

    const fullOptionalPhone = optionalPhone.trim()
      ? `${selectedCountry.code}${optionalPhone.trim()}`
      : undefined;

    try {
      setIsSubmitting(true);
      CricketHaptics.milestone();
      const authResult = await AuthService.verifySignupEmailOtp(
        email.trim(),
        entered,
        fullName.trim() || undefined,
        fullOptionalPhone
      );

      await updateUserProfile({
        id: authResult.user.id,
        email: authResult.profile.email,
        phoneNumber: authResult.profile.phoneNumber || fullOptionalPhone,
        name: authResult.profile.displayName || fullName.trim() || 'Cric Player',
        isGuest: false,
        isVerified: true,
      });

      Alert.alert(
        'Email Confirmed & Registered! 🏏',
        `Welcome to the Cricket Platform! Your account ${authResult.profile.email} is authenticated and linked.`,
        [{ text: 'Continue to Arena', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (err: any) {
      CricketHaptics.wicket();
      Alert.alert('Verification Failed', err.message || 'The entered OTP code could not be verified.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const val = text.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = val;
    setOtpDigits(newDigits);

    if (val && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  // 1-Tap Quick Dev Account Login (No SMS carrier cost)
  const handleSelectDevAccount = async (accountKey: keyof typeof DEV_TEST_ACCOUNTS) => {
    const creds = DEV_TEST_ACCOUNTS[accountKey];
    setEmail(creds.email);
    setPassword(creds.password);
    setAuthMode('signin');
    CricketHaptics.toggle();

    try {
      setIsSubmitting(true);
      const authResult = await AuthService.signInWithEmail(creds.email, creds.password);
      await updateUserProfile({
        id: authResult.user.id,
        email: authResult.profile.email,
        phoneNumber: authResult.profile.phoneNumber,
        name: authResult.profile.displayName || creds.displayName,
        isGuest: false,
        isVerified: true,
      });

      Alert.alert(
        `Signed In as ${creds.role}! 🏏`,
        `Account: ${creds.email}\nRole: ${creds.role}`,
        [{ text: 'Open Arena', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (err: any) {
      CricketHaptics.wicket();
      Alert.alert(
        'Dev Account Sign-In Failed',
        err.message || 'Unable to authenticate dev account against Supabase Auth. Please ensure the Supabase service is reachable or register a new account.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueAsGuest = async () => {
    CricketHaptics.toggle();
    if (!userProfile) {
      await updateUserProfile({
        name: 'Guest Scorer',
        isGuest: true,
        isVerified: false,
        role: 'player',
      });
    }
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Brand Banner */}
        <View style={styles.brandContainer}>
          <View style={styles.logoCircle}>
            <MaterialCommunityIcons name="cricket" size={44} color="#00E676" />
          </View>
          <Text style={styles.brandTitle}>CRICKET ARENA</Text>
          <Text style={styles.brandSub}>
            Ball-by-Ball Scoring • Tournament Hub • Career Profiles
          </Text>
        </View>

        {/* Authentication Card */}
        <View style={styles.authCard}>
          {/* Tab Selector: Sign In vs Sign Up */}
          <View style={styles.tabHeaderRow}>
            <TouchableOpacity
              style={[styles.tabButton, authMode === 'signin' && styles.tabButtonActive]}
              onPress={() => {
                setAuthMode('signin');
                setSignupStep('form');
              }}
            >
              <Text
                style={[styles.tabButtonText, authMode === 'signin' && styles.tabButtonTextActive]}
              >
                Sign In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, authMode === 'signup' && styles.tabButtonActive]}
              onPress={() => {
                setAuthMode('signup');
                setSignupStep('form');
              }}
            >
              <Text
                style={[styles.tabButtonText, authMode === 'signup' && styles.tabButtonTextActive]}
              >
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Mode 1: Routine Sign In (Email + Password) */}
          {authMode === 'signin' && (
            <>
              <Text style={styles.cardHeading}>Welcome Back</Text>
              <Text style={styles.cardDesc}>
                Sign in with your verified email and password. No SMS OTP required.
              </Text>

              {/* Email Input */}
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="player@example.com"
                  placeholderTextColor="#64748B"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Password Input */}
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputRow}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#94A3B8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#64748B"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>

              {/* Forgot Password Link */}
              <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPassBtn}>
                <Text style={styles.forgotPassText}>Forgot password?</Text>
              </TouchableOpacity>

              {/* Sign In Primary Button */}
              <TouchableOpacity
                style={[styles.primaryBtn, isSubmitting && styles.btnDisabled]}
                onPress={handleSignIn}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#070D1E" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>SIGN IN</Text>
                    <Ionicons name="arrow-forward" size={18} color="#070D1E" />
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Mode 2: Sign Up (Email + Password + Email OTP confirmation) */}
          {authMode === 'signup' && signupStep === 'form' && (
            <>
              <Text style={styles.cardHeading}>Create Your Profile</Text>
              <Text style={styles.cardDesc}>
                Register with email and password. Confirmed once via email OTP.
              </Text>

              {/* Full Name */}
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={styles.inputRow}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color="#94A3B8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="e.g. Virat Kohli"
                  placeholderTextColor="#64748B"
                />
              </View>

              {/* Email */}
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="player@example.com"
                  placeholderTextColor="#64748B"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Password */}
              <Text style={styles.inputLabel}>Password (Min 6 Characters)</Text>
              <View style={styles.inputRow}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#94A3B8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#64748B"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>

              {/* Optional Contact Phone */}
              <View style={styles.optionalHeaderRow}>
                <Text style={styles.inputLabel}>Contact Phone (Optional)</Text>
                <Text style={styles.optionalBadge}>Private</Text>
              </View>
              <View style={styles.phoneInputRow}>
                <TouchableOpacity
                  style={styles.countryPickerBtn}
                  onPress={() => setCountryModalVisible(true)}
                >
                  <Text style={styles.flagText}>{selectedCountry.flag}</Text>
                  <Text style={styles.countryCodeText}>{selectedCountry.code}</Text>
                  <Ionicons name="chevron-down" size={14} color="#94A3B8" />
                </TouchableOpacity>

                <TextInput
                  style={styles.phoneInput}
                  value={optionalPhone}
                  onChangeText={setOptionalPhone}
                  placeholder="9876543210"
                  placeholderTextColor="#64748B"
                  keyboardType="phone-pad"
                />
              </View>
              <Text style={styles.contactNotice}>
                Phone is optional contact info only, never a login alias.
              </Text>

              {/* Submit Sign Up Button */}
              <TouchableOpacity
                style={[styles.primaryBtn, isSubmitting && styles.btnDisabled]}
                onPress={handleSignUpSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#070D1E" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>CONTINUE TO EMAIL OTP</Text>
                    <Ionicons name="mail-unread-outline" size={18} color="#070D1E" />
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Mode 2: Step 2 - Verify Email OTP */}
          {authMode === 'signup' && signupStep === 'otp' && (
            <>
              <View style={styles.otpHeaderRow}>
                <TouchableOpacity onPress={() => setSignupStep('form')} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={20} color="#00E5FF" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.cardHeading}>Verify Email OTP</Text>
                  <Text style={styles.cardDesc}>Sent confirmation code to {email}</Text>
                </View>
              </View>

              {/* Segmented 6-digit OTP Inputs */}
              <View style={styles.otpBoxesRow}>
                {otpDigits.map((digit, idx) => (
                  <TextInput
                    key={idx}
                    ref={(el) => {
                      otpInputs.current[idx] = el;
                    }}
                    style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                    value={digit}
                    onChangeText={(txt) => handleOtpChange(txt, idx)}
                    onKeyPress={(e) => handleOtpKeyPress(e, idx)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, isSubmitting && styles.btnDisabled]}
                onPress={handleVerifyEmailOtp}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#070D1E" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>VERIFY & FINISH SIGNUP</Text>
                    <Ionicons name="checkmark-circle" size={18} color="#070D1E" />
                  </>
                )}
              </TouchableOpacity>

              {/* Resend Timer */}
              <View style={styles.resendRow}>
                {isResendActive ? (
                  <TouchableOpacity onPress={handleSignUpSubmit}>
                    <Text style={styles.resendActiveText}>Resend Email OTP Now</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.resendTimerText}>Resend code in {timer}s</Text>
                )}
              </View>
            </>
          )}

          {/* DEV Test Accounts Section (No SMS carrier cost) */}
          <View style={styles.devSection}>
            <Text style={styles.devSectionTitle}>QUICK DEV TEST ACCOUNTS</Text>
            <View style={styles.devButtonsGrid}>
              <TouchableOpacity
                style={styles.devBtn}
                onPress={() => handleSelectDevAccount('ORGANIZER')}
              >
                <Text style={styles.devBtnRole}>Organizer</Text>
                <Text style={styles.devBtnSub}>organizer@cric.test</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.devBtn}
                onPress={() => handleSelectDevAccount('CAPTAIN')}
              >
                <Text style={styles.devBtnRole}>Captain</Text>
                <Text style={styles.devBtnSub}>captain@cric.test</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.devBtn}
                onPress={() => handleSelectDevAccount('SCORER')}
              >
                <Text style={styles.devBtnRole}>Scorer</Text>
                <Text style={styles.devBtnSub}>scorer@cric.test</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.devBtn}
                onPress={() => handleSelectDevAccount('PLAYER')}
              >
                <Text style={styles.devBtnRole}>Player</Text>
                <Text style={styles.devBtnSub}>player@cric.test</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Continue as Guest Scorer */}
          <TouchableOpacity style={styles.guestBtn} onPress={handleContinueAsGuest}>
            <MaterialCommunityIcons name="account-arrow-right-outline" size={20} color="#00E5FF" />
            <Text style={styles.guestBtnText}>CONTINUE AS GUEST SCORER</Text>
          </TouchableOpacity>
          <Text style={styles.guestSubText}>
            Full offline match scoring available without an account. Link records anytime later.
          </Text>
        </View>
      </ScrollView>

      {/* Optional Phone Country Code Modal */}
      <Modal visible={countryModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.countryModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country Code</Text>
              <TouchableOpacity onPress={() => setCountryModalVisible(false)}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360 }}>
              {COUNTRY_CODES.map((item) => (
                <TouchableOpacity
                  key={item.code}
                  style={styles.countryRow}
                  onPress={() => {
                    setSelectedCountry(item);
                    setCountryModalVisible(false);
                  }}
                >
                  <Text style={styles.countryRowFlag}>{item.flag}</Text>
                  <Text style={styles.countryRowName}>{item.name}</Text>
                  <Text style={styles.countryRowCode}>{item.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D1E',
  },
  scrollContent: {
    padding: 20,
    justifyContent: 'center',
    minHeight: '100%',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#0C142B',
    borderWidth: 2,
    borderColor: '#00E676',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#00E676',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  brandSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  authCard: {
    backgroundColor: '#0C142B',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#1E2C4F',
    marginBottom: 20,
  },
  tabHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#121C38',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#00E676',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
  },
  tabButtonTextActive: {
    color: '#070D1E',
  },
  cardHeading: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  cardDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  optionalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionalBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00E5FF',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121C38',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2C4F',
    marginBottom: 14,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  eyeBtn: {
    padding: 6,
  },
  forgotPassBtn: {
    alignSelf: 'flex-end',
    marginBottom: 14,
  },
  forgotPassText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '700',
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  countryPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121C38',
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2C4F',
    gap: 6,
  },
  flagText: {
    fontSize: 18,
  },
  countryCodeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#121C38',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#1E2C4F',
    fontVariant: ['tabular-nums'],
  },
  contactNotice: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 16,
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: '#00E676',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#070D1E',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  otpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  backBtn: {
    padding: 6,
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  otpBox: {
    width: 44,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#121C38',
    borderWidth: 1.5,
    borderColor: '#1E2C4F',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '900',
    color: '#00E5FF',
    fontVariant: ['tabular-nums'],
  },
  otpBoxFilled: {
    borderColor: '#00E676',
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 14,
  },
  resendTimerText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  resendActiveText: {
    color: '#00E5FF',
    fontSize: 13,
    fontWeight: '800',
  },
  devSection: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E2C4F',
  },
  devSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 10,
    textAlign: 'center',
  },
  devButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  devBtn: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#121C38',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#1E2C4F',
    alignItems: 'center',
  },
  devBtnRole: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '800',
  },
  devBtnSub: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1E2C4F',
  },
  dividerText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
  },
  guestBtn: {
    backgroundColor: '#121C38',
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#00E5FF',
  },
  guestBtnText: {
    color: '#00E5FF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  guestSubText: {
    color: '#64748B',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 13, 30, 0.85)',
    justifyContent: 'flex-end',
  },
  countryModalCard: {
    backgroundColor: '#0C142B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1.5,
    borderTopColor: '#1E2C4F',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2C4F',
  },
  countryRowFlag: {
    fontSize: 20,
    marginRight: 10,
  },
  countryRowName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  countryRowCode: {
    color: '#00E5FF',
    fontSize: 14,
    fontWeight: '800',
  },
});
