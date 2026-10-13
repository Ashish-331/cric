import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { useTheme } from '../../theme';
import { ThemeColors } from '../../theme/tokens';
import { supabase } from '../../services/supabaseClient';

interface Association {
  id: string;
  name: string;
  shortName: string;
  city: string;
  state: string;
  memberClubsCount: number;
  activeTournamentsCount: number;
}

const DEFAULT_ASSOCIATIONS: Association[] = [
  {
    id: 'assoc_1',
    name: 'District Cricket Association Bengaluru',
    shortName: 'DCAB',
    city: 'Bengaluru',
    state: 'Karnataka',
    memberClubsCount: 12,
    activeTournamentsCount: 3,
  },
  {
    id: 'assoc_2',
    name: 'Metropolitan Cricket Board',
    shortName: 'MCB',
    city: 'Mumbai',
    state: 'Maharashtra',
    memberClubsCount: 18,
    activeTournamentsCount: 5,
  },
];

export default function AssociationsScreen() {
  const { theme, colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [associations, setAssociations] = useState<Association[]>(DEFAULT_ASSOCIATIONS);

  React.useEffect(() => {
    let isMounted = true;
    async function loadAssociations() {
      try {
        const { data } = await supabase.from('associations').select('*');
        if (data && data.length > 0 && isMounted) {
          const mapped: Association[] = data.map((d: any) => ({
            id: d.id,
            name: d.name,
            shortName: d.short_name,
            city: d.city || 'District',
            state: d.state || 'India',
            memberClubsCount: 0,
            activeTournamentsCount: 0,
          }));
          setAssociations(mapped);
        }
      } catch (e) {
        // Fallback to default records offline
      }
    }
    loadAssociations();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateAssoc = () => {
    Alert.alert(
      'Register Association',
      'Contact district governance board or enter official registration code to administer an association.',
      [{ text: 'Close' }]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cricket Associations</Text>
        <TouchableOpacity style={styles.addBtn} onPress={handleCreateAssoc}>
          <Ionicons name="add" size={22} color={theme.brand} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={associations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.assocCard}
            onPress={() =>
              Alert.alert(
                item.name,
                `Administered by verified district board.\nAffiliated Member Clubs: ${item.memberClubsCount}\nSanctioned Leagues: ${item.activeTournamentsCount}`,
                [{ text: 'View Directory' }]
              )
            }
          >
            <View style={styles.iconBox}>
              <Ionicons name="business" size={22} color={theme.brand} />
            </View>
            <View style={styles.infoBox}>
              <View style={styles.titleRow}>
                <Text style={styles.assocName}>{item.name}</Text>
                <View style={styles.shortTag}>
                  <Text style={styles.shortTagText}>{item.shortName}</Text>
                </View>
              </View>
              <Text style={styles.assocLoc}>{item.city}, {item.state}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>{item.memberClubsCount} Member Clubs</Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>{item.activeTournamentsCount} Active Leagues</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.canvas,
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      backgroundColor: theme.canvas,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    backBtn: {
      padding: 6,
      minHeight: 44,
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    addBtn: {
      padding: 6,
      minHeight: 44,
      justifyContent: 'center',
    },
    listContent: {
      padding: 16,
    },
    assocCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    infoBox: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    assocName: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.textPrimary,
      flex: 1,
    },
    shortTag: {
      backgroundColor: theme.primarySubtle,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 6,
    },
    shortTagText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.brand,
    },
    assocLoc: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
    },
    metaText: {
      fontSize: 11,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    metaDot: {
      fontSize: 11,
      color: theme.textTertiary,
      marginHorizontal: 4,
    },
  });
