import React, { useEffect, useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';

import type { RootStackParamList, UserTabParamList, OrganizerTabParamList } from '@/navigation/AppNavigator';
import { TourOverlay, type SpotlightRect } from '@/components/TourOverlay';
import { TourTooltip } from '@/components/TourTooltip';
import { useTourSpotlight } from '@/context/TourSpotlightContext';
import { useUserGuide } from '@/hooks/useUserGuide';
import { useIsMobileBrowser } from '@/hooks/use-mobile';
import type { TourTarget } from '@/config/tourConfig';

const CHAT_STEPS_WITH_CUSTOM_SPOTLIGHT = ['chats-pending', 'chats-active'];

/** Height of the bottom tab bar on mobile. Align with AppNavigator tabBarStyle (iOS 85, Android 65, web 72). */
const MOBILE_BOTTOM_BAR_HEIGHT =
  Platform.OS === 'ios' ? 85 : Platform.OS === 'web' ? 72 : 65;
/** Gap between the tour tooltip and the top of the bottom bar so the tooltip sits right above it. */
const TOOLTIP_GAP_ABOVE_BAR = 16;

type Props = {
  /**
   * Prevent the tour from auto-starting (based on profile flag). Manual replay still works.
   */
  suppressAuto?: boolean;
};

function getUserTabIndexForPlatform(tab: keyof UserTabParamList, isMobileBrowser: boolean): number {
  // Mobile order from AppNavigator: Matches, Chats, Search, Events, Profile
  const mobileOrder: (keyof UserTabParamList)[] = ['Matches', 'Chats', 'Search', 'Events', 'Profile'];
  // Web order from AppNavigator: Matches, Events, Chats, Search, Profile
  const webOrder: (keyof UserTabParamList)[] = ['Matches', 'Events', 'Chats', 'Search', 'Profile'];
  // Use mobile order for native mobile or phone web browsers, web order for desktop web
  const order = (Platform.OS !== 'web' || isMobileBrowser) ? mobileOrder : webOrder;
  return Math.max(0, order.indexOf(tab));
}

function getOrganizerTabIndex(tab: keyof OrganizerTabParamList): number {
  const order: (keyof OrganizerTabParamList)[] = ['Posts', 'Create', 'OrganizerProfile'];
  return Math.max(0, order.indexOf(tab));
}

function computeSpotlightRect(
  target: TourTarget,
  dims: { width: number; height: number },
  isMobileBrowser: boolean
): SpotlightRect | null {
  const { width: W, height: H } = dims;

  if (target.kind === 'none') return null;
  if (target.kind === 'mainScreen') return null;

  // Use mobile bottom tab spotlight for native mobile or phone web browsers
  if (Platform.OS !== 'web' || isMobileBrowser) {
    // Mobile bottom tab spotlight (align with AppNavigator tabBarStyle height).
    const tabBarH = MOBILE_BOTTOM_BAR_HEIGHT + 8; // visual height for spotlight
    if (target.kind === 'userTab') {
      const idx = getUserTabIndexForPlatform(target.tab, isMobileBrowser);
      const w = W / 5;
      return { x: idx * w + 6, y: H - tabBarH + 10, width: w - 12, height: tabBarH - 20, radius: 16 };
    }
    if (target.kind === 'organizerTab') {
      const idx = getOrganizerTabIndex(target.tab);
      const w = W / 3;
      return { x: idx * w + 6, y: H - tabBarH + 10, width: w - 12, height: tabBarH - 20, radius: 16 };
    }
    return null;
  }

  // Web sidebar spotlight (approximate, based on AppNavigator styles) - only for desktop web
  const sidebarW = 300;
  const x = 14;
  const w = sidebarW - 28;
  const headerApproxH = 160;
  const tabButtonApproxH = 60;
  const gap = 6;

  if (target.kind === 'userTab') {
    const idx = getUserTabIndexForPlatform(target.tab, isMobileBrowser);
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
  const isMobileBrowser = useIsMobileBrowser();
  const tourSpotlight = useTourSpotlight();
  const { active, steps, step, stepIndex, userType, next, prev, skip } = useUserGuide({ suppressAuto });

  // Sync current step id to context so ChatsScreen/ChatsTabs can show the right sub-tab and report rects.
  useEffect(() => {
    if (tourSpotlight) {
      tourSpotlight.setCurrentStepId(active && step ? step.id : null);
    }
  }, [active, step?.id, tourSpotlight]);

  const spotlight = useMemo(() => {
    if (!step) return null;
    const useReported =
      step.id && CHAT_STEPS_WITH_CUSTOM_SPOTLIGHT.includes(step.id) && tourSpotlight?.reportedSpotlightRect;
    if (useReported) return tourSpotlight!.reportedSpotlightRect;
    return computeSpotlightRect(step.target, { width, height }, isMobileBrowser);
  }, [step, width, height, isMobileBrowser, tourSpotlight?.reportedSpotlightRect]);

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

  // On mobile (native or mobile web), place the tooltip right above the bottom sidebar.
  const tooltipContainerStyle =
    Platform.OS !== 'web' || isMobileBrowser
      ? { paddingBottom: MOBILE_BOTTOM_BAR_HEIGHT + TOOLTIP_GAP_ABOVE_BAR }
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


