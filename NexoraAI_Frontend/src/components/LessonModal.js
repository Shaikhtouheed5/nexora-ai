import React, { useState, useRef, useEffect } from 'react';
import {
    Modal, View, Text, StyleSheet, TouchableOpacity,
    Dimensions, ScrollView, Image, Animated
} from 'react-native';
import { ArrowRight, Check, X, Shield, BookOpen } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { COLORS, SHADOWS, GRADIENTS } from '../constants/theme';
import GlassCard from './GlassCard';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function LessonModal({ visible, lesson, onClose, onComplete }) {
    const { t } = useI18n();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [quizSelected, setQuizSelected] = useState(null);
    const [quizResult, setQuizResult] = useState(null); // 'correct' | 'wrong'

    // Animation for progress bar
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (lesson) {
            setCurrentIndex(0);
            setQuizSelected(null);
            setQuizResult(null);
            Animated.timing(progressAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: false,
            }).start();
        }
    }, [lesson, visible]);

    if (!lesson) return null;

    const slides = lesson.slides || [];
    const quizzes = lesson.quizzes || (lesson.quiz ? [lesson.quiz] : []);
    const totalSteps = slides.length + quizzes.length;

    useEffect(() => {
        if (lesson) {
            const progress = (currentIndex + 1) / totalSteps;
            Animated.timing(progressAnim, {
                toValue: progress,
                duration: 300,
                useNativeDriver: false,
            }).start();
        }
    }, [currentIndex, lesson, totalSteps]);

    const isQuizStep = currentIndex >= slides.length;
    const currentSlide = !isQuizStep ? slides[currentIndex] : null;
    const currentQuiz = isQuizStep ? quizzes[currentIndex - slides.length] : null;

    const handleNext = () => {
        if (currentIndex < totalSteps - 1) {
            setCurrentIndex(prev => prev + 1);
            setQuizSelected(null);
            setQuizResult(null);
        } else {
            handleComplete();
        }
    };

    const handleComplete = () => {
        onComplete(lesson.id);
        reset();
    };

    const reset = () => {
        setCurrentIndex(0);
        setQuizSelected(null);
        setQuizResult(null);
        onClose();
    };

    const handleQuizSubmit = (index) => {
        setQuizSelected(index);
        const correctIdx = currentQuiz.correct_index !== undefined ? currentQuiz.correct_index : currentQuiz.correctIndex;
        const isCorrect = index === correctIdx;
        setQuizResult(isCorrect ? 'correct' : 'wrong');
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={reset}
        >
            <View style={styles.container}>
                <LinearGradient
                    colors={[COLORS.bgDark, COLORS.bg]}
                    style={StyleSheet.absoluteFill}
                />

                <View style={styles.header}>
                    <TouchableOpacity onPress={reset} style={styles.closeButton}>
                        <X size={24} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                    <View style={styles.progressBar}>
                        <Animated.View
                            style={[
                                styles.progressFill,
                                {
                                    width: progressAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0%', '100%']
                                    })
                                }
                            ]}
                        />
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {!isQuizStep ? (
                        <View style={styles.slideContainer}>
                            <View style={styles.iconContainer}>
                                <BookOpen size={40} color={COLORS.primary} />
                            </View>
                            <Text style={styles.lessonTitle}>
                                {lesson.title || t(lesson.titleKey)}
                            </Text>
                            <Text style={styles.slideTitle}>
                                {currentSlide.title || t(currentSlide.titleKey)}
                            </Text>

                            <GlassCard style={styles.card}>
                                <Text style={styles.slideContent}>
                                    {currentSlide.content || t(currentSlide.contentKey)}
                                </Text>
                            </GlassCard>
                        </View>
                    ) : (
                        <View style={styles.quizContainer}>
                            <View style={styles.iconContainer}>
                                <Shield size={40} color={COLORS.secondary} />
                            </View>
                            <Text style={styles.quizTitle}>
                                {t('quiz')} {currentIndex - slides.length + 1} / {quizzes.length}
                            </Text>
                            <Text style={styles.question}>
                                {currentQuiz.question || t(currentQuiz.questionKey)}
                            </Text>

                            {(currentQuiz.options || currentQuiz.optionsKeys || []).map((opt, idx) => {
                                const optionText = currentQuiz.options ? opt : t(opt);
                                const isSelected = quizSelected === idx;
                                const correctIdx = currentQuiz.correct_index !== undefined ? currentQuiz.correct_index : currentQuiz.correctIndex;
                                const isCorrect = idx === correctIdx;
                                let borderColor = COLORS.glassBorder;
                                let bgColor = COLORS.glassBg;

                                if (quizResult) {
                                    if (isSelected && isCorrect) {
                                        borderColor = COLORS.safe;
                                        bgColor = COLORS.safeLight + '40';
                                    } else if (isSelected && !isCorrect) {
                                        borderColor = COLORS.malicious;
                                        bgColor = COLORS.maliciousLight + '40';
                                    } else if (!isSelected && isCorrect && quizResult === 'wrong') {
                                        borderColor = COLORS.safe;
                                    }
                                }

                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        style={[styles.optionButton, { borderColor, backgroundColor: bgColor }]}
                                        onPress={() => !quizResult && handleQuizSubmit(idx)}
                                        disabled={!!quizResult}
                                    >
                                        <Text style={[styles.optionText, { color: COLORS.textPrimary }]}>
                                            {optionText}
                                        </Text>
                                        {quizResult && isSelected && (
                                            isCorrect ? <Check size={20} color={COLORS.safe} /> : <X size={20} color={COLORS.malicious} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}

                            {quizResult && currentQuiz.explanation && (
                                <GlassCard style={[styles.card, { marginTop: 20 }]}>
                                    <Text style={[styles.quizTitle, { color: COLORS.primary }]}>{t('explanation')}</Text>
                                    <Text style={styles.slideContent}>{currentQuiz.explanation}</Text>
                                </GlassCard>
                            )}
                        </View>
                    )}
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[
                            styles.nextButton,
                            isQuizStep && !quizResult && { opacity: 0.5 }
                        ]}
                        onPress={handleNext}
                        disabled={isQuizStep && !quizResult}
                    >
                        <Text style={styles.nextButtonText}>
                            {currentIndex === totalSteps - 1 ? t('finish') : t('continue')}
                        </Text>
                        <ArrowRight size={20} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    closeButton: {
        padding: 8,
    },
    progressBar: {
        flex: 1,
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        marginHorizontal: 16,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 3,
    },
    content: {
        padding: 24,
        paddingBottom: 100,
    },
    slideContainer: {
        alignItems: 'center',
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.glassBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        ...SHADOWS.glass,
    },
    lessonTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: 12,
    },
    slideTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: COLORS.textPrimary,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 36,
    },
    card: {
        width: '100%',
        padding: 24,
        borderRadius: 24,
    },
    slideContent: {
        fontSize: 18,
        lineHeight: 28,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
        paddingBottom: 40,
        backgroundColor: 'transparent',
    },
    nextButton: {
        backgroundColor: COLORS.primary,
        height: 56,
        borderRadius: 28,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        ...SHADOWS.premium,
    },
    nextButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 1,
    },
    quizContainer: {
        alignItems: 'center',
        width: '100%',
    },
    quizTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: 12,
    },
    question: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.textPrimary,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 30,
    },
    optionButton: {
        width: '100%',
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    optionText: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    feedbackText: {
        marginTop: 20,
        fontSize: 18,
        fontWeight: '800',
    },
});
