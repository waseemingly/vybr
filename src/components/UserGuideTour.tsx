import React, { useEffect, useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';

import type { RootStackParamList, UserTabParamList, OrganizerTabParamList } from '@/navigation/AppNavigator';
import { TourOverlay, type SpotlightRect } from '@/components/TourOverlay';
import { TourTooltip } from '@/components/TourTooltip';
import { useUserGuide } from '@/hooks/useUserGuide';
import type { TourTarget } from '@/config/tourConfig';

type Props = {
  /**
   * Prevent the tour from auto-starting (based on profile flag). Manual replay still works.
   */
  suppressAuto?: boolean;
};

function getUserTabIndexForPlatform(tab: keyof UserTabParamList): number {
  // Mobile order from AppNavigator: Matches, Chats, Search, Events, Profile
  const mobileOrder: (keyof UserTabParamList)[] = ['Matches', 'Chats', 'Search', 'Events', 'Profile'];
  // Web order from AppNavigator: Matches, Events, Chats, Search, Profile
  const webOrder: (keyof UserTabParamList)[] = ['Matches', 'Events', 'Chats', 'Search', 'Profile'];
  const order = Platform.OS === 'web' ? webOrder : mobileOrder;
  return Math.max(0, order.indexOf(tab));
}

function getOrganizerTabIndex(tab: keyof OrganizerTabParamList): number {
  const order: (keyof OrganizerTabParamList)[] = ['Posts', 'Create', 'OrganizerProfile'];
  return Math.max(0, order.indexOf(tab));
}

function computeSpotlightRect(
  target: TourTarget,
  dims: { width: number; height: number }
): SpotlightRect | null {
  const { width: W, height: H } = dims;

  if (target.kind === 'none') return null;
  if (target.kind === 'mainScreen') return null;

  if (Platform.OS !== 'web') {
    // Mobile bottom tab spotlight (approximate).
    if (target.kind === 'userTab') {
      const idx = getUserTabIndexForPlatform(target.tab);
      const tabBarH = 92;
      const w = W / 5;
      return { x: idx * w + 6, y: H - tabBarH + 10, width: w - 12, height: tabBarH - 20, radius: 16 };
    }
    if (target.kind === 'organizerTab') {
      const idx = getOrganizerTabIndex(target.tab);
      const tabBarH = 92;
      const w = W / 3;
      return { x: idx * w + 6, y: H - tabBarH + 10, width: w - 12, height: tabBarH - 20, radius: 16 };
    }
    return null;
  }

  // Web sidebar spotlight (approximate, based on AppNavigator styles).
  const sidebarW = 300;
  const x = 14;
  const w = sidebarW - 28;
  const headerApproxH = 160;
  const tabButtonApproxH = 60;
  const gap = 6;

  if (target.kind === 'userTab') {
    const idx = getUserTabIndexForPlatform(target.tab);
    const y = headerApproxH + idx * (tabButtonApproxH + gap);
    return { x, y, width: w, height: tabButtonApproxH, radius: 14 };
  }
  if (target.kind === 'organizerTab') {
    const idx = getOrganizerTabIndex(target.tab);
    const y = headerApproxH + idx * (tabButtonApproxH + gap);
    return { x, y, width: w, height: tabButtonApproxH, radius: 14 };
  }
  return null;
}

export default function UserGuideTour({ suppressAuto }: Props) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { width, height } = useWindowDimensions();
  const { active, steps, step, stepIndex, userType, next, prev, skip } = useUserGuide({ suppressAuto });

  const spotlight = useMemo(() => {
    if (!step) return null;
    return computeSpotlightRect(step.target, { width, height });
  }, [step, width, height]);

  // When a step targets a tab, navigate to it so the UI matches the tooltip.
  useEffect(() => {
    if (!active || !step || !userType) return;
    if (step.target.kind === 'userTab') {
      navigation.navigate('MainApp', { screen: 'UserTabs', params: { screen: step.target.tab } } as any);
    } else if (step.target.kind === 'organizerTab') {
      navigation.navigate('MainApp', { screen: 'OrganizerTabs', params: { screen: step.target.tab } } as any);
    } else if (step.target.kind === 'mainScreen') {
      navigation.navigate('MainApp', { screen: step.target.screen } as any);
    }
  }, [active, step, userType, navigation]);

  if (!active || !step) return null;

  // On mobile, if we're spotlighting bottom tabs, lift the tooltip so it doesn't cover the highlighted area.
  const tooltipContainerStyle =
    Platform.OS !== 'web'
      ? spotlight
        ? spotlight.y > height * 0.6
          ? { paddingBottom: 24 + Math.min(200, spotlight.height + 80) }
          : undefined
        : // No spotlight (welcome + screen-level steps): lift the tooltip so it doesn't sit on the bottom edge
          { paddingBottom: 24 + 160 }
      : undefined;

  return (
    <TourOverlay visible={active} spotlight={spotlight}>
      <TourTooltip
        title={step.title}
        description={step.description}
        stepLabel={`${stepIndex + 1} / ${steps.length}`}
        canGoBack={stepIndex > 0}
        isLast={stepIndex === steps.length - 1}
        onPrev={prev}
        onNext={next}
        onSkip={skip}
        containerStyle={tooltipContainerStyle}
      />
    </TourOverlay>
  );
}


