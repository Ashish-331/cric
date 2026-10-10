import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CricketProvider } from '../context/CricketContext';
import { Colors } from '../utils/colors';

export default function RootLayout() {
  return (
    <CricketProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.primaryDark,
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: '800',
          },
          contentStyle: {
            backgroundColor: Colors.background,
          },
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="match/[id]/index"
          options={{
            title: 'Match Centre',
          }}
        />
        <Stack.Screen
          name="match/[id]/scorer"
          options={{
            title: 'Live Scorer Console',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="teams/[id]"
          options={{
            title: 'Team Roster',
          }}
        />
        <Stack.Screen
          name="player/[id]"
          options={{
            title: 'Career Profile',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="auth/login"
          options={{
            title: 'Mobile Sign In',
            headerBackTitle: 'Back',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="profile/index"
          options={{
            title: 'Player Hub & Records',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="tournament/[id]"
          options={{
            title: 'Tournament Centre',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="tournaments/create"
          options={{
            title: 'Create Tournament',
            headerBackTitle: 'Back',
          }}
        />
      </Stack>
    </CricketProvider>
  );
}
