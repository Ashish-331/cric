import React, { useState } from 'react';
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

import { supabase } from '../../services/supabaseClient';

export default function AssociationsScreen() {
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
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cricket Associations</Text>
        <TouchableOpacity style={styles.addBtn} onPress={handleCreateAssoc}>
          <Ionicons name="add" size={20} color="#00E676" />
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
              <Ionicons name="business" size={24} color="#00E676" />
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
  assocCard: {
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assocName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
    flex: 1,
  },
  shortTag: {
    backgroundColor: '#1E2C4F',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  shortTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00E676',
  },
  assocLoc: {
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
