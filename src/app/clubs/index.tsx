import React from 'react';
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

import { supabase } from '../../services/supabaseClient';

export default function ClubsScreen() {
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
          <Ionicons name="arrow-back" size={24} color="#FFF" />
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
          <Ionicons name="add" size={20} color="#00E676" />
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
              <Ionicons name="shield-checkmark" size={24} color="#0284C7" />
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
            <Ionicons name="chevron-forward" size={18} color="#64748B" />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D1E',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#070D1E',
    borderBottomWidth: 1,
    borderBottomColor: '#1E2C4F',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  addBtn: {
    padding: 6,
  },
  listContent: {
    padding: 16,
  },
  clubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C142B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#070D1E',
    borderWidth: 1,
    borderColor: '#1E2C4F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoBox: {
    flex: 1,
  },
  clubName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
  assocText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  metaDot: {
    fontSize: 11,
    color: '#64748B',
    marginHorizontal: 4,
  },
});
