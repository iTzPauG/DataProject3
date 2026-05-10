/**
 * Icon — monochrome geometric iconography built from View primitives.
 *
 * The WHIM aesthetic explicitly avoids emoji fallbacks and Ionicons on web,
 * both of which feel templated.  Every icon in this file is drawn with
 * plain RN <View> nodes so it renders identically on web and native.
 *
 * Each icon receives { size, color, strokeWidth? } and respects a 24×24
 * conceptual viewBox — all internal measurements scale by (size / 24).
 *
 * Add new icons at the bottom of ICONS.  Keep strokes uniform (~1.5/24)
 * to preserve family resemblance.
 */
import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';

type IconRenderer = (args: {
  size: number;
  color: string;
  strokeWidth: number;
}) => React.ReactElement;

export type IconName =
  | 'search'
  | 'close'
  | 'close-circle'
  | 'chevron-right'
  | 'chevron-down'
  | 'chevron-left'
  | 'arrow-left'
  | 'tag'
  | 'arrow-right'
  | 'crosshair'
  | 'pin'
  | 'map'
  | 'compass'
  | 'for-you'
  | 'person'
  | 'bookmark'
  | 'sliders'
  | 'plus'
  | 'check'
  | 'dot'
  | 'ring'
  | 'triangle'
  | 'logout'
  | 'star'
  | 'star-outline';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

// ── primitive helpers ────────────────────────────────────────────────────
const box = (s: Partial<ViewStyle>): ViewStyle => ({ position: 'absolute', ...s });

// build a chevron (corner) glyph rotated to a cardinal direction
function chevron(size: number, color: string, sw: number, rotate: string) {
  const side = size * 0.38;
  return (
    <View
      style={{
        width: side,
        height: side,
        borderTopWidth: sw,
        borderRightWidth: sw,
        borderColor: color,
        transform: [{ rotate }],
      }}
    />
  );
}

// ── icon set ─────────────────────────────────────────────────────────────
const ICONS: Record<IconName, IconRenderer> = {
  search: ({ size, color, strokeWidth: sw }) => {
    const ringSize = size * 0.62;
    const handleLen = size * 0.28;
    return (
      <View style={{ width: size, height: size }}>
        <View
          style={box({
            top: size * 0.08,
            left: size * 0.08,
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderWidth: sw,
            borderColor: color,
          })}
        />
        <View
          style={box({
            bottom: size * 0.14,
            right: size * 0.12,
            width: handleLen,
            height: sw,
            backgroundColor: color,
            transform: [{ rotate: '45deg' }],
            borderRadius: sw / 2,
          })}
        />
      </View>
    );
  },

  close: ({ size, color, strokeWidth: sw }) => {
    const len = size * 0.7;
    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={box({
            width: len,
            height: sw,
            backgroundColor: color,
            transform: [{ rotate: '45deg' }],
            borderRadius: sw / 2,
          })}
        />
        <View
          style={box({
            width: len,
            height: sw,
            backgroundColor: color,
            transform: [{ rotate: '-45deg' }],
            borderRadius: sw / 2,
          })}
        />
      </View>
    );
  },

  'close-circle': ({ size, color, strokeWidth: sw }) => {
    const inner = size * 0.42;
    return (
      <View style={{ width: size, height: size }}>
        <View
          style={box({
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: sw,
            borderColor: color,
          })}
        />
        <View
          style={box({
            top: (size - inner) / 2,
            left: (size - inner) / 2,
            width: inner,
            height: inner,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <View
            style={box({
              width: inner,
              height: sw,
              backgroundColor: color,
              transform: [{ rotate: '45deg' }],
              top: inner / 2 - sw / 2,
              borderRadius: sw / 2,
            })}
          />
          <View
            style={box({
              width: inner,
              height: sw,
              backgroundColor: color,
              transform: [{ rotate: '-45deg' }],
              top: inner / 2 - sw / 2,
              borderRadius: sw / 2,
            })}
          />
        </View>
      </View>
    );
  },

  'chevron-right': ({ size, color, strokeWidth: sw }) => (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {chevron(size, color, sw, '45deg')}
    </View>
  ),

  'chevron-left': ({ size, color, strokeWidth: sw }) => (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {chevron(size, color, sw, '-135deg')}
    </View>
  ),

  'chevron-down': ({ size, color, strokeWidth: sw }) => (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {chevron(size, color, sw, '135deg')}
    </View>
  ),

  'arrow-left': ({ size, color, strokeWidth: sw }) => {
    const barLen = size * 0.7;
    const headSide = size * 0.34;
    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={box({
            width: barLen,
            height: sw,
            backgroundColor: color,
            borderRadius: sw / 2,
          })}
        />
        <View
          style={box({
            left: size * 0.15,
            width: headSide,
            height: headSide,
            borderLeftWidth: sw,
            borderTopWidth: sw,
            borderColor: color,
            transform: [{ rotate: '-45deg' }],
          })}
        />
      </View>
    );
  },

  'arrow-right': ({ size, color, strokeWidth: sw }) => {
    const barLen = size * 0.7;
    const headSide = size * 0.34;
    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={box({
            width: barLen,
            height: sw,
            backgroundColor: color,
            borderRadius: sw / 2,
          })}
        />
        <View
          style={box({
            right: size * 0.15,
            width: headSide,
            height: headSide,
            borderRightWidth: sw,
            borderTopWidth: sw,
            borderColor: color,
            transform: [{ rotate: '45deg' }],
          })}
        />
      </View>
    );
  },

  // crosshair — editorial "recenter on me" glyph
  crosshair: ({ size, color, strokeWidth: sw }) => {
    const ringSize = size * 0.62;
    const tickLen = size * 0.18;
    const dot = size * 0.1;
    return (
      <View style={{ width: size, height: size }}>
        {/* outer ring */}
        <View
          style={box({
            top: (size - ringSize) / 2,
            left: (size - ringSize) / 2,
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderWidth: sw,
            borderColor: color,
          })}
        />
        {/* four ticks */}
        <View
          style={box({
            top: 0,
            left: size / 2 - sw / 2,
            width: sw,
            height: tickLen,
            backgroundColor: color,
            borderRadius: sw / 2,
          })}
        />
        <View
          style={box({
            bottom: 0,
            left: size / 2 - sw / 2,
            width: sw,
            height: tickLen,
            backgroundColor: color,
            borderRadius: sw / 2,
          })}
        />
        <View
          style={box({
            left: 0,
            top: size / 2 - sw / 2,
            width: tickLen,
            height: sw,
            backgroundColor: color,
            borderRadius: sw / 2,
          })}
        />
        <View
          style={box({
            right: 0,
            top: size / 2 - sw / 2,
            width: tickLen,
            height: sw,
            backgroundColor: color,
            borderRadius: sw / 2,
          })}
        />
        {/* centre dot */}
        <View
          style={box({
            top: (size - dot) / 2,
            left: (size - dot) / 2,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: color,
          })}
        />
      </View>
    );
  },

  // pin — teardrop map marker, outlined
  pin: ({ size, color, strokeWidth: sw }) => {
    const head = size * 0.56;
    const stemHeight = size * 0.24;
    return (
      <View style={{ width: size, height: size, alignItems: 'center' }}>
        <View
          style={box({
            top: size * 0.08,
            width: head,
            height: head,
            borderRadius: head / 2,
            borderWidth: sw,
            borderColor: color,
          })}
        />
        {/* small inner circle */}
        <View
          style={box({
            top: size * 0.08 + (head - head * 0.28) / 2,
            width: head * 0.28,
            height: head * 0.28,
            borderRadius: (head * 0.28) / 2,
            backgroundColor: color,
          })}
        />
        {/* stem triangle approximated by rotated square */}
        <View
          style={box({
            top: size * 0.08 + head * 0.68,
            width: head * 0.36,
            height: head * 0.36,
            borderRightWidth: sw,
            borderBottomWidth: sw,
            borderColor: color,
            transform: [{ rotate: '45deg' }],
            backgroundColor: 'transparent',
          })}
        />
        {/* stem fill to cover circle bottom */}
        <View
          style={box({
            top: size * 0.08 + head * 0.72,
            width: head * 0.12,
            height: stemHeight * 0.6,
            backgroundColor: 'transparent',
          })}
        />
      </View>
    );
  },

  // Folded paper map — 3-panel rectangle with fold creases + road line + location dot
  map: ({ size, color, strokeWidth: sw }) => {
    const w = size * 0.86;
    const h = size * 0.68;
    const ox = (size - w) / 2;
    const oy = (size - h) / 2;
    const pw = w / 3;
    const dotD = sw * 2.4;
    return (
      <View style={{ width: size, height: size }}>
        {/* outer border */}
        <View style={box({ top: oy, left: ox, width: w, height: h, borderWidth: sw, borderColor: color, borderRadius: 2 })} />
        {/* left fold crease */}
        <View style={box({ top: oy, left: ox + pw, width: sw * 0.75, height: h, backgroundColor: color })} />
        {/* right fold crease */}
        <View style={box({ top: oy, left: ox + pw * 2, width: sw * 0.75, height: h, backgroundColor: color })} />
        {/* horizontal road on middle panel */}
        <View style={box({ top: oy + h * 0.55, left: ox + pw + sw, width: pw - sw * 2, height: sw * 0.8, backgroundColor: color, borderRadius: sw / 2 })} />
        {/* location dot on middle panel */}
        <View style={box({ top: oy + h * 0.28 - dotD / 2, left: ox + pw + pw / 2 - dotD / 2, width: dotD, height: dotD, borderRadius: dotD / 2, backgroundColor: color })} />
      </View>
    );
  },

  // Compass — outer ring + solid N needle (filled arrow) + hollow S needle + pivot
  compass: ({ size, color, strokeWidth: sw }) => {
    const ring = size * 0.90;
    const nH = size * 0.36;    // north needle half-height (above center)
    const sH = size * 0.22;    // south needle half-height (below center)
    const nW = Math.max(sw * 3, size * 0.13); // north needle width
    const sW = Math.max(sw * 2, size * 0.09); // south needle width
    const pivotD = size * 0.10;
    return (
      <View style={{ width: size, height: size }}>
        {/* Outer ring */}
        <View style={box({ top: (size - ring) / 2, left: (size - ring) / 2, width: ring, height: ring, borderRadius: ring / 2, borderWidth: sw, borderColor: color })} />
        {/* North needle — solid, tapered to a point at top */}
        <View style={box({ top: size / 2 - nH, left: size / 2 - nW / 2, width: nW, height: nH, backgroundColor: color, borderTopLeftRadius: nW / 2, borderTopRightRadius: nW / 2 })} />
        {/* South needle — stroke only, shorter */}
        <View style={box({ top: size / 2, left: size / 2 - sW / 2, width: sW, height: sH, borderWidth: sw * 0.75, borderColor: color, borderTopWidth: 0, borderBottomLeftRadius: sW / 2, borderBottomRightRadius: sW / 2, backgroundColor: 'transparent', opacity: 0.55 })} />
        {/* Pivot dot */}
        <View style={box({ top: (size - pivotD) / 2, left: (size - pivotD) / 2, width: pivotD, height: pivotD, borderRadius: pivotD / 2, backgroundColor: color })} />
      </View>
    );
  },

  // Target / bullseye — 3 concentric rings converging to a filled centre dot
  'for-you': ({ size, color, strokeWidth: sw }) => {
    const d1 = size * 0.26;   // filled centre dot
    const d2 = size * 0.54;   // middle ring
    const d3 = size * 0.86;   // outer ring
    return (
      <View style={{ width: size, height: size }}>
        <View style={box({ top: (size - d3) / 2, left: (size - d3) / 2, width: d3, height: d3, borderRadius: d3 / 2, borderWidth: sw, borderColor: color })} />
        <View style={box({ top: (size - d2) / 2, left: (size - d2) / 2, width: d2, height: d2, borderRadius: d2 / 2, borderWidth: sw, borderColor: color })} />
        <View style={box({ top: (size - d1) / 2, left: (size - d1) / 2, width: d1, height: d1, borderRadius: d1 / 2, backgroundColor: color })} />
      </View>
    );
  },

  person: ({ size, color, strokeWidth: sw }) => {
    const headSize = size * 0.36;
    const bodyW = size * 0.64;
    const bodyH = size * 0.38;
    return (
      <View style={{ width: size, height: size }}>
        <View
          style={box({
            top: size * 0.08,
            left: (size - headSize) / 2,
            width: headSize,
            height: headSize,
            borderRadius: headSize / 2,
            borderWidth: sw,
            borderColor: color,
          })}
        />
        <View
          style={box({
            bottom: size * 0.06,
            left: (size - bodyW) / 2,
            width: bodyW,
            height: bodyH,
            borderTopLeftRadius: bodyW / 2,
            borderTopRightRadius: bodyW / 2,
            borderWidth: sw,
            borderColor: color,
            borderBottomWidth: 0,
          })}
        />
      </View>
    );
  },

  // Calendar — body frame + header stripe + 2 binding rings at top
  bookmark: ({ size, color, strokeWidth: sw }) => {
    const w = size * 0.74;
    const h = size * 0.68;
    const ox = (size - w) / 2;
    const oy = size * 0.16;
    const headerH = h * 0.30;
    const ringW = sw * 2.2;
    const ringH = size * 0.15;
    const ringY = oy - ringH * 0.52;
    return (
      <View style={{ width: size, height: size }}>
        {/* body */}
        <View style={box({ top: oy, left: ox, width: w, height: h, borderWidth: sw, borderColor: color, borderRadius: 3 })} />
        {/* header divider */}
        <View style={box({ top: oy + headerH, left: ox, width: w, height: sw, backgroundColor: color })} />
        {/* left ring */}
        <View style={box({ top: ringY, left: ox + w * 0.25 - ringW / 2, width: ringW, height: ringH, borderRadius: ringW / 2, backgroundColor: color })} />
        {/* right ring */}
        <View style={box({ top: ringY, left: ox + w * 0.75 - ringW / 2, width: ringW, height: ringH, borderRadius: ringW / 2, backgroundColor: color })} />
      </View>
    );
  },

  sliders: ({ size, color, strokeWidth: sw }) => {
    const lineLen = size * 0.72;
    const dot = size * 0.22;
    const y1 = size * 0.28;
    const y2 = size * 0.72;
    return (
      <View style={{ width: size, height: size }}>
        <View
          style={box({
            top: y1 - sw / 2,
            left: (size - lineLen) / 2,
            width: lineLen,
            height: sw,
            backgroundColor: color,
            borderRadius: sw / 2,
          })}
        />
        <View
          style={box({
            top: y1 - dot / 2,
            left: size * 0.55,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: color,
          })}
        />
        <View
          style={box({
            top: y2 - sw / 2,
            left: (size - lineLen) / 2,
            width: lineLen,
            height: sw,
            backgroundColor: color,
            borderRadius: sw / 2,
          })}
        />
        <View
          style={box({
            top: y2 - dot / 2,
            left: size * 0.2,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: color,
          })}
        />
      </View>
    );
  },

  plus: ({ size, color, strokeWidth: sw }) => {
    const len = size * 0.46;
    const circleD = size * 0.88;
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={box({
          top: (size - circleD) / 2,
          left: (size - circleD) / 2,
          width: circleD,
          height: circleD,
          borderRadius: circleD / 2,
          borderWidth: sw,
          borderColor: color,
        })} />
        <View style={box({ width: len, height: sw, backgroundColor: color, borderRadius: sw / 2 })} />
        <View style={box({ width: sw, height: len, backgroundColor: color, borderRadius: sw / 2 })} />
      </View>
    );
  },

  check: ({ size, color, strokeWidth: sw }) => (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={box({
          width: size * 0.28,
          height: size * 0.56,
          borderRightWidth: sw,
          borderBottomWidth: sw,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
          top: size * 0.2,
        })}
      />
    </View>
  ),

  dot: ({ size, color }) => (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size * 0.35,
          height: size * 0.35,
          borderRadius: (size * 0.35) / 2,
          backgroundColor: color,
        }}
      />
    </View>
  ),

  ring: ({ size, color, strokeWidth: sw }) => (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: sw,
        borderColor: color,
      }}
    />
  ),

  triangle: ({ size, color, strokeWidth: sw }) => (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={box({
          width: size * 0.44,
          height: size * 0.44,
          borderTopWidth: sw,
          borderRightWidth: sw,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
        })}
      />
    </View>
  ),

  logout: ({ size, color, strokeWidth: sw }) => {
    const boxW = size * 0.58;
    const boxH = size * 0.72;
    return (
      <View style={{ width: size, height: size }}>
        <View
          style={box({
            top: (size - boxH) / 2,
            left: size * 0.1,
            width: boxW,
            height: boxH,
            borderTopWidth: sw,
            borderBottomWidth: sw,
            borderLeftWidth: sw,
            borderColor: color,
          })}
        />
        {/* arrow */}
        <View
          style={box({
            top: size / 2 - sw / 2,
            left: size * 0.36,
            width: size * 0.56,
            height: sw,
            backgroundColor: color,
            borderRadius: sw / 2,
          })}
        />
        <View
          style={box({
            top: size / 2 - size * 0.18,
            right: size * 0.04,
            width: size * 0.28,
            height: size * 0.28,
            borderRightWidth: sw,
            borderTopWidth: sw,
            borderColor: color,
            transform: [{ rotate: '45deg' }],
          })}
        />
      </View>
    );
  },
  star: ({ size, color }) => (
    <Text style={{ fontSize: size * 0.92, color, textAlign: 'center', width: size, lineHeight: size }}>{'\u2605'}</Text>
  ),
  'star-outline': ({ size, color }) => (
    <Text style={{ fontSize: size * 0.92, color, textAlign: 'center', width: size, lineHeight: size }}>{'\u2606'}</Text>
  ),
  // Price tag icon for "Mis Ofertas"
  tag: ({ size, color, strokeWidth: sw }) => {
    const s = size * 0.72;
    const offset = (size - s) / 2;
    const holeSize = sw * 2.8;
    return (
      <View style={{ width: size, height: size }}>
        <View style={box({
          top: offset,
          left: offset,
          width: s,
          height: s,
          borderWidth: sw,
          borderColor: color,
          borderRadius: 3,
          transform: [{ rotate: '45deg' }],
        })} />
        <View style={box({
          top: offset + size * 0.04,
          left: size / 2 - holeSize / 2,
          width: holeSize,
          height: holeSize,
          borderRadius: holeSize / 2,
          backgroundColor: color,
        })} />
      </View>
    );
  },
};

export default function Icon({
  name,
  size = 20,
  color = '#EDEBE3',
  strokeWidth,
  style,
  accessibilityLabel,
}: IconProps): React.ReactElement {
  const renderer = ICONS[name];
  // stroke scales with size — keeps optical weight consistent across sizes
  const sw = strokeWidth ?? Math.max(1.25, Math.round((size / 24) * 1.5 * 2) / 2);
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[{ width: size, height: size }, style]}
    >
      {renderer
        ? renderer({ size, color, strokeWidth: sw })
        : ICONS.dot({ size, color, strokeWidth: sw })}
    </View>
  );
}
