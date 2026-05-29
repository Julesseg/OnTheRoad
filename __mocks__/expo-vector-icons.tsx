// Test stub for @expo/vector-icons – renders nothing but avoids the JSX parse
// error from the native createIconSet.js that ships inside the package.
import React from 'react';

type IconProps = {
  name?: string;
  size?: number;
  color?: string;
  style?: unknown;
};

const Stub = (_props: IconProps) => React.createElement('span', { 'data-icon': _props.name });

export default Stub;

// Named exports used by icon sets
export const MaterialIcons = Stub;
export const Ionicons = Stub;
export const FontAwesome = Stub;
export const FontAwesome5 = Stub;
export const AntDesign = Stub;
export const Entypo = Stub;
export const EvilIcons = Stub;
export const Feather = Stub;
export const Foundation = Stub;
export const MaterialCommunityIcons = Stub;
export const Octicons = Stub;
export const SimpleLineIcons = Stub;
export const Zocial = Stub;
