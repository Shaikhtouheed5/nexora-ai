import React from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, Dimensions, Animated
} from 'react-native';
import {
    Shield, Lock, CheckCircle, Play,
    Smartphone, Globe, Key, UserCheck,
    AlertTriangle, Database, Mail, Info
} from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/ThemeContext';
import { COLORS, SHADOWS } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// Map string names from DB to components
const ICON_MAP = {
    'Mail': Mail,
    'Globe': Globe,
    'Key': Key,
    'UserCheck': UserCheck,
    'Info': Info,
    'Smartphone': Smartphone,
    'AlertTriangle': AlertTriangle,
    'Database': Database,
    'Shield': Shield,
    'Play': Play,
    'Lock': Lock,
    'BookOpen': Info // Fallback
};

export default function LessonsScreen({ lessons = [], onSelectLesson, header }) {
    const { t } = useI18n();
    const { colors } = useTheme();

    // With API data, 'lessons' contains { id, title, icon_name, is_completed, ... }
    // Lock logic: Unlocked if it's the first lesson OR previous one is completed.

    // We need to sort by day_number just in case
    const sortedLessons = [...lessons].sort((a, b) => a.day_number - b.day_number);

    return (
        <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            {header}
            <View style={styles.pathContainer}>
                {sortedLessons.map((lesson, index) => {
                    // Lock logic:
                    // Lesson 1 (index 0) is always unlocked.
                    // Others unlocked if previous lesson is completed.
                    const isFirst = index === 0;
                    const prevLesson = index > 0 ? sortedLessons[index - 1] : null;
                    const unlocked = isFirst || (prevLesson && prevLesson.is_completed);

                    const completed = lesson.is_completed;
                    const active = unlocked && !completed;

                    const Icon = ICON_MAP[lesson.icon_name] || ICON_MAP['Shield'];

                    // Toggle left/right offset for winding path effect
                    const marginLeft = index % 2 === 0 ? -40 : 40;

                    return (
                        <View key={lesson.id} style={styles.nodeWrapper}>
                            {/* Connecting Line */}
                            {index < sortedLessons.length - 1 && (
                                <View style={[
                                    styles.connector,
                                    {
                                        left: width / 2 + (index % 2 === 0 ? -20 : 20),
                                        // Line assumes next lesson flow
                                        // If this lesson is completed, line helps flow to next.
                                        // Simple logic: if THIS lesson is completed, color the line.
                                        backgroundColor: completed ? COLORS.primary : COLORS.glassBorder
                                    }
                                ]} />
                            )}

                            <TouchableOpacity
                                style={[
                                    styles.node,
                                    {
                                        marginLeft,
                                        backgroundColor: unlocked ? COLORS.surface : COLORS.bgDark,
                                        borderColor: unlocked ? (lesson.color || COLORS.primary) : COLORS.glassBorder
                                    },
                                    active && styles.activeNode
                                ]}
                                disabled={!unlocked}
                                onPress={() => onSelectLesson(lesson)}
                            >
                                {unlocked ? (
                                    completed ? (
                                        <CheckCircle size={32} color={COLORS.safe} />
                                    ) : (
                                        <Icon size={32} color={lesson.color || COLORS.primary} />
                                    )
                                ) : (
                                    <Lock size={24} color={COLORS.textMuted} />
                                )}
                            </TouchableOpacity>

                            <View style={[styles.labelContainer, { marginLeft }]}>
                                <Text style={[
                                    styles.nodeLabel,
                                    { color: unlocked ? colors.textPrimary : colors.textMuted }
                                ]}>
                                    {lesson.title}
                                </Text>
                            </View>
                        </View>
                    );
                })}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        paddingVertical: 40,
        paddingHorizontal: 20,
    },
    pathContainer: {
        alignItems: 'center',
    },
    nodeWrapper: {
        alignItems: 'center',
        marginBottom: 60, // Slightly reduced
        width: '100%',
    },
    node: {
        width: 76,
        height: 76,
        borderRadius: 38,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        ...SHADOWS.premium,
        zIndex: 2,
    },
    activeNode: {
        transform: [{ scale: 1.1 }],
        borderWidth: 6,
        borderColor: COLORS.primary,
        shadowColor: COLORS.primary,
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 10,
    },
    connector: {
        position: 'absolute',
        top: 76,
        width: 4,
        height: 60,
        zIndex: 1,
    },
    labelContainer: {
        marginTop: 16,
        maxWidth: width * 0.4, // Responsive width for long titles
        alignItems: 'center',
    },
    nodeLabel: {
        fontSize: 12, // Slightly smaller for Marathi/Hindi
        fontWeight: '900',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        lineHeight: 16,
    },
});
