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
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { Colors } from '../../utils/colors';

interface NavigationDrawerModalProps {
  visible: boolean;
  onClose: () => void;
}

export const NavigationDrawerModal: React.FC<NavigationDrawerModalProps> = ({
  visible,
  onClose,
}) => {
  const { userProfile, switchUser, presetUsers } = useCricket();

  const maskPhone = (phone?: string) => {
    if (!phone) return 'Guest Session';
    // Protect private phone: show only country code and last 2 digits
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
        title: 'Cric — Cricket Scoring & Platform',
        message: 'Score matches ball-by-ball and view live tournament stats on Cric: https://github.com/Ashish-331/cric',
      });
    } catch (err: any) {
      console.warn('Share app dismissed:', err.message);
    }
  };

  const handleRateApp = () => {
    Alert.alert(
      'Rate Cric',
      'Enjoying the open cricket platform? Thank you for supporting community cricket!',
      [{ text: 'Not Now', style: 'cancel' }, { text: '★★★★★ Love it!' }]
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
        <View style={styles.drawerContent}>
          {/* Drawer Header: Account Identity */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.profileRow}
              onPress={() => handleNavigate('/profile')}
            >
              <View style={styles.avatarBox}>
                <Ionicons name="person" size={28} color="#00E676" />
              </View>
              <View style={styles.profileInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {userProfile?.name || 'Cricket Player'}
                  </Text>
                  {userProfile?.isVerified && !userProfile.isGuest ? (
                    <Ionicons name="checkmark-circle" size={16} color="#00E676" style={{ marginLeft: 4 }} />
                  ) : null}
                </View>
                <Text style={styles.userPhone}>{maskPhone(userProfile?.phoneNumber)}</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>
                    {userProfile?.role ? userProfile.role.toUpperCase() : 'PLAYER'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Drawer Navigation Items (Reference 8 Scope Lock) */}
          <ScrollView style={styles.menuList} showsVerticalScrollIndicator={false}>
            {/* Primary Cricket Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>MATCHES & SERIES</Text>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/(tabs)/new-match')}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#0284C7' }]}>
                  <Ionicons name="add" size={18} color="#FFF" />
                </View>
                <Text style={styles.menuText}>Start a Match</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/tournaments/create')}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#7C3AED' }]}>
                  <Ionicons name="trophy" size={16} color="#FFF" />
                </View>
                <Text style={styles.menuText}>Add Tournament / Series</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/go-live')}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#DC2626' }]}>
                  <Ionicons name="radio" size={16} color="#FFF" />
                </View>
                <View style={styles.menuLabelContainer}>
                  <Text style={styles.menuText}>Go Live</Text>
                  <Text style={styles.subLabel}>Live score sharing</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/(tabs)/my-cricket')}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#059669' }]}>
                  <MaterialCommunityIcons name="cricket" size={18} color="#FFF" />
                </View>
                <Text style={styles.menuText}>My Cricket</Text>
              </TouchableOpacity>
            </View>

            {/* Performance & Recognition */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>PERFORMANCE & AWARDS</Text>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/performance')}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#2563EB' }]}>
                  <Ionicons name="analytics" size={18} color="#FFF" />
                </View>
                <Text style={styles.menuText}>My Performance</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/leaderboards')}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#D97706' }]}>
                  <Ionicons name="podium" size={18} color="#FFF" />
                </View>
                <Text style={styles.menuText}>Leaderboards</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/awards')}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#F59E0B' }]}>
                  <Ionicons name="medal" size={18} color="#FFF" />
                </View>
                <Text style={styles.menuText}>Awards & Honours</Text>
              </TouchableOpacity>
            </View>

            {/* Organizations & Governance */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>CLUBS & ASSOCIATIONS</Text>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/associations')}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#475569' }]}>
                  <Ionicons name="business" size={18} color="#FFF" />
                </View>
                <Text style={styles.menuText}>Associations</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/clubs')}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#0D9488' }]}>
                  <Ionicons name="shield-checkmark" size={18} color="#FFF" />
                </View>
                <Text style={styles.menuText}>Clubs & Rosters</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/app-code')}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#4F46E5' }]}>
                  <Ionicons name="key" size={16} color="#FFF" />
                </View>
                <View style={styles.menuLabelContainer}>
                  <Text style={styles.menuText}>App Code</Text>
                  <Text style={styles.subLabel}>Join team or competition</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Support & Utility */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>SUPPORT & SHARING</Text>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleNavigate('/help')}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#64748B' }]}>
                  <Ionicons name="help-circle" size={18} color="#FFF" />
                </View>
                <Text style={styles.menuText}>Help & Contact</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={handleShareApp}>
                <View style={[styles.iconCircle, { backgroundColor: '#0284C7' }]}>
                  <Ionicons name="share-social" size={18} color="#FFF" />
                </View>
                <Text style={styles.menuText}>Share App</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={handleRateApp}>
                <View style={[styles.iconCircle, { backgroundColor: '#EA580C' }]}>
                  <Ionicons name="star" size={18} color="#FFF" />
                </View>
                <Text style={styles.menuText}>Rate App</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Account Switcher for multi-device pairing testing */}
            <View style={[styles.section, { borderBottomWidth: 0, paddingBottom: 24 }]}>
              <Text style={styles.sectionHeader}>SWITCH TEST ROLE</Text>
              {presetUsers.map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.userSwitchRow,
                    userProfile?.id === preset.id && styles.activeUserRow,
                  ]}
                  onPress={() => {
                    switchUser(preset);
                    onClose();
                  }}
                >
                  <View style={styles.switchUserInfo}>
                    <Text style={styles.switchUserName}>{preset.name}</Text>
                    <Text style={styles.switchUserRole}>{preset.role.toUpperCase()}</Text>
                  </View>
                  {userProfile?.id === preset.id && (
                    <Ionicons name="checkmark" size={18} color="#00E676" />
                  )}
                </TouchableOpacity>
              ))}
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
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  drawerContent: {
    width: '80%',
    maxWidth: 320,
    backgroundColor: '#070D1E',
    borderRightWidth: 1,
    borderRightColor: '#1E2C4F',
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2C4F',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0C142B',
    borderWidth: 2,
    borderColor: '#00E676',
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
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userPhone: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E2C4F',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  roleText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#00E676',
    letterSpacing: 0.5,
  },
  menuList: {
    flex: 1,
  },
  section: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#121C38',
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabelContainer: {
    flex: 1,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  subLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  userSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  activeUserRow: {
    backgroundColor: '#0C142B',
  },
  switchUserInfo: {
    flex: 1,
  },
  switchUserName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  switchUserRole: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
});
