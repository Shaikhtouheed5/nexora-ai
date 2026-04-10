import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS } from '../constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function ScoreRing({ score, size = 180, strokeWidth = 12, color }) {
    const animValue = useRef(new Animated.Value(0)).current;
    const counterValue = useRef(new Animated.Value(0)).current;
    const [displayScore, setDisplayScore] = React.useState(0);

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(animValue, {
                toValue: score / 100,
                duration: 1500,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
            }),
            Animated.timing(counterValue, {
                toValue: score,
                duration: 1500,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
            }),
        ]).start();

        counterValue.addListener(({ value }) => {
            setDisplayScore(Math.round(value));
        });

        return () => counterValue.removeAllListeners();
    }, [score]);

    const strokeDashoffset = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [circumference, 0],
    });

    const riskColor = color || (score >= 80 ? COLORS.safe : score >= 50 ? COLORS.suspicious : COLORS.malicious);

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            <Svg width={size} height={size} style={styles.svg}>
                {/* Background track */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={COLORS.bgDark}
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {/* Animated progress arc */}
                <AnimatedCircle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={riskColor}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    rotation="-90"
                    origin={`${size / 2}, ${size / 2}`}
                />
            </Svg>
            <View style={styles.centerContent}>
                <Text style={[styles.scoreText, { color: riskColor }]}>{displayScore}%</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    svg: {
        transform: [{ rotateZ: '0deg' }],
    },
    centerContent: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scoreText: {
        fontSize: 44,
        fontWeight: '900',
        letterSpacing: -1,
    },
});
