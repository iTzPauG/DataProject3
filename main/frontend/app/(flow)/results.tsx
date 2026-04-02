/**
 * results.tsx — Redirect to results-map.
 * The map view is now the primary results screen.
 * This file exists as a fallback for any remaining navigation references.
 */
import { Redirect } from 'expo-router';
import React from 'react';

export default function ResultsScreen() {
  return <Redirect href="/(flow)/results-map" />;
}
