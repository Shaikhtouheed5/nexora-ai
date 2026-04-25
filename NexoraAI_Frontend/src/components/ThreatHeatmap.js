import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { COLORS } from '../constants/theme';

export default function ThreatHeatmap({ messages = [] }) {
    // Group messages by day (last 7 days)
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('en', { weekday: 'short' }).substring(0, 2);
        days.push({ key, label, threats: 0, total: 0 });
    }

    messages.forEach(msg => {
        try {
            const msgDate = new Date(msg.date).toISOString().split('T')[0];
            const day = days.find(d => d.key === msgDate);
            if (day) {
                day.total++;
                if (msg.classification === 'Malicious' || msg.classification === 'Suspicious') {
                    day.threats++;
                }
            }
        } catch (e) { console.warn('[ThreatHeatmap] Invalid message date:', e.message); }
    });

    const maxThreats = Math.max(...days.map(d => d.threats), 1);
    const barWidth = 28;
    const maxBarHeight = 60;
    const svgWidth = days.length * (barWidth + 10);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>THREAT ACTIVITY</Text>
            <View style={styles.chartArea}>
                <Svg width={svgWidth} height={maxBarHeight + 20}>
                    {days.map((day, idx) => {
                        const barHeight = day.threats > 0
                            ? Math.max((day.threats / maxThreats) * maxBarHeight, 6)
                            : 4;
                        const barColor = day.threats === 0
                            ? COLORS.glassBorder
                            : day.threats >= 3
                                ? COLORS.malicious
                                : day.threats >= 1
                                    ? COLORS.suspicious
                                    : COLORS.safe;
                        const x = idx * (barWidth + 10);
                        const y = maxBarHeight - barHeight;

                        return (
                            <Rect
                                key={idx}
                                x={x}
                                y={y}
                                width={barWidth}
                                height={barHeight}
                                rx={8}
                                fill={barColor}
                                opacity={day.threats === 0 ? 0.3 : 0.9}
                            />
                        );
                    })}
                </Svg>
                <View style={styles.labels}>
                    {days.map((day, idx) => (
                        <Text key={idx} style={styles.dayLabel}>{day.label}</Text>
                    ))}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.glassBg,
        borderRadius: 20,
        padding: 18,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        marginBottom: 20,
    },
    title: {
        fontSize: 10,
        fontWeight: '900',
        color: COLORS.textMuted,
        letterSpacing: 2,
        marginBottom: 16,
    },
    chartArea: {
        alignItems: 'center',
    },
    labels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 4,
        marginTop: 8,
    },
    dayLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: COLORS.textMuted,
        width: 28,
        textAlign: 'center',
    },
});
