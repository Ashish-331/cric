import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { PlayerPerformanceService } from '../../services/playerPerformanceService';

interface SearchResult {
  id: string;
  type: 'match' | 'team' | 'tournament';
  title: string;
  subtitle: string;
  route: string;
}

export default function SearchScreen() {
  const { matches, teams, tournaments, userProfile } = useCricket();
  const [query, setQuery] = useState('');

  const searchResults: SearchResult[] = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const results: SearchResult[] = [];

    const authorizedMatches = userProfile?.id
      ? PlayerPerformanceService.getFilteredMatchesForUser(
          userProfile.id,
          'all',
          matches,
          teams,
          tournaments,
          userProfile.claimedPlayerId ? [userProfile.claimedPlayerId] : []
        )
      : [];

    // Search matches (scoped to authorized matches)
    for (const m of authorizedMatches) {
      if (
        m.title.toLowerCase().includes(q) ||
        m.venue.toLowerCase().includes(q) ||
        m.team1.name.toLowerCase().includes(q) ||
        m.team2.name.toLowerCase().includes(q)
      ) {
        results.push({
          id: m.id,
          type: 'match',
          title: m.title,
          subtitle: `${m.venue} • ${m.status.toUpperCase()} (${m.format.toUpperCase()})`,
          route: `/match/${m.id}`,
        });
      }
    }

    // Search teams
    for (const t of teams) {
      if (
        t.name.toLowerCase().includes(q) ||
        t.shortName.toLowerCase().includes(q)
      ) {
        results.push({
          id: t.id,
          type: 'team',
          title: t.name,
          subtitle: `${t.players.length} Players • Captain: ${t.players.find(p => p.id === t.captainPlayerId)?.name || 'Nominated'}`,
          route: `/teams/${t.id}`,
        });
      }
    }

    // Search tournaments
    for (const tr of tournaments) {
      if (tr.name.toLowerCase().includes(q)) {
        results.push({
          id: tr.id,
          type: 'tournament',
          title: tr.name,
          subtitle: `${tr.format.toUpperCase()} • ${tr.teams.length} Teams • ${tr.status.toUpperCase()}`,
          route: `/tournament/${tr.id}`,
        });
      }
    }

    return results;
  }, [query, matches, teams, tournaments]);

  return (
    <View style={styles.container}>
      {/* Search Bar Header */}
      <View style={styles.searchHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search matches, teams, tournaments..."
            placeholderTextColor="#64748B"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={searchResults}
        keyExtractor={(item) => `${item.type}_${item.id}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.resultCard}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.8}
          >
            <View style={styles.iconCircle}>
              <Ionicons
                name={
                  item.type === 'match'
                    ? 'tennisball'
                    : item.type === 'team'
                    ? 'people'
                    : 'trophy'
                }
                size={18}
                color="#00E676"
              />
            </View>
            <View style={styles.resultInfo}>
              <Text style={styles.resultTitle}>{item.title}</Text>
              <Text style={styles.resultSub}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          query.trim().length > 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No matching entities found for "{query}".</Text>
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="search-outline" size={48} color="#475569" />
              <Text style={styles.emptyTitle}>Operational Search</Text>
              <Text style={styles.emptySub}>
                Search by match venue, team name, tournament series, or club name.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D1E',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#070D1E',
    borderBottomWidth: 1,
    borderBottomColor: '#1E2C4F',
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C142B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E2C4F',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    marginHorizontal: 8,
  },
  listContent: {
    padding: 16,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C142B',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E2C4F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  resultSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  emptyBox: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
  },
});
