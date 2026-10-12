import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../utils/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: '#070D1E',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '900',
          fontSize: 18,
          letterSpacing: 0.5,
        },
        tabBarStyle: {
          backgroundColor: '#0C142B',
          borderTopColor: '#1E2C4F',
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#00E676',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: {
          fontWeight: '800',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'Cric — Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-cricket"
        options={{
          title: 'My Cricket',
          headerTitle: 'My Cricket',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cricket" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="new-match"
        options={{
          title: 'Start Match',
          headerTitle: 'Organize Match',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="teams"
        options={{
          title: 'Teams & Hub',
          headerTitle: 'Clubs & Rosters',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerTitle: 'Settings & Cloud Sync',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
