import React, { useRef } from "react";
import {
  Animated,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { IconSymbol } from "./icon-symbol";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Segment<T> {
  /** Unique value for this segment */
  value: T;
  /** Optional text label */
  label?: string;
  /** Optional icon component (e.g. from lucide-react-native or @expo/vector-icons) */
  icon?: React.JSX.Element;
  /** Disable this individual segment */
  disabled?: boolean;
}

export interface SegmentedControlProps<T> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Tint color used for active segment text/icon. Default: '#007AFF' */
  tintColor?: string;
  /** Background color of the track. Default: '#E5E5EA' */
  backgroundColor?: string;
  /** Background color of the active pill. Default: '#FFFFFF' */
  activeColor?: string;
  /** Color for inactive labels and icons. Default: '#8E8E93' */
  inactiveColor?: string;
  /** Height of the control. Default: 36 */
  height?: number;
  /** Font size for labels. Default: 13 */
  fontSize?: number;
  /** Icon size. Default: 16 */
  iconSize?: number;
  /** Gap between icon and label. Default: 5 */
  iconGap?: number;
  /** Show only icons (hides labels). Default: false */
  iconsOnly?: boolean;
  /** Show only labels (hides icons). Default: false */
  labelsOnly?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Style applied to the active pill */
  activeSegmentStyle?: StyleProp<ViewStyle>;
  /** Style applied to each segment touchable */
  segmentStyle?: StyleProp<ViewStyle>;
  /** Style applied to labels */
  labelStyle?: StyleProp<TextStyle>;
  /** Animate the sliding indicator. Default: true */
  animated?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SegmentedControl<T>({
  segments,
  value,
  onChange,
  tintColor = "#007AFF",
  backgroundColor = "#E5E5EA",
  activeColor = "#FFFFFF",
  inactiveColor = "#8E8E93",
  height = 36,
  fontSize = 13,
  iconSize = 16,
  iconGap = 5,
  iconsOnly = false,
  labelsOnly = false,
  style,
  activeSegmentStyle,
  segmentStyle,
  labelStyle,
  animated = true,
}: SegmentedControlProps<T>) {
  const activeIndex = segments.findIndex((s) => s.value === value);
  const segmentCount = segments.length;

  // Animated position of the sliding pill
  const slideAnim = useRef(new Animated.Value(activeIndex)).current;
  const [containerWidth, setContainerWidth] = React.useState(0);

  React.useEffect(() => {
    if (activeIndex < 0) return;

    if (animated) {
      Animated.spring(slideAnim, {
        toValue: activeIndex,
        useNativeDriver: false,
        damping: 24,
        stiffness: 200,
      }).start();
    } else {
      slideAnim.setValue(activeIndex);
    }
  }, [activeIndex, animated, slideAnim]);

  const handleLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const handlePress = (seg: Segment<T>, index: number) => {
    if (seg.disabled) return;
    if (animated) {
      Animated.spring(slideAnim, {
        toValue: index,
        useNativeDriver: false,
        damping: 24,
        stiffness: 200,
      }).start();
    } else {
      slideAnim.setValue(index);
    }
    onChange(seg.value);
  };

  // Pill geometry
  const PADDING = 3;
  const segmentWidth =
    containerWidth > 0 ? (containerWidth - PADDING * 2) / segmentCount : 0;

  const pillLeft = slideAnim.interpolate({
    inputRange: segments.map((_, i) => i),
    outputRange: segments.map((_, i) => PADDING + i * segmentWidth),
  });

  const showIcon = (seg: Segment<T>) => !labelsOnly && !!seg.icon;
  const showLabel = (seg: Segment<T>) => !iconsOnly && !!seg.label;

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor,
          borderRadius: PADDING + (height - PADDING * 2) / 2,
          height,
        },
        style,
      ]}
      onLayout={handleLayout}
    >
      {/* Sliding pill */}
      {containerWidth > 0 && (
        <Animated.View
          style={[
            styles.pill,
            {
              left: pillLeft,
              width: segmentWidth - PADDING,
              height: height - PADDING * 2,
              borderRadius: (height - PADDING * 2) / 2,
              backgroundColor: activeColor,
            },
            activeSegmentStyle,
          ]}
        />
      )}

      {/* Segments */}
      {segments.map((seg, index) => {
        const isActive = seg.value === value;
        const Icon = seg.icon;
        const iconColor = isActive ? tintColor : inactiveColor;

        return (
          <TouchableOpacity
            key={seg.value as string}
            activeOpacity={seg.disabled ? 1 : 0.7}
            onPress={() => handlePress(seg, index)}
            style={[
              styles.segment,
              { opacity: seg.disabled ? 0.4 : 1 },
              segmentStyle,
            ]}
          >
            {showIcon(seg) && Icon && (
              <IconSymbol
                color={iconColor}
                name={Icon.props.name}
                size={Icon.props.size}
              />
            )}
            {showIcon(seg) && showLabel(seg) && (
              <View style={{ width: iconGap }} />
            )}
            {showLabel(seg) && (
              <Text
                style={[
                  styles.label,
                  {
                    fontSize,
                    color: isActive ? tintColor : inactiveColor,
                  },
                  labelStyle,
                ]}
                numberOfLines={1}
              >
                {seg.label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: 3,
    overflow: "hidden",
  },
  pill: {
    position: "absolute",
    top: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  label: {
    fontWeight: "500",
  },
});

export default SegmentedControl;
