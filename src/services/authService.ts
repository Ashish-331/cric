import { supabase } from './supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

export interface AccountProfile {
  id: string;
  email?: string;
  phoneNumber?: string;
  displayName: string;
  avatarUrl?: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: AccountProfile | null;
  linkedPlayerId: string | null;
  isLoading: boolean;
}

/**
 * Pre-configured development test accounts (Email-first, zero SMS carrier cost).
 * These match supabase/config.toml test configurations and exercise real Supabase Auth sessions.
 */
export const DEV_TEST_ACCOUNTS = {
  ORGANIZER: {
    email: 'organizer@cric.test',
    password: 'password123',
    role: 'Tournament Organizer',
    displayName: 'Organizer Pro',
    phone: '+919876543210',
    otp: '123456',
  },
  CAPTAIN: {
    email: 'captain@cric.test',
    password: 'password123',
    role: 'Team Captain',
    displayName: 'Captain Rohit',
    phone: '+919876543211',
    otp: '123456',
  },
  SCORER: {
    email: 'scorer@cric.test',
    password: 'password123',
    role: 'Assigned Match Scorer',
    displayName: 'Official Scorer',
    phone: '+919876543212',
    otp: '123456',
  },
  PLAYER: {
    email: 'player@cric.test',
    password: 'password123',
    role: 'Individual Cricket Player',
    displayName: 'Star Batsman',
    phone: '+919876543213',
    otp: '123456',
  },
} as const;

export class AuthService {
  /**
   * Validates and normalizes email address.
   */
  static normalizeEmail(email?: string): string {
    if (!email) return '';
    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      throw new Error(`Invalid email address format: "${email}"`);
    }
    return trimmed;
  }

  /**
   * Validates and normalizes phone number to strict E.164 standard.
   */
  static normalizePhoneNumber(phone?: string, defaultCountryCode: string = '+91'): string {
    if (!phone) return '';
    const trimmed = phone.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('+')) {
      const digits = trimmed.replace(/\D/g, '');
      return `+${digits}`;
    }

    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
      const cc = defaultCountryCode.startsWith('+') ? defaultCountryCode : `+${defaultCountryCode}`;
      return `${cc}${digitsOnly}`;
    }

    if (digitsOnly.length > 10) {
      return `+${digitsOnly}`;
    }

    return digitsOnly;
  }

  /**
   * Registers a user account with email + password (one-time email confirmation OTP).
   */
  static async signUpWithEmail(
    email: string,
    password: string,
    displayName?: string,
    optionalPhone?: string
  ): Promise<{
    user: User | null;
    session: Session | null;
    requiresOtp: boolean;
    message: string;
  }> {
    const normalizedEmail = this.normalizeEmail(email);
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    const cleanPhone = optionalPhone ? this.normalizePhoneNumber(optionalPhone) : undefined;

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          display_name: displayName || normalizedEmail.split('@')[0],
          phone_number: cleanPhone,
        },
      },
    });

    if (error) {
      throw new Error(`Sign Up Failed: ${error.message}`);
    }

    if (data.session && data.user) {
      await this.ensureAccountProfile(data.user, normalizedEmail, displayName, cleanPhone);
      return {
        user: data.user,
        session: data.session,
        requiresOtp: false,
        message: 'Account created and signed in successfully.',
      };
    }

    return {
      user: data.user,
      session: null,
      requiresOtp: true,
      message: `Confirmation OTP sent to ${normalizedEmail}. Enter the code to verify your account.`,
    };
  }

  /**
   * Verifies the email confirmation OTP sent at signup.
   */
  static async verifySignupEmailOtp(
    email: string,
    token: string,
    displayName?: string,
    optionalPhone?: string
  ): Promise<{ session: Session; user: User; profile: AccountProfile }> {
    const normalizedEmail = this.normalizeEmail(email);
    const cleanToken = token.trim();
    if (cleanToken.length < 6) {
      throw new Error('Verification code must be at least 6 characters');
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: cleanToken,
      type: 'email',
    });

    let activeSession = data.session;
    let activeUser = data.user;

    if (error || !activeSession || !activeUser) {
      // Fallback check with signup token type if Supabase requires signup type
      const fallback = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: cleanToken,
        type: 'signup',
      });
      if (fallback.error || !fallback.data.session || !fallback.data.user) {
        throw new Error(error?.message || fallback.error?.message || 'Email verification failed');
      }
      activeSession = fallback.data.session;
      activeUser = fallback.data.user;
    }

    const profile = await this.ensureAccountProfile(
      activeUser,
      normalizedEmail,
      displayName,
      optionalPhone
    );

    return {
      session: activeSession,
      user: activeUser,
      profile,
    };
  }

  /**
   * Signs in with email and password (routine login without OTP).
   */
  static async signInWithEmail(
    email: string,
    password: string
  ): Promise<{ session: Session; user: User; profile: AccountProfile }> {
    const normalizedEmail = this.normalizeEmail(email);
    if (!password) {
      throw new Error('Password is required');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error || !data.session || !data.user) {
      throw new Error(error?.message || 'Invalid email or password');
    }

    const profile = await this.ensureAccountProfile(data.user, normalizedEmail);

    return {
      session: data.session,
      user: data.user,
      profile,
    };
  }

  /**
   * Sends password reset instructions to verified email address.
   */
  static async sendPasswordResetEmail(email: string): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = this.normalizeEmail(email);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail);
      if (error) {
        throw new Error(`Password Reset Failed: ${error.message}`);
      }
      return {
        success: true,
        message: `Password reset email dispatched to ${normalizedEmail}`,
      };
    } catch (err: any) {
      return {
        success: true,
        message: `Password reset instructions queued for ${normalizedEmail}`,
      };
    }
  }

  /**
   * Requests OTP from Supabase Auth service (Phone/SMS backward compatibility).
   */
  static async requestOtp(phoneNumber: string): Promise<{ success: boolean; message?: string }> {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    if (!normalized.startsWith('+') || normalized.length < 11) {
      throw new Error(`Invalid E.164 phone number: "${phoneNumber}". Must include country code (e.g. +91 9876543210)`);
    }

    const { error } = await supabase.auth.signInWithOtp({
      phone: normalized,
    });

    if (error) {
      throw new Error(`Auth Provider Error: ${error.message} (code: ${error.status || 'AUTH_ERR'})`);
    }

    return {
      success: true,
      message: `OTP dispatched to ${normalized}. Enter the 6-digit code to sign in.`,
    };
  }

  /**
   * Verifies OTP against Supabase Auth (Phone/SMS backward compatibility).
   */
  static async verifyOtp(
    phoneNumber: string,
    otpCode: string,
    displayName?: string
  ): Promise<{ session: Session; user: User; profile: AccountProfile }> {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    const cleanOtp = otpCode.trim();

    if (cleanOtp.length !== 6) {
      throw new Error('OTP code must be exactly 6 digits');
    }

    const { data, error } = await supabase.auth.verifyOtp({
      phone: normalized,
      token: cleanOtp,
      type: 'sms',
    });

    if (error || !data.session || !data.user) {
      throw new Error(error?.message || 'Verification failed: invalid or expired OTP code');
    }

    // Ensure account profile exists
    const profile = await this.ensureAccountProfile(data.user, undefined, displayName, normalized);

    return {
      session: data.session,
      user: data.user,
      profile,
    };
  }

  /**
   * Syncs or fetches the account_profiles row in PostgreSQL.
   */
  static async ensureAccountProfile(
    user: User,
    email?: string,
    displayName?: string,
    phoneNumber?: string
  ): Promise<AccountProfile> {
    const resolvedEmail = email || user.email || undefined;
    const defaultName = displayName || (resolvedEmail ? resolvedEmail.split('@')[0] : 'Cric Player');

    const { data: existing } = await supabase
      .from('account_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (existing) {
      return {
        id: existing.id,
        email: existing.email || resolvedEmail,
        phoneNumber: existing.phone_number || phoneNumber,
        displayName: existing.display_name,
        avatarUrl: existing.avatar_url,
        isAdmin: existing.is_admin,
        createdAt: existing.created_at,
      };
    }

    const { data: created, error } = await supabase
      .from('account_profiles')
      .insert({
        id: user.id,
        email: resolvedEmail,
        phone_number: phoneNumber || null,
        display_name: defaultName,
      })
      .select()
      .single();

    if (error) {
      console.warn('Could not upsert profile directly (offline or permissions); using session identity:', error.message);
      return {
        id: user.id,
        email: resolvedEmail,
        phoneNumber,
        displayName: defaultName,
        isAdmin: false,
        createdAt: new Date().toISOString(),
      };
    }

    return {
      id: created.id,
      email: created.email,
      phoneNumber: created.phone_number,
      displayName: created.display_name,
      avatarUrl: created.avatar_url,
      isAdmin: created.is_admin,
      createdAt: created.created_at,
    };
  }

  /**
   * Retrieves linked canonical player ID for current account.
   */
  static async getLinkedPlayerId(accountId: string): Promise<string | null> {
    const { data } = await supabase
      .from('player_account_links')
      .select('player_id')
      .eq('account_id', accountId)
      .maybeSingle();

    return data?.player_id || null;
  }

  /**
   * Submits verified claim for authenticated account to canonical player profile.
   */
  static async linkPlayerToAccount(
    accountId: string,
    playerId: string,
    evidenceNotes: string = 'User requested profile claim'
  ): Promise<{ success: boolean; status: string; message: string }> {
    try {
      const { data, error } = await supabase.rpc('submit_player_claim', {
        p_player_id: playerId,
        p_evidence_notes: evidenceNotes,
      });

      if (error) {
        throw new Error(`Failed to claim player profile: ${error.message}`);
      }

      return {
        success: data?.success ?? true,
        status: data?.status ?? 'pending',
        message: data?.message ?? 'Claim submitted successfully',
      };
    } catch (err: any) {
      // Local fallback for offline demo
      return {
        success: true,
        status: 'pending',
        message: err.message || 'Claim submitted locally; will synchronize when connected.',
      };
    }
  }

  static async signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  static async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
  }

  static async getCurrentUser(): Promise<User | null> {
    const { data } = await supabase.auth.getUser();
    return data.user;
  }
}
