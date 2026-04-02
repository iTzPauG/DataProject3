import { useState, useEffect } from 'react';
import { Dimensions, Platform } from 'react-native';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

interface DeviceInfo {
  type: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
}

export const useDeviceType = (): DeviceInfo => {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  const { width, height } = dimensions;

  let type: DeviceType = 'mobile';
  if (Platform.OS === 'web') {
    if (width >= 1024) {
      type = 'desktop';
    } else if (width >= 768) {
      type = 'tablet';
    } else {
      type = 'mobile';
    }
  } else {
    // On native, we use width-based heuristics
    if (width >= 768) {
      type = 'tablet';
    } else {
      type = 'mobile';
    }
  }

  return {
    type,
    isMobile: type === 'mobile',
    isTablet: type === 'tablet',
    isDesktop: type === 'desktop',
    width,
    height,
  };
};
