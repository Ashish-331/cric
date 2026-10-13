import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { useTheme } from '../../theme/useTheme';
import { AuthService } from '../../services/authService';

interface NavigationDrawerModalProps {
  visible: boolean;
  onClose: () => void;
}

export const NavigationDrawerModal: React.FC<NavigationDrawerModalProps> = ({
  visible,
  onClose,
}) => {
  const { userProfile, updateUserProfile } = useCricket();
  const { theme } = useTheme();

  const maskPhone = (phone?: string) => {
    if (!phone) return 'Guest Session';
    if (phone.length > 6) {
      return `${phone.slice(0, 3)} ••••• ••${phone.slice(-2)}`;
    }
    return phone;
  };

  const handleNavigate = (path: string) => {
    onClose();
    router.push(path as any);
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        title: 'Cric — Grassroots Cricket Scoring',
        message: 'Score matches ball-by-ball and manage team rosters with Cric.',
      });
    } catch (err: any) {
      console.warn('Share app notice:', err.message);
    }
  };

  const handleRateApp = () => {
    Alert.alert(
      'Rate Cric',
      'Thank you for supporting community cricket!',
      [{ text: 'Close', style: 'cancel' }, { text: '★★★★★ Love it!' }]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.drawerContent, { backgroundColor: theme.surface, borderRightColor: theme.border }]}>
          {/* Drawer Header: Account Identity */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <TouchableOpacity
              style={styles.profileRow}
              onPress={() => handleNavigate('/profile')}
            >
              <View style={[styles.avatarBox, { backgroundColor: theme.raised, borderColor: theme.border }]}>
                <Ionicons name="person" size={24} color={theme.brand} />
              </View>
              <View style={styles.profileInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.userName, { color: theme.textPrimary }]} numberOfLines={1}>
                    {userProfile?.name || 'Guest User'}
                  </Text>
                  {userProfile?.isVerified && !userProfile.isGuest ? (
                    <Ionicons name="checkmark-circle" size={15} color={theme.brand} style={{ marginLeft: 4 }} />
                  ) : null}
                </View>
                <Text style={[styles.userContact, { color: theme.textSecondary }]} numberOfLines={1}>
                  {userProfile?.email || maskPhone(userProfile?.phoneNumber)}
                </Text>
                <View style={[styles.roleBadge, { backgroundColor: theme.raised, borderColor: theme.border }]}>
                  <Text style={[styles.roleText, { color: theme.textSecondary }]}>
                    {userProfile?.role ? userProfile.role.toUpperCase() : 'SCORER'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Drawer Navigation Items */}
          <ScrollView style={styles.menuList} showsVerticalScrollIndicator={false}>
            {/* Primary Cricket Actions */}
            <View style={[styles.section, { borderBottomColor: theme.borderSubdued }]}>
              <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>MATCHES & SERIES</Text>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/(tabs)/new-match')}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme.raised, borderColor: theme.border }]}>
                  <Ionicons name="add" size={18} color={theme.brand} />
                </View>
                <Text style={[styles.menuText, { color: theme.textPrimary }]}>Start a Match</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/tournaments/create')}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme.raised, borderColor: theme.border }]}>
                  <Ionicons name="trophy-outline" size={16} color={theme.brand} />
                </View>
                <Text style={[styles.menuText, { color: theme.textPrimary }]}>Organize Tournament</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/go-live')}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme.raised, borderColor: theme.border }]}>
                  <Ionicons name="radio-outline" size={16} color={theme.statusLive} />
                </View>
                <View style={styles.menuLabelContainer}>
                  <Text style={[styles.menuText, { color: theme.textPrimary }]}>Go Live</Text>
                  <Text style={[styles.subLabel, { color: theme.textMuted }]}>Score broadcast</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/(tabs)/my-cricket')}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme.raised, borderColor: theme.border }]}>
                  <MaterialCommunityIcons name="cricket" size={18} color={theme.textSecondary} />
                </View>
                <Text style={[styles.menuText, { color: theme.textPrimary }]}>My Cricket</Text>
              </TouchableOpacity>
            </View>

            {/* Performance & Recognition */}
            <View style={[styles.section, { borderBottomColor: theme.borderSubdued }]}>
              <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>PERFORMANCE</Text>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/performance')}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme.raised, borderColor: theme.border }]}>
                  <Ionicons name="analytics-outline" size={18} color={theme.textSecondary} />
                </View>
                <Text style={[styles.menuText, { color: theme.textPrimary }]}>Performance Analysis</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/leaderboards')}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme.raised, borderColor: theme.border }]}>
                  <Ionicons name="podium-outline" size={18} color={theme.textSecondary} />
                </View>
                <Text style={[styles.menuText, { color: theme.textPrimary }]}>Leaderboards</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/awards')}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme.raised, borderColor: theme.border }]}>
                  <Ionicons name="medal-outline" size={18} color={theme.textSecondary} />
                </View>
                <Text style={[styles.menuText, { color: theme.textPrimary }]}>Awards</Text>
              </TouchableOpacity>
            </View>

            {/* Organizations & Community */}
            <View style={[styles.section, { borderBottomColor: theme.borderSubdued }]}>
              <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>COMMUNITY</Text>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/associations')}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme.raised, borderColor: theme.border }]}>
                  <Ionicons name="business-outline" size={18} color={theme.textSecondary} />
                </View>
                <Text style={[styles.menuText, { color: theme.textPrimary }]}>Associations</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/clubs')}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme.raised, borderColor: theme.border }]}>
                  <Ionicons name="shield-outline" size={18} color={theme.textSecondary} />
                </View>
                <Text style={[styles.menuText, { color: theme.textPrimary }]}>Clubs</Text>
              </TouchableOpacity>
            </View>

            {/* Settings & Info */}
            <View style={[styles.section, { borderBottomColor: theme.borderSubdued }]}>
              <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>PREFERENCES</Text>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/(tabs)/settings')}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme.raised, borderColor: theme.border }]}>
                  <Ionicons name="settings-outline" size={18} color={theme.textSecondary} />
                </View>
                <Text style={[styles.menuText, { color: theme.textPrimary }]}>Settings</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/help')}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme.raised, borderColor: theme.border }]}>
                  <Ionicons name="help-circle-outline" size={18} color={theme.textSecondary} />
                </View>
                <Text style={[styles.menuText, { color: theme.textPrimary }]}>Help & Rules</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={handleShareApp}>
                <View style={[styles.iconCircle, { backgroundColor: theme.raised, borderColor: theme.border }]}>
                  <Ionicons name="share-social-outline" size={18} color={theme.textSecondary} />
                </View>
                <Text style={[styles.menuText, { color: theme.textPrimary }]}>Share Cric App</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={handleRateApp}>
                <View style={[styles.iconCircle, { backgroundColor: theme.raised, borderColor: theme.border }]}>
                  <Ionicons name="star-outline" size={18} color={theme.textSecondary} />
                </View>
                <Text style={[styles.menuText, { color: theme.textPrimary }]}>Rate App</Text>
              </TouchableOpacity>
            </View>

            {/* Account & Session Controls */}
            <View style={[styles.section, { borderBottomWidth: 0, paddingBottom: 28 }]}>
              <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>ACCOUNT</Text>
              {!userProfile?.isGuest && userProfile?.isVerified ? (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={async () => {
                    onClose();
                    Alert.alert(
                      'Sign Out',
                      'Are you sure you want to sign out of your account?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Sign Out',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await AuthService.signOut();
                            } catch (e: any) {
                              console.warn('Sign out warning:', e.message);
                            }
                            await updateUserProfile({
                              id: `guest_${Date.now()}`,
                              name: 'Guest Scorer',
                              email: undefined,
                              phoneNumber: undefined,
                              isGuest: true,
                              isVerified: false,
                              role: 'scorer',
                            });
                            router.replace('/auth/login');
                          },
                        },
                      ]
                    );
                  }}
                >
                  <View style={[styles.iconCircle, { backgroundColor: theme.statusErrorBg, borderColor: theme.statusError }]}>
                    <Ionicons name="log-out-outline" size={18} color={theme.statusError} />
                  </View>
                  <Text style={[styles.menuText, { color: theme.statusError }]}>Sign Out</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    onClose();
                    router.push('/auth/login');
                  }}
                >
                  <View style={[styles.iconCircle, { backgroundColor: theme.brandTint, borderColor: theme.brand }]}>
                    <Ionicons name="log-in-outline" size={18} color={theme.brand} />
                  </View>
                  <Text style={[styles.menuText, { color: theme.brand }]}>Sign In / Register</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  drawerContent: {
    width: '82%',
    maxWidth: 320,
    borderRightWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 48 : 28,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
  },
  userContact: {
    fontSize: 12,
    marginTop: 1,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  roleText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  menuList: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuText: {
    fontSize: 13,
    fontWeight: '600',
  },
  menuLabelContainer: {
    flex: 1,
  },
  subLabel: {
    fontSize: 10,
    marginTop: 1,
  },
});
