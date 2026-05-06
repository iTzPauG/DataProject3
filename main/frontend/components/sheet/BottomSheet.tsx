/**
 * BottomSheet — cross-platform (native + web).
 *
 * Drag zone = handle bar + entire sticky header.
 * Content area: captures downward drag only when scroll is at top.
 */
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '../../utils/theme';
import { BottomSheetProps, BottomSheetRef } from './types';

const SCREEN_H = Dimensions.get('window').height;

function pctToPx(pct: string): number {
  return (parseFloat(pct) / 100) * SCREEN_H;
}

const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(
  ({ snapPoints, initialSnapIndex = 1, header, children }, ref) => {
    const { colors } = useTheme();

    const snapHeights = snapPoints.map(pctToPx);
    const minY = SCREEN_H - snapHeights[snapHeights.length - 1]; // fully open
    const maxY = SCREEN_H - snapHeights[0];                      // collapsed

    const initY = SCREEN_H - snapHeights[Math.min(initialSnapIndex, snapHeights.length - 1)];
    const translateY = useRef(new Animated.Value(initY)).current;
    const currentY = useRef(initY);
    const currentIndex = useRef(initialSnapIndex);
    const scrollRef = useRef<ScrollView>(null);
    const atScrollTop = useRef(true);
    const dragging = useRef(false);
    const dragStartY = useRef(0);

    // ── Snap ──────────────────────────────────────────────────────────────
    const snapTo = (index: number) => {
      const i = Math.max(0, Math.min(snapHeights.length - 1, index));
      currentIndex.current = i;
      const target = SCREEN_H - snapHeights[i];
      currentY.current = target;
      Animated.spring(translateY, {
        toValue: target,
        useNativeDriver: false,
        damping: 30,
        stiffness: 300,
        mass: 0.8,
      }).start();
    };

    useEffect(() => {
      translateY.setValue(initY);
      currentY.current = initY;
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useImperativeHandle(ref, () => ({
      snapToIndex: (i) => snapTo(i),
      scrollToIndex: (cardIndex, cardHeight = 360) => {
        scrollRef.current?.scrollTo({ y: cardIndex * cardHeight, animated: true });
      },
    }));

    // ── Shared drag logic ─────────────────────────────────────────────────
    const onMove = (_: any, { dy }: any) => {
      const next = Math.max(minY, Math.min(maxY, dragStartY.current + dy));
      translateY.setValue(next);
    };

    const onRelease = (_: any, { dy, vy }: any) => {
      dragging.current = false;
      const releaseY = dragStartY.current + dy;

      // Find nearest snap by position
      let nearest = currentIndex.current;
      let best = Infinity;
      snapHeights.forEach((h, i) => {
        const d = Math.abs(releaseY - (SCREEN_H - h));
        if (d < best) { best = d; nearest = i; }
      });

      // Velocity override — fast flick jumps one level
      if (vy > 1.2 && nearest > 0) nearest--;
      if (vy < -1.2 && nearest < snapHeights.length - 1) nearest++;

      snapTo(nearest);
    };

    // ── Header drag zone (handle bar + sticky header) ─────────────────────
    const headerPan = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, { dx, dy }) =>
          Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 3,
        onPanResponderGrant: () => {
          dragging.current = true;
          dragStartY.current = currentY.current;
        },
        onPanResponderMove: onMove,
        onPanResponderRelease: onRelease,
        onPanResponderTerminate: onRelease,
      }),
    ).current;

    // ── Content drag zone (only collapse when at scroll top) ──────────────
    const contentPan = useRef(
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, { dy, dx }) =>
          dy > 8 && Math.abs(dy) > Math.abs(dx) && atScrollTop.current,
        onPanResponderGrant: () => {
          dragging.current = true;
          dragStartY.current = currentY.current;
        },
        onPanResponderMove: onMove,
        onPanResponderRelease: onRelease,
        onPanResponderTerminate: onRelease,
      }),
    ).current;

    return (
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface },
          { transform: [{ translateY }] },
        ]}
      >
        {/* ── Drag zone: handle + full sticky header ─── */}
        <View {...headerPan.panHandlers} style={styles.dragZone}>
          {/* Handle pill */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.stroke }]} />
          </View>

          {/* Sticky header content — also draggable */}
          {header != null && (
            <View style={[styles.headerWrap, { borderBottomColor: colors.stroke }]}>
              {header}
            </View>
          )}
        </View>

        {/* ── Scrollable content ── */}
        <View style={styles.scrollOuter} {...contentPan.panHandlers}>
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            scrollEventThrottle={16}
            onScroll={(e) => {
              atScrollTop.current = e.nativeEvent.contentOffset.y <= 2;
            }}
          >
            {children}
          </ScrollView>
        </View>
      </Animated.View>
    );
  },
);

BottomSheet.displayName = 'BottomSheet';
export default BottomSheet;

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_H,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 32,
    overflow: 'hidden',
  },
  // Everything above the scroll is the drag zone
  dragZone: {
    // Cursor on web to signal draggability
    ...(Platform.OS === 'web' ? { cursor: 'grab' } as any : {}),
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
  },
  headerWrap: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scrollOuter: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 80,
    paddingTop: 8,
  },
});
