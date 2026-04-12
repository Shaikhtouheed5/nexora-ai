import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, ActivityIndicator, Image,
    Dimensions, Alert
} from 'react-native';
import { COLORS, SHADOWS } from '../constants/theme';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import ScoreRing from '../components/ScoreRing';
import GlassCard from '../components/GlassCard';
import { ArrowLeft, Check, ArrowRight, Shield, BookOpen, Layout } from 'lucide-react-native';
import LessonsScreen from './LessonsScreen';
import LessonModal from '../components/LessonModal';
import ActivityChart from '../components/ActivityChart';

const { width } = Dimensions.get('window');

// ACADEMY_LESSONS removed - now fetched from API


export default function EducationScreen({ userId }) {
    const { t, lang } = useI18n();
    const [view, setView] = useState('advice'); // 'advice' | 'quiz' | 'result'
    const [subView, setSubView] = useState('audit'); // 'audit' | 'academy'
    const [advice, setAdvice] = useState([]);
    const [loading, setLoading] = useState(true);

    // Academy State
    const [fetchedLessons, setFetchedLessons] = useState([]);
    const [selectedLesson, setSelectedLesson] = useState(null);
    const [activityData, setActivityData] = useState([]);
    const [loadingAcademy, setLoadingAcademy] = useState(false);


    // Quiz State
    const [quizData, setQuizData] = useState([]);
    const [quizId, setQuizId] = useState(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState([]);
    const [quizResult, setQuizResult] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadAdvice();
        loadAcademy();
    }, [lang]);

    const loadAcademy = async () => {
        setLoadingAcademy(true);
        try {
            const lessonsData = await api.getLessons(lang);
            console.log('[Academy] getLessons response:', JSON.stringify(lessonsData)?.slice(0, 300));
            setFetchedLessons(Array.isArray(lessonsData) ? lessonsData : []);

            const activityRes = await api.getActivity();
            setActivityData(Array.isArray(activityRes) ? activityRes : []);
        } catch (e) {
            console.error('[Academy] retrieval failed:', e.message);
        }
        setLoadingAcademy(false);
    };


    const loadAdvice = async () => {
        setLoading(true);
        try {
            const data = await api.get('/advice', { params: { lang } });
            setAdvice(Array.isArray(data) ? data : []);
        } catch (e) {
            console.log('Advice retrieval failed:', e);
            setAdvice([]);
        }
        setLoading(false);
    };

    const startQuiz = async () => {
        setLoading(true);
        try {
            const res = await api.getDailyQuiz(lang);
            console.log('[Quiz] getDailyQuiz response:', JSON.stringify(res)?.slice(0, 300));
            if (!res || !Array.isArray(res.questions) || res.questions.length === 0) {
                throw new Error('No questions returned from server. Response: ' + JSON.stringify(res)?.slice(0, 200));
            }
            setQuizData(res.questions);
            setQuizId(res.id || null);
            setCurrentQuestionIndex(0);
            setUserAnswers([]);
            setQuizResult(null);
            setView('quiz');
        } catch (e) {
            console.error('[Quiz] init error:', e.message);
            Alert.alert(t('connection_error'), e.message || t('quiz_load_error'));
        }
        setLoading(false);
    };

    const handleAnswer = (optionIndex) => {
        const question = quizData[currentQuestionIndex];
        const newAnswers = [...userAnswers, {
            question_id: question.id,
            selected_index: optionIndex,
            options: question.options
        }];
        setUserAnswers(newAnswers);

        if (currentQuestionIndex < quizData.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
            submitQuiz(newAnswers);
        }
    };

    const submitQuiz = async (finalAnswers) => {
        setSubmitting(true);
        try {
            const result = await api.submitQuiz(finalAnswers, userId, "daily", quizId);
            setQuizResult(result);
            setView('result');
            loadAdvice();
            // Award XP equal to quiz score
            const xpToAward = result?.score ?? result?.correct_count ?? 0;
            if (xpToAward > 0) {
                await api.awardXp(xpToAward, 'quiz');
            }
        } catch (e) {
            console.log('Quiz submission error:', e);
            Alert.alert(t('submission_error'), t('quiz_submit_error'));
        }
        setSubmitting(false);
    };

    const handleLessonSelect = async (lessonMeta) => {
        setLoadingAcademy(true);
        try {
            const fullLesson = await api.getLesson(lessonMeta.id, lang);
            setSelectedLesson(fullLesson);
        } catch (e) {
            console.log('Lesson detail fetch failed:', e);
            Alert.alert(t('connection_error'), t('lesson_load_error') || 'Failed to load lesson content');
        }
        setLoadingAcademy(false);
    };

    const handleCompleteLesson = async (lessonId) => {
        try {
            await api.completeLesson(lessonId);
            await api.awardXp(10, 'lesson');
            await loadAcademy();
            loadAdvice();
        } catch (e) {
            console.log('Lesson completion error:', e);
            Alert.alert(t('error'), 'Could not save progress. Please check your connection.');
        }
        setSelectedLesson(null);
    };


    // ──────────────────────────────────────
    // LOADING STATE
    // ──────────────────────────────────────
    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator color={COLORS.primary} size="large" />
                <Text style={styles.loadingText}>{t('initializing')}</Text>
            </View>
        );
    }

    // ──────────────────────────────────────
    // QUIZ VIEW
    // ──────────────────────────────────────
    if (view === 'quiz') {
        const question = quizData[currentQuestionIndex];
        const progress = ((currentQuestionIndex) / quizData.length) * 100;

        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => setView('advice')} style={styles.backButton}>
                        <ArrowLeft size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('phishiq_audit')}</Text>
                    <Text style={styles.progressCounter}>{currentQuestionIndex + 1} / {quizData.length}</Text>
                </View>

                <View style={styles.progressBarContainer}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>

                <ScrollView contentContainerStyle={styles.quizContent} showsVerticalScrollIndicator={false}>
                    {/* Glass Question Card */}
                    <GlassCard style={styles.glassCard}>
                        <Text style={styles.questionCategory}>{question.category.toUpperCase()}</Text>
                        <Text style={styles.questionText}>{question.question}</Text>
                    </GlassCard>

                    {question.options.map((option, idx) => (
                        <TouchableOpacity
                            key={idx}
                            style={styles.optionButton}
                            onPress={() => handleAnswer(idx)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.optionIndex}>
                                <Text style={styles.optionIndexText}>{String.fromCharCode(65 + idx)}</Text>
                            </View>
                            <Text style={styles.optionText}>{option}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {submitting && (
                    <View style={styles.submittingOverlay}>
                        <ActivityIndicator color={COLORS.primary} size="large" />
                        <Text style={styles.loadingText}>{t('computing')}</Text>
                    </View>
                )}
            </View>
        );
    }

    // ──────────────────────────────────────
    // RESULT VIEW (with per-question breakdown)
    // ──────────────────────────────────────
    if (view === 'result' && quizResult) {
        const riskColor = quizResult.risk_level === 'Safe' ? COLORS.safe
            : quizResult.risk_level === 'Vulnerable' ? COLORS.suspicious
                : COLORS.malicious;
        const riskBg = quizResult.risk_level === 'Safe' ? COLORS.safeLight
            : quizResult.risk_level === 'Vulnerable' ? COLORS.suspiciousLight
                : COLORS.maliciousLight;

        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{t('audit_report')}</Text>
                    <TouchableOpacity onPress={() => setView('advice')} style={styles.doneButton}>
                        <Text style={[styles.backButtonText, { color: COLORS.safe, marginRight: 8 }]}>{t('done')}</Text>
                        <Check size={20} color={COLORS.safe} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}>
                    {/* Score Card */}
                    <GlassCard style={styles.glassCard}>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={styles.resultLabel}>{t('neural_score')}</Text>
                            <ScoreRing score={quizResult.score} color={riskColor} />
                            <Text style={styles.resultSubtext}>
                                {quizResult.correct_count} / {quizResult.total_questions} {t('correct')}
                            </Text>
                            <View style={[styles.riskBadge, { backgroundColor: riskBg }]}>
                                <Text style={[styles.riskBadgeText, { color: riskColor }]}>
                                    {quizResult.risk_level.toUpperCase()}
                                </Text>
                            </View>
                        </View>
                    </GlassCard>

                    {/* Personalized Advice */}
                    {quizResult.personalized_advice && quizResult.personalized_advice.length > 0 && (
                        <View style={styles.sectionBlock}>
                            <Text style={styles.sectionTitle}>{t('personalized_intel')}</Text>
                            {quizResult.personalized_advice.map((tip, idx) => (
                                <View key={idx} style={styles.adviceTipCard}>
                                    <View style={[styles.adviceTipStrip, { backgroundColor: COLORS.primary }]} />
                                    <Text style={styles.adviceTipText}>{t(tip)}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Per-question breakdown */}
                    <View style={styles.sectionBlock}>
                        <Text style={styles.sectionTitle}>{t('question_breakdown')}</Text>
                        {quizResult.details && quizResult.details.map((detail, idx) => (
                            <GlassCard key={idx} style={{ marginBottom: 14 }}>
                                <View style={styles.detailHeader}>
                                    <View style={[styles.detailBadge, {
                                        backgroundColor: detail.is_correct ? COLORS.safeLight : COLORS.maliciousLight
                                    }]}>
                                        <Text style={[styles.detailBadgeText, {
                                            color: detail.is_correct ? COLORS.safe : COLORS.malicious
                                        }]}>
                                            {detail.is_correct ? t('correct_label') : t('wrong_label')}
                                        </Text>
                                    </View>
                                    <Text style={styles.detailCategory}>{detail.category.toUpperCase()}</Text>
                                </View>

                                <Text style={styles.detailQuestion}>{detail.question}</Text>

                                {!detail.is_correct && (
                                    <View style={styles.answerBlock}>
                                        <View style={styles.answerRow}>
                                            <Text style={[styles.answerLabel, { color: COLORS.malicious }]}>{t('your_answer')}</Text>
                                            <Text style={styles.answerText}>{detail.your_answer}</Text>
                                        </View>
                                        <View style={styles.answerRow}>
                                            <Text style={[styles.answerLabel, { color: COLORS.safe }]}>{t('correct_answer')}</Text>
                                            <Text style={styles.answerText}>{detail.correct_answer}</Text>
                                        </View>
                                    </View>
                                )}

                                <View style={styles.explanationBox}>
                                    <Text style={styles.explanationText}>{detail.explanation}</Text>
                                </View>
                            </GlassCard>
                        ))}
                    </View>

                    {/* Retake Button */}
                    <TouchableOpacity style={styles.primaryButton} onPress={startQuiz}>
                        <Text style={styles.primaryButtonText}>{t('retake_quiz')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.outlineButton} onPress={() => setView('advice')}>
                        <Text style={styles.outlineButtonText}>{t('view_advice')}</Text>
                    </TouchableOpacity>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </View>
        );
    }

    // ──────────────────────────────────────
    // ADVICE VIEW (default)
    // ──────────────────────────────────────
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Image source={require('../../logo.png')} style={styles.headerLogo} />
                <View>
                    <Text style={styles.headerTitle}>{t('protocols_title')}</Text>
                    <Text style={styles.headerSubtitle}>{t('security_briefing')}</Text>
                </View>
            </View>

            {/* Sub-Tabs (Audit / Academy) */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tabButton, subView === 'audit' && styles.tabButtonActive]}
                    onPress={() => setSubView('audit')}
                >
                    <Shield size={18} color={subView === 'audit' ? COLORS.primary : COLORS.textMuted} />
                    <Text style={[styles.tabButtonText, { color: subView === 'audit' ? COLORS.primary : COLORS.textMuted }]}>
                        {t('audit_tab') || 'Audit'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabButton, subView === 'academy' && styles.tabButtonActive]}
                    onPress={() => setSubView('academy')}
                >
                    <BookOpen size={18} color={subView === 'academy' ? COLORS.primary : COLORS.textMuted} />
                    <Text style={[styles.tabButtonText, { color: subView === 'academy' ? COLORS.primary : COLORS.textMuted }]}>
                        {t('academy_tab') || 'Academy'}
                    </Text>
                </TouchableOpacity>
            </View>

            {subView === 'audit' ? (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Hero */}
                    <View style={styles.heroCard}>
                        <View style={styles.heroBadge}>
                            <Text style={styles.heroBadgeText}>{t('daily_challenge')}</Text>
                        </View>
                        <Text style={styles.heroTitle}>{t('strategic_defense')}</Text>
                        <Text style={styles.heroDesc}>
                            {t('daily_quiz_desc')}
                        </Text>
                    </View>

                    {/* Quiz CTA */}
                    <TouchableOpacity style={styles.primaryButton} activeOpacity={0.7} onPress={startQuiz}>
                        <Text style={styles.primaryButtonText}>{t('take_quiz')}</Text>
                    </TouchableOpacity>

                    {/* Advice Cards */}
                    {advice.length > 0 ? (
                        <View style={styles.sectionBlock}>
                            <Text style={styles.sectionTitle}>{t('tailored_recommendations')}</Text>
                            {advice.map((item, index) => (
                                <GlassCard key={index}>
                                    <View style={styles.adviceHeader}>
                                        <View style={styles.adviceAccent} />
                                        <Text style={styles.adviceTitle}>{item.title}</Text>
                                    </View>
                                    <Text style={styles.adviceText}>{item.detail}</Text>
                                </GlassCard>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyTitle}>{t('no_advice')}</Text>
                            <Text style={styles.emptyText}>
                                {t('no_advice_desc')}
                            </Text>
                        </View>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            ) : (
                <View style={{ flex: 1 }}>
                    {loadingAcademy && !selectedLesson && (
                        <View style={styles.academyLoader}>
                            <ActivityIndicator color={COLORS.primary} size="small" />
                        </View>
                    )}
                    <LessonsScreen
                        lessons={fetchedLessons}
                        onSelectLesson={handleLessonSelect}
                        header={<ActivityChart data={activityData} />}
                    />
                </View>
            )}

            {selectedLesson && (
                <LessonModal
                    visible={!!selectedLesson}
                    lesson={selectedLesson}
                    onClose={() => setSelectedLesson(null)}
                    onComplete={handleCompleteLesson}
                />
            )}

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.bg,
    },
    loadingText: {
        color: COLORS.textMuted,
        fontSize: 10,
        fontWeight: '900',
        marginTop: 16,
        letterSpacing: 2,
    },

    // ── Header ──
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 24,
        backgroundColor: COLORS.bgDark,
        ...SHADOWS.premium,
        zIndex: 10,
    },
    headerLogo: {
        width: 44,
        height: 44,
        marginRight: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: COLORS.textPrimary,
        letterSpacing: 1,
    },
    headerSubtitle: {
        fontSize: 10,
        color: COLORS.textSecondary,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    backButton: {
        marginRight: 16,
    },
    doneButton: {
        marginLeft: 'auto',
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButtonText: {
        color: COLORS.primary,
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1,
    },
    progressCounter: {
        marginLeft: 'auto',
        color: COLORS.textMuted,
        fontSize: 12,
        fontWeight: '800',
    },

    // ── Progress Bar ──
    progressBarContainer: {
        height: 4,
        backgroundColor: COLORS.bgDark,
        width: '100%',
    },
    progressFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
    },

    // ── Glass Cards (Real Glassmorphism) ──
    glassCard: {
        marginBottom: 18,
    },


    // ── Scroll Areas ──
    scrollContent: {
        padding: 24,
        paddingBottom: 40,
    },
    quizContent: {
        padding: 24,
        paddingBottom: 40,
    },
    resultScroll: {
        padding: 24,
        paddingBottom: 40,
    },

    // ── Hero Card ──
    heroCard: {
        backgroundColor: COLORS.primary,
        borderRadius: 28,
        padding: 28,
        marginBottom: 24,
        ...SHADOWS.premium,
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: COLORS.bgDark,
        marginBottom: 10,
        letterSpacing: 0.5,
    },
    heroDesc: {
        fontSize: 14,
        color: COLORS.bgDark,
        lineHeight: 20,
        fontWeight: '600',
        opacity: 0.85,
    },

    // ── Section Blocks ──
    sectionBlock: {
        marginTop: 28,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: COLORS.textMuted,
        marginBottom: 16,
        letterSpacing: 2,
    },

    // ── Advice Cards ──
    adviceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    adviceAccent: {
        width: 4,
        height: 18,
        borderRadius: 2,
        backgroundColor: COLORS.primary,
        marginRight: 12,
    },
    adviceTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: COLORS.primary,
        letterSpacing: 0.5,
    },
    adviceText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        lineHeight: 21,
        fontWeight: '500',
    },

    // ── Advice Tips (in results) ──
    adviceTipCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.glassBg,
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    adviceTipStrip: {
        width: 5,
    },
    adviceTipText: {
        flex: 1,
        padding: 16,
        fontSize: 13,
        color: COLORS.textSecondary,
        lineHeight: 20,
        fontWeight: '600',
    },

    // ── Quiz Options ──
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 20,
        backgroundColor: COLORS.glassBg,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        ...SHADOWS.soft,
    },
    optionIndex: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.bgDark,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    optionIndexText: {
        color: COLORS.textPrimary,
        fontSize: 15,
        fontWeight: '900',
    },
    optionText: {
        flex: 1,
        fontSize: 15,
        color: COLORS.textPrimary,
        fontWeight: '600',
        lineHeight: 22,
    },

    // ── Quiz Question ──
    questionCategory: {
        fontSize: 11,
        fontWeight: '900',
        color: COLORS.primary,
        marginBottom: 12,
        letterSpacing: 2,
    },
    questionText: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.textPrimary,
        lineHeight: 28,
    },

    // ── Results ──
    resultLabel: {
        fontSize: 11,
        fontWeight: '900',
        color: COLORS.textMuted,
        letterSpacing: 2,
        marginBottom: 12,
    },
    resultValue: {
        fontSize: 64,
        fontWeight: '900',
        marginBottom: 4,
    },
    resultSubtext: {
        fontSize: 14,
        color: COLORS.textSecondary,
        fontWeight: '600',
        marginBottom: 16,
    },
    riskBadge: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 30,
    },
    riskBadgeText: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 2,
    },

    // ── Detail Cards (per-question) ──
    detailHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 10,
    },
    detailBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    detailBadgeText: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    detailCategory: {
        fontSize: 10,
        fontWeight: '800',
        color: COLORS.textMuted,
        letterSpacing: 1.5,
    },
    detailQuestion: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textPrimary,
        lineHeight: 20,
        marginBottom: 12,
    },
    answerBlock: {
        backgroundColor: COLORS.bgDark,
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    answerRow: {
        marginBottom: 8,
    },
    answerLabel: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
        marginBottom: 2,
    },
    answerText: {
        fontSize: 13,
        color: COLORS.textPrimary,
        fontWeight: '600',
        lineHeight: 18,
    },
    explanationBox: {
        backgroundColor: COLORS.primaryLight,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.15)',
    },
    explanationText: {
        fontSize: 12,
        color: COLORS.primary,
        fontWeight: '600',
        lineHeight: 18,
        fontStyle: 'italic',
    },

    // ── Buttons ──
    primaryButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 20,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
        ...SHADOWS.premium,
    },
    primaryButtonText: {
        color: COLORS.bgDark,
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 2,
    },
    outlineButton: {
        backgroundColor: 'transparent',
        borderRadius: 20,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    outlineButtonText: {
        color: COLORS.primary,
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 2,
    },

    // ── Empty State ──
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.textSecondary,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 13,
        color: COLORS.textMuted,
        textAlign: 'center',
        lineHeight: 20,
        fontWeight: '500',
        paddingHorizontal: 20,
    },

    // ── Overlays ──
    submittingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(2, 6, 23, 0.92)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    heroBadge: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginBottom: 12,
    },
    heroBadgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        backgroundColor: COLORS.bgDark,
        paddingBottom: 16,
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    tabButtonActive: {
        backgroundColor: COLORS.glassBg,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    tabButtonText: {
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    academyLoader: {
        paddingVertical: 10,
        alignItems: 'center',
        backgroundColor: COLORS.bgDark,
    },
});
