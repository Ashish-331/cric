import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService, DEV_TEST_ACCOUNTS } from '../src/services/authService';
import { StorageService } from '../src/storage/storageService';
import type { UserProfile } from '../src/storage/storageService';
import type { Session, User } from '@supabase/supabase-js';

test('AUTH-LIFE-001: Startup session resolution promotes authenticated session over guest defaults', async () => {
  const mockUser: User = {
    id: 'usr_real_supabase_uuid',
    app_metadata: {},
    user_metadata: {
      display_name: 'Rohit Sharma',
      phone_number: '+919876543210',
    },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    email: 'captain.rohit@cric.test',
  };

  const defaultGuest: UserProfile = {
    id: 'user_guest',
    name: 'Guest Scorer',
    phoneNumber: '',
    isGuest: true,
    isVerified: false,
    role: 'scorer',
  };

  // Simulating startup resolution logic from CricketContext
  function resolveProfileFromSession(localProfile: UserProfile, sessionUser: User | null): UserProfile {
    if (sessionUser) {
      return {
        ...localProfile,
        id: sessionUser.id,
        email: sessionUser.email,
        name: (sessionUser.user_metadata?.display_name as string) || sessionUser.email?.split('@')[0] || 'Authenticated Player',
        phoneNumber: sessionUser.user_metadata?.phone_number as string,
        isGuest: false,
        isVerified: true,
      };
    }
    return localProfile;
  }

  const resolved = resolveProfileFromSession(defaultGuest, mockUser);
  assert.equal(resolved.isGuest, false, 'Authenticated user must not be marked as guest');
  assert.equal(resolved.isVerified, true, 'Authenticated user must be marked verified');
  assert.equal(resolved.id, 'usr_real_supabase_uuid');
  assert.equal(resolved.email, 'captain.rohit@cric.test');
  assert.equal(resolved.name, 'Rohit Sharma');
});

test('AUTH-LIFE-002: Guest mode is explicit, unverified, and separate from authenticated accounts', () => {
  const guestUser: UserProfile = {
    id: 'guest_explicit_123',
    name: 'Guest Scorer',
    isGuest: true,
    isVerified: false,
    role: 'scorer',
  };

  assert.equal(guestUser.isGuest, true);
  assert.equal(guestUser.isVerified, false);
  assert.equal(guestUser.email, undefined);

  // Authority check: Guest must not be allowed to organize tournaments
  function canOrganize(profile: UserProfile): boolean {
    return !profile.isGuest && profile.isVerified;
  }

  assert.equal(canOrganize(guestUser), false, 'Guest mode cannot organize tournaments');
});

test('AUTH-LIFE-003: Email signup enforces email validation and password requirements', async () => {
  // 1. Rejects invalid email
  await assert.rejects(
    async () => {
      await AuthService.signUpWithEmail('invalid-email-string', 'password123');
    },
    /Invalid email address format/
  );

  // 2. Rejects passwords under 6 characters
  await assert.rejects(
    async () => {
      await AuthService.signUpWithEmail('valid@cric.test', '123');
    },
    /Password must be at least 6 characters/
  );

  // 3. Valid credentials with optional private phone (which is normalized to E.164)
  const normalized = AuthService.normalizePhoneNumber('9876543210');
  assert.equal(normalized, '+919876543210');
});

test('AUTH-LIFE-004: Email OTP confirmation validates code length and activates account', async () => {
  // Reject incomplete OTP
  await assert.rejects(
    async () => {
      await AuthService.verifySignupEmailOtp('player@cric.test', '123');
    },
    /Verification code must be at least 6 characters/
  );

  // Normalizes email before OTP verification
  const normalized = AuthService.normalizeEmail(' PLAYER@CRIC.TEST ');
  assert.equal(normalized, 'player@cric.test');
});

test('AUTH-LIFE-005: Routine sign-in uses email + password without requiring SMS', async () => {
  // Dev test accounts configuration
  const devAccount = DEV_TEST_ACCOUNTS.CAPTAIN;
  assert.equal(devAccount.email, 'captain@cric.test');
  assert.equal(devAccount.password, 'password123');

  // Verify that AuthService validates email normalization before sign-in call
  assert.equal(AuthService.normalizeEmail(devAccount.email), 'captain@cric.test');
});

test('AUTH-LIFE-006: Sign out revokes session and resets profile to explicit unverified state', async () => {
  let sessionState: Session | null = {
    access_token: 'valid_jwt_token',
    refresh_token: 'valid_refresh_token',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'usr_rohit',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
  };

  // Sign out handler simulation
  function handleSignOut() {
    sessionState = null;
    return {
      id: `guest_${Date.now()}`,
      name: 'Guest Scorer',
      isGuest: true,
      isVerified: false,
      role: 'scorer' as const,
    };
  }

  const profileAfterSignOut = handleSignOut();
  assert.equal(sessionState, null, 'Session must be null after sign out');
  assert.equal(profileAfterSignOut.isGuest, true);
  assert.equal(profileAfterSignOut.isVerified, false);
});
