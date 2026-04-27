import React from 'react';
import { Platform, View } from 'react-native';

import type { ComponentType } from 'react';

import type { MapProps } from './types';

let MapImpl: ComponentType<MapProps>;

try {
  MapImpl = (
    Platform.OS === 'web'
      ? require('./Map.web').default
      : require('./Map.native').default
  ) as ComponentType<MapProps>;
} catch (error) {
  console.error('[Map] Failed to load platform map implementation', error);
  MapImpl = function MapFallback() {
    return <View style={{ flex: 1 }} />;
  };
}

export default MapImpl;
export type { MapProps } from './types';
