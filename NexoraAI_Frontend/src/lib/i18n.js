import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import all locale files
import en from '../locales/en.json';
import hi from '../locales/hi.json';
import mr from '../locales/mr.json';
import ur from '../locales/ur.json';
import bn from '../locales/bn.json';
import ta from '../locales/ta.json';
import te from '../locales/te.json';
import kn from '../locales/kn.json';
import ml from '../locales/ml.json';
import gu from '../locales/gu.json';
import pa from '../locales/pa.json';
import fr from '../locales/fr.json';
import ar from '../locales/ar.json';
import zh from '../locales/zh.json';
import pt from '../locales/pt.json';
import de from '../locales/de.json';
import ja from '../locales/ja.json';

const LOCALES = { en, hi, mr, ur, bn, ta, te, kn, ml, gu, pa, fr, ar, zh, pt, de, ja };

export const LANGUAGE_LIST = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
    { code: 'mr', name: 'Marathi', native: 'मराठी' },
    { code: 'ur', name: 'Urdu', native: 'اردو' },
    { code: 'bn', name: 'Bengali', native: 'বাংলা' },
    { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
    { code: 'te', name: 'Telugu', native: 'తెలుగు' },
    { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
    { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
    { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
    { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
    { code: 'fr', name: 'French', native: 'Français' },
    { code: 'ar', name: 'Arabic', native: 'العربية' },
    { code: 'zh', name: 'Chinese', native: '中文' },
    { code: 'pt', name: 'Portuguese', native: 'Português' },
    { code: 'de', name: 'German', native: 'Deutsch' },
    { code: 'ja', name: 'Japanese', native: '日本語' },
];

const I18nContext = createContext();

export function I18nProvider({ children }) {
    const [lang, setLang] = useState('en');

    useEffect(() => {
        AsyncStorage.getItem('app_language').then(saved => {
            if (saved && LOCALES[saved]) setLang(saved);
        });
    }, []);

    const changeLanguage = async (code) => {
        if (LOCALES[code]) {
            setLang(code);
            await AsyncStorage.setItem('app_language', code);
        }
    };

    const t = (key) => {
        return LOCALES[lang]?.[key] || LOCALES.en?.[key] || key;
    };

    return (
        <I18nContext.Provider value={{ lang, changeLanguage, t }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useI18n() {
    return useContext(I18nContext);
}
