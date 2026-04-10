import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS, SHADOWS } from '../constants/theme';
import GlassCard from './GlassCard';

/* 
  GitHub-Style Activity Heatmap 
  - 52 weeks (approx 1 year) horizontal scroll
  - 7 days vertical
  - Color intensity based on activity (points/lessons)
*/

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ActivityChart({ data = [] }) {
    // Data format: [{ activity_date: '2023-10-01', points_earned: 50 }, ...]

    // Helper to get color based on intensity
    const getColor = (points) => {
        if (!points || points === 0) return 'rgba(255, 255, 255, 0.05)';
        if (points < 20) return 'rgba(99, 102, 241, 0.2)';   // Low
        if (points < 50) return 'rgba(99, 102, 241, 0.4)';   // Medium
        if (points < 100) return 'rgba(99, 102, 241, 0.7)';  // High
        return COLORS.primary;                               // Max
    };

    // Generate last 365 days grid (52 weeks x 7 days)
    // We want the grid to end "today"
    const today = new Date();
    const weeks = [];
    let currentWeek = [];

    // Start from 364 days ago
    for (let i = 364; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];

        // Find activity for this date
        const activity = data.find(item => item.activity_date === dateStr);
        const points = activity ? (activity.points_earned || 0) : 0;

        currentWeek.push({ date: d, dateStr, points });

        if (currentWeek.length === 7) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
    }
    // Push remaining days if any
    if (currentWeek.length > 0) weeks.push(currentWeek);

    return (
        <GlassCard style={styles.container}>
            <Text style={styles.title}>Learning Activity</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.grid}>
                    {/* Render columns (weeks) */}
                    {weeks.map((week, wIndex) => (
                        <View key={wIndex} style={styles.column}>
                            {week.map((day, dIndex) => (
                                <View
                                    key={day.dateStr}
                                    style={[
                                        styles.cell,
                                        { backgroundColor: getColor(day.points) }
                                    ]}
                                />
                            ))}
                        </View>
                    ))}
                </View>
            </ScrollView>

            <View style={styles.legendContainer}>
                <Text style={styles.legendLabel}>Less</Text>
                <View style={[styles.legendCell, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]} />
                <View style={[styles.legendCell, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]} />
                <View style={[styles.legendCell, { backgroundColor: 'rgba(99, 102, 241, 0.4)' }]} />
                <View style={[styles.legendCell, { backgroundColor: 'rgba(99, 102, 241, 0.7)' }]} />
                <View style={[styles.legendCell, { backgroundColor: COLORS.primary }]} />
                <Text style={styles.legendLabel}>More</Text>
            </View>
        </GlassCard>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        marginBottom: 24,
    },
    title: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.textMuted,
        marginBottom: 16,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    scrollContent: {
        paddingRight: 20,
    },
    grid: {
        flexDirection: 'row',
        gap: 3,
    },
    column: {
        flexDirection: 'column',
        gap: 3,
    },
    cell: {
        width: 10,
        height: 10,
        borderRadius: 2,
    },
    legendContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 12,
        gap: 4,
    },
    legendCell: {
        width: 10,
        height: 10,
        borderRadius: 2,
    },
    legendLabel: {
        fontSize: 10,
        color: COLORS.textMuted,
        marginHorizontal: 4,
    },
});
