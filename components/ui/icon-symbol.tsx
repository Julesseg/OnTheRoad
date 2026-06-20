// Android / web fallback for IconSymbol: renders Material Icons. iOS uses native
// SF Symbols (icon-symbol.ios.tsx). The same IconSymbol `name` (an SF Symbol)
// resolves to a Material glyph via the shared mapping, so callers stay
// platform-agnostic and Android gets an icon for every symbol the app uses.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
// Type-only: expo-symbols is an iOS-only native module (SF Symbols). This is the
// Android/web render path, so it must never import it at runtime.
import type { SymbolWeight } from 'expo-symbols';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

import { androidIconName, type IconSymbolName } from './icon-mapping';

export type { IconSymbolName };

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on
 * Android and web. The `name` is an SF Symbol; Android resolves it to a Material
 * glyph via the mapping in icon-mapping.ts.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={androidIconName(name)} style={style} />;
}
