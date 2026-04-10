import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions, Platform } from 'react-native';
import Svg, { G, Path, Defs, LinearGradient, Stop, Circle, Filter, FeGaussianBlur, FeMerge, FeMergeNode } from 'react-native-svg';
import { COLORS } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

const Gauge = ({ value, size = SCREEN_WIDTH * 0.65, strokeWidth = 12 }) => {
    const center = size / 2;
    const radius = (size - strokeWidth * 2) / 2;

    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(animatedValue, {
            toValue: value,
            duration: 2500,
            easing: Easing.out(Easing.back(1)),
            useNativeDriver: false,
        }).start();
    }, [value]);

    const getSegmentColor = (val) => {
        if (val < 0.3) return COLORS.malicious;
        if (val < 0.7) return COLORS.suspicious;
        return COLORS.safe;
    };

    const startX = center - radius;
    const startY = center;
    const endX = center + radius;
    const endY = center;

    const backgroundPath = `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`;

    const needleRotation = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['-90deg', '90deg']
    });

    const circumference = Math.PI * radius;
    const strokeDashoffset = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [circumference, 0]
    });

    return (
        <View style={[styles.container, { width: size, height: size / 2 + 20 }]}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <Defs>
                    <LinearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <Stop offset="0%" stopColor={COLORS.malicious} />
                        <Stop offset="50%" stopColor={COLORS.suspicious} />
                        <Stop offset="100%" stopColor={COLORS.safe} />
                    </LinearGradient>

                    <Filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <FeGaussianBlur stdDeviation="3" result="blur" />
                        <FeMerge>
                            <FeMergeNode in="blur" />
                            <FeMergeNode in="SourceGraphic" />
                        </FeMerge>
                    </Filter>
                </Defs>

                {/* Track Glow */}
                <Path
                    d={backgroundPath}
                    fill="none"
                    stroke={getSegmentColor(value)}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    opacity={0.15}
                    filter="url(#glow)"
                />

                {/* Main Track */}
                <Path
                    d={backgroundPath}
                    fill="none"
                    stroke={COLORS.bgDark}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    opacity={0.3}
                />

                {/* Progress Arc */}
                <AnimatedPath
                    d={backgroundPath}
                    fill="none"
                    stroke="url(#gaugeGradient)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                />

                {/* Needle & Hub */}
                <G x={center} y={center}>
                    <AnimatedG style={{ transform: [{ rotate: needleRotation }] }}>
                        <Path
                            d={`M -2 0 L 0 -${radius - 4} L 2 0 Z`}
                            fill={COLORS.textWhite}
                            opacity={0.8}
                        />
                        <Circle
                            cx={0}
                            cy={-(radius - 4)}
                            r={3}
                            fill={getSegmentColor(value)}
                        />
                    </AnimatedG>

                    <Circle r={6} fill={COLORS.bgDark} stroke={COLORS.glassBorder} strokeWidth={1} />
                    <Circle r={2} fill={COLORS.textPrimary} />
                </G>
            </Svg>

            <View style={styles.labelContainer}>
                <Text style={styles.percentageText}>{Math.round(value * 100)}%</Text>
                <View style={[styles.statusBadge, { backgroundColor: getSegmentColor(value) + '15', borderColor: getSegmentColor(value) + '40' }]}>
                    <Text style={[styles.statusText, { color: getSegmentColor(value) }]}>
                        {value < 0.3 ? 'CRITICAL' : value < 0.7 ? 'CAUTION' : 'SECURE'}
                    </Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingTop: 8,
    },
    labelContainer: {
        alignItems: 'center',
        marginTop: 4,
    },
    percentageText: {
        fontSize: Platform.OS === 'web' ? 32 : 36,
        fontWeight: '900',
        color: COLORS.textPrimary,
        letterSpacing: -1,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 3,
        borderRadius: 12,
        marginTop: 4,
        borderWidth: 1,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 2,
    }
});

export default Gauge;
