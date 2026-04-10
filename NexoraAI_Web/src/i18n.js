import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import all 18 languages
const languages = ["ar", "bn", "de", "en", "es", "fr", "gu", "hi", "ja", "kn", "ml", "mr", "pa", "pt", "ta", "te", "ur", "zh"];
const resources = {};

languages.forEach(lang => {
    // Use dynamic imports via require if possible, but for simplicity in this environment
    // and since it's a small app, we'll just import them statically or use a helper.
    // Given the environment constraints, I'll write them out.
});

// Since I cannot easily loop imports in ESM without build-time support or dynamic imports,
// I will write out the resource object for all 18 languages.

import translationAR from './locales/ar/translation.json';
import translationBN from './locales/bn/translation.json';
import translationDE from './locales/de/translation.json';
import translationEN from './locales/en/translation.json';
import translationES from './locales/es/translation.json';
import translationFR from './locales/fr/translation.json';
import translationGU from './locales/gu/translation.json';
import translationHI from './locales/hi/translation.json';
import translationJA from './locales/ja/translation.json';
import translationKN from './locales/kn/translation.json';
import translationML from './locales/ml/translation.json';
import translationMR from './locales/mr/translation.json';
import translationPA from './locales/pa/translation.json';
import translationPT from './locales/pt/translation.json';
import translationTA from './locales/ta/translation.json';
import translationTE from './locales/te/translation.json';
import translationUR from './locales/ur/translation.json';
import translationZH from './locales/zh/translation.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            ar: { translation: translationAR },
            bn: { translation: translationBN },
            de: { translation: translationDE },
            en: { translation: translationEN },
            es: { translation: translationES },
            fr: { translation: translationFR },
            gu: { translation: translationGU },
            hi: { translation: translationHI },
            ja: { translation: translationJA },
            kn: { translation: translationKN },
            ml: { translation: translationML },
            mr: { translation: translationMR },
            pa: { translation: translationPA },
            pt: { translation: translationPT },
            ta: { translation: translationTA },
            te: { translation: translationTE },
            ur: { translation: translationUR },
            zh: { translation: translationZH }
        },
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;
