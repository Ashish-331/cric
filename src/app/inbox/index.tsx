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

interface InboxItem {
  id: string;
  category: 'invite' | 'scorer' | 'entry' | 'result' | 'system';
  title: string;
  message: string;
  timeAgo: string;
  isRead: boolean;
  route?: string;
}

const DEFAULT_INBOX_ITEMS: InboxItem[] = [
  {
    id: 'inb_1',
    category: 'scorer',
    title: 'Scorer Assignment Authorized',
    message: 'You have been designated official scorer for Warriors XI vs Royal Strikers. Your scoring authority epoch is active.',
    timeAgo: '15m ago',
    isRead: false,
    route: '/(tabs)/index',
  },
  {
    id: 'inb_2',
    category: 'entry',
    title: 'Tournament Entry Approved',
    message: 'District Cup 2026 organizer approved Royal Strikers squad application for Group A league stage.',
    timeAgo: '2h ago',
    isRead: false,
    route: '/(tabs)/my-cricket',
  },
  {
    id: 'inb_3',
    category: 'result',
    title: 'Match Result Awaiting Approval',
    message: 'Match #4 result submitted by scorer: Warriors XI won by 18 runs. Review and approve official standing points.',
    timeAgo: '1d ago',
    isRead: true,
    route: '/(tabs)/index',
  },
];

import { supabase } from '../../services/supabaseClient';

export default function InboxScreen() {
  const [items, setItems] = useState<InboxItem[]>(DEFAULT_INBOX_ITEMS);

  React.useEffect(() => {
    let isMounted = true;
    async function fetchNotifications() {
      try {
        const { data } = await supabase
          .from('notification_records')
          .select('*')
          .order('created_at', { ascending: false });

        if (data && data.length > 0 && isMounted) {
          const mapped: InboxItem[] = data.map((n: any) => ({
            id: n.id,
            category:
              n.category === 'scorer_assignment'
                ? 'scorer'
                : n.category === 'entry_update'
                ? 'entry'
                : n.category === 'result_approval'
                ? 'result'
                : 'system',
            title: n.title,
            message: n.message,
            timeAgo: 'Recent',
            isRead: n.is_read,
            route: n.action_route || '/(tabs)/my-cricket',
          }));
          setItems(mapped);
        }
      } catch (e) {
        // Fallback to defaults offline
      }
    }
    fetchNotifications();
    return () => {
      isMounted = false;
    };
  }, []);

  const markAllRead = async () => {
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    try {
      await supabase
        .from('notification_records')
        .update({ is_read: true })
        .eq('is_read', false);
    } catch (e) {
      // Local fallback
    }
  };

  const handleItemPress = (item: InboxItem) => {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isRead: true } : i))
    );
    if (item.route) {
      router.push(item.route as any);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transactional Inbox</Text>
        <TouchableOpacity style={styles.markReadBtn} onPress={markAllRead}>
          <Text style={styles.markReadText}>Mark read</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.itemCard, !item.isRead && styles.unreadCard]}
            onPress={() => handleItemPress(item)}
            activeOpacity={0.8}
          >
            <View style={styles.iconCircle}>
              <Ionicons
                name={
                  item.category === 'scorer'
                    ? 'flash'
                    : item.category === 'entry'
                    ? 'shield-checkmark'
                    : item.category === 'result'
                    ? 'trophy'
                    : 'mail'
                }
                size={18}
                color={!item.isRead ? '#00E676' : '#94A3B8'}
              />
            </View>

            <View style={styles.itemContent}>
              <View style={styles.itemHeaderRow}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.timeText}>{item.timeAgo}</Text>
              </View>
              <Text style={styles.messageText}>{item.message}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="mail-open-outline" size={48} color="#475569" />
            <Text style={styles.emptyTitle}>Inbox Empty</Text>
            <Text style={styles.emptySub}>
              Official fixture assignments, entry updates, and result notices will appear here.
            </Text>
          </View>
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
  markReadBtn: {
    padding: 6,
  },
  markReadText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00E676',
  },
  listContent: {
    padding: 16,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#0C142B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  unreadCard: {
    borderColor: '#00E676',
    backgroundColor: '#071520',
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
  itemContent: {
    flex: 1,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 11,
    color: '#64748B',
  },
  messageText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 18,
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
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
  },
});
