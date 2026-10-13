import React, { useMemo } from 'react';
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

interface ClubItem {
  id: string;
  name: string;
  associationName: string;
  city: string;
  teamsCount: number;
}

const DEFAULT_CLUBS: ClubItem[] = [
  {
    id: 'club_1',
    name: 'Warriors Sports Club',
    associationName: 'District Cricket Association Bengaluru',
    city: 'Bengaluru',
    teamsCount: 4,
  },
  {
    id: 'club_2',
    name: 'Royals Athletic Club',
    associationName: 'District Cricket Association Bengaluru',
    city: 'Bengaluru',
    teamsCount: 3,
  },
  {
    id: 'club_3',
    name: 'Metro Cricket Club',
    associationName: 'Metropolitan Cricket Board',
    city: 'Mumbai',
    teamsCount: 6,
  },
];

export default function ClubsScreen() {
  const { theme, colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { teams } = useCricket();
  const [clubs, setClubs] = React.useState<ClubItem[]>(DEFAULT_CLUBS);

  React.useEffect(() => {
    let isMounted = true;
    async function loadClubs() {
      try {
        const { data } = await supabase.from('clubs').select('*');
        if (data && data.length > 0 && isMounted) {
          const mapped: ClubItem[] = data.map((d: any) => ({
            id: d.id,
            name: d.name,
            associationName: 'Member Cricket Club',
            city: d.city || 'District',
            teamsCount: 2,
          }));
          setClubs(mapped);
        }
      } catch (e) {
        // Fallback to defaults offline
      }
    }
    loadClubs();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Clubs & Rosters</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() =>
            Alert.alert(
              'Register Cricket Club',
              'To register a new club under your district association, submit club bylaws and nominate official managers.',
              [{ text: 'Close' }]
            )
          }
        >
          <Ionicons name="add" size={22} color={theme.brand} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={clubs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.clubCard}
            onPress={() => router.push('/(tabs)/teams')}
          >
            <View style={styles.iconBox}>
              <Ionicons name="shield-checkmark" size={22} color={theme.brand} />
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.clubName}>{item.name}</Text>
              <Text style={styles.assocText}>{item.associationName}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>{item.city}</Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>{item.teamsCount} Registered Teams</Text>
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
    clubCard: {
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
    clubName: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    assocText: {
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
