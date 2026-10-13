import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CricketProvider } from '../context/CricketContext';
import { ThemeProvider, useTheme } from '../theme/useTheme';

function RootNavigation() {
  const { theme, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.surface,
          },
          headerTintColor: theme.textPrimary,
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 17,
            color: theme.textPrimary,
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: theme.canvas,
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
            title: 'Live Scorer',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="teams/[id]"
          options={{
            title: 'Team Sheet',
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
            title: 'Account & Sign In',
            headerBackTitle: 'Back',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="profile/index"
          options={{
            title: 'Player Hub',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="tournament/[id]"
          options={{
            title: 'Tournament Details',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="tournaments/create"
          options={{
            title: 'Organize Tournament',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="leaderboards/index"
          options={{
            title: 'Tournament Leaderboards',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="awards/index"
          options={{
            title: 'Awards & Honours',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="performance/index"
          options={{
            title: 'Performance Analysis',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="go-live/index"
          options={{
            title: 'Live Score Sharing',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="associations/index"
          options={{
            title: 'Associations & Leagues',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="clubs/index"
          options={{
            title: 'Clubs Directory',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="app-code/index"
          options={{
            title: 'App Code',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="inbox/index"
          options={{
            title: 'Inbox & Invites',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="search/index"
          options={{
            title: 'Search Directory',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="help/index"
          options={{
            title: 'Help & Support',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="notifications/index"
          options={{
            title: 'Notifications',
            headerBackTitle: 'Back',
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <CricketProvider>
        <RootNavigation />
      </CricketProvider>
    </ThemeProvider>
  );
}
