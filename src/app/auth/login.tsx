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
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { Colors } from '../../utils/colors';
import { CricketHaptics } from '../../services/haptics';

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

import { AuthService, DEV_TEST_ACCOUNTS } from '../../services/authService';

export default function LoginScreen() {
  const { updateUserProfile, userProfile, claimGhostProfile } = useCricket();

  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(COUNTRY_CODES[0]);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  // OTP State
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const [isResendActive, setIsResendActive] = useState(false);

  const otpInputs = useRef<(TextInput | null)[]>([]);

  // 60-second countdown timer
  useEffect(() => {
    let interval: any = null;
    if (step === 'otp' && timer > 0) {
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
  }, [step, timer]);

  const handleSendOtp = async () => {
    if (!phoneNumber || phoneNumber.trim().length < 8) {
      Alert.alert('Invalid Number', 'Please enter a valid mobile number.');
      return;
    }
    const fullPhone = `${selectedCountry.code}${phoneNumber.trim()}`;
    try {
      CricketHaptics.toggle();
      const res = await AuthService.requestOtp(fullPhone);
      setStep('otp');
      setTimer(60);
      setIsResendActive(false);
      Alert.alert('OTP Request', res.message || `Verification code sent to ${fullPhone}`);
    } catch (err: any) {
      // If backend is not yet reachable locally, notify clearly
      Alert.alert(
        'Auth Notice',
        `${err.message}\n\nTip: For local development testing, you can use the test accounts below.`
      );
      setStep('otp');
      setTimer(60);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const val = text.slice(-1); // only single char
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

  const handleAutofillDemoOtp = () => {
    CricketHaptics.milestone();
    setOtpDigits(['1', '2', '3', '4', '5', '6']);
  };

  const handleSelectDevAccount = (phone: string, otp: string) => {
    setSelectedCountry(COUNTRY_CODES[0]); // +91
    setPhoneNumber(phone.replace('+91', ''));
    setOtpDigits(otp.split(''));
    CricketHaptics.toggle();
  };

  const handleVerifyOtp = async () => {
    const entered = otpDigits.join('');
    if (entered.length < 6) {
      Alert.alert('Incomplete Code', 'Please enter all 6 digits.');
      return;
    }

    const fullPhone = `${selectedCountry.code}${phoneNumber.trim()}`;
    try {
      CricketHaptics.milestone();
      const displayName = userProfile?.name;

      // Fail-closed Supabase Auth verification - rejects invalid OTP codes and unreachable auth service
      const authResult = await AuthService.verifyOtp(fullPhone, entered, displayName);

      // Store canonical authenticated Supabase account identity
      await updateUserProfile({
        id: authResult.user.id,
        phoneNumber: fullPhone,
        name: authResult.profile.displayName || displayName || 'Cric Player',
        isGuest: false,
        isVerified: true,
      });

      const { claimedCount } = await claimGhostProfile(fullPhone);

      if (claimedCount > 0) {
        Alert.alert(
          'Verified & Historical Records Claimed! 🏏',
          `Welcome! Linked to ${fullPhone}. Your career batting, bowling, and tournament stats have been claimed and unified! (${claimedCount} records found)`,
          [{ text: 'Open Arena', onPress: () => router.replace('/(tabs)') }]
        );
      } else {
        Alert.alert(
          'Verified Successfully! 🏏',
          `Welcome to the Cricket Platform! Account ${fullPhone} is authenticated and ready for live scoring & tournament management.`,
          [{ text: 'Continue', onPress: () => router.replace('/(tabs)') }]
        );
      }
    } catch (err: any) {
      CricketHaptics.wicket();
      Alert.alert('Verification Failed', err.message || 'The entered OTP code could not be verified.');
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
          {step === 'phone' ? (
            <>
              <Text style={styles.cardHeading}>Sign In or Register</Text>
              <Text style={styles.cardDesc}>
                Enter your mobile number to authenticate and access verified captaincy, scoring, and teams.
              </Text>

              {/* Country & Phone Input Row */}
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
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="9876543210"
                  placeholderTextColor="#64748B"
                  keyboardType="phone-pad"
                  autoFocus
                />
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleSendOtp}>
                <Text style={styles.primaryBtnText}>GET VERIFICATION OTP</Text>
                <Ionicons name="arrow-forward" size={18} color="#070D1E" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.otpHeaderRow}>
                <TouchableOpacity onPress={() => setStep('phone')} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={20} color="#00E5FF" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.cardHeading}>Verify 6-Digit OTP</Text>
                  <Text style={styles.cardDesc}>
                    Sent to {selectedCountry.code} {phoneNumber}
                  </Text>
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

              {/* Demo Helper Button */}
              <TouchableOpacity
                style={styles.demoCodeBtn}
                onPress={handleAutofillDemoOtp}
              >
                <Ionicons name="flash-outline" size={14} color="#FFB300" />
                <Text style={styles.demoCodeText}>Auto-fill Demo Code (123456)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleVerifyOtp}>
                <Text style={styles.primaryBtnText}>VERIFY & CONTINUE</Text>
                <Ionicons name="checkmark-circle" size={18} color="#070D1E" />
              </TouchableOpacity>

              {/* Resend Timer */}
              <View style={styles.resendRow}>
                {isResendActive ? (
                  <TouchableOpacity onPress={handleSendOtp}>
                    <Text style={styles.resendActiveText}>Resend OTP Now</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.resendTimerText}>
                    Resend code in {timer}s
                  </Text>
                )}
              </View>
            </>
          )}

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Continue as Guest Scorer */}
          <TouchableOpacity
            style={styles.guestBtn}
            onPress={handleContinueAsGuest}
          >
            <MaterialCommunityIcons name="account-arrow-right-outline" size={20} color="#00E5FF" />
            <Text style={styles.guestBtnText}>CONTINUE AS GUEST SCORER</Text>
          </TouchableOpacity>
          <Text style={styles.guestSubText}>
            Full offline match scoring available without an account. Link records anytime later.
          </Text>
        </View>
      </ScrollView>

      {/* Country Code Selection Modal */}
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
    marginBottom: 24,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0C142B',
    borderWidth: 2,
    borderColor: '#00E676',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
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
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#1E2C4F',
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
  phoneInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  countryPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121C38',
    paddingHorizontal: 12,
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
    fontSize: 16,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#1E2C4F',
    fontVariant: ['tabular-nums'],
  },
  primaryBtn: {
    backgroundColor: '#00E676',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
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
  demoCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#121C38',
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FFB300',
  },
  demoCodeText: {
    color: '#FFB300',
    fontSize: 12,
    fontWeight: '800',
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
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
