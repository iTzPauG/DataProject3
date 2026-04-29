import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  current: number; // 1-based
  total: number;
}

export default function StepProgressBar({ current, total }: Props) {
  return (
    <View style={styles.track}>
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const filled = step <= current;
        const isActive = step === current;
        return (
          <View
            key={i}
            style={[
              styles.segment,
              filled && styles.segmentFilled,
              isActive && styles.segmentActive,
              i < total - 1 && styles.segmentGap,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E5EA',
  },
  segmentFilled: {
    backgroundColor: '#FF6B35',
  },
  segmentActive: {
    backgroundColor: '#FF6B35',
  },
  segmentGap: {
    marginRight: 6,
  },
});
