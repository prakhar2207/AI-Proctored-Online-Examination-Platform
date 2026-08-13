'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import i18n, { Language, LANGUAGE_OPTIONS } from '@/lib/i18n';

export type { Language };
export { LANGUAGE_OPTIONS };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
  tQuestion: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

import { getTranslatedSync, translateTextAsync, translateBatchAsync } from '@/lib/translate';

const questionTermMap: Partial<Record<Language, Record<string, string>>> = {
  hi: {
    'Questions': 'प्रश्न',
    'Question': 'प्रश्न',
    'Marks': 'अंक',
    'Subject': 'विषय',
    'Section': 'खंड',
    'Option': 'विकल्प',
    'Select the correct answer': 'सही उत्तर का चयन करें',
    'General Knowledge': 'सामान्य ज्ञान',
    'Mathematics': 'गणित',
    'Computer Science': 'कंप्यूटर विज्ञान',
    'Physics': 'भौतिक विज्ञान',
    'Chemistry': 'रसायन विज्ञान',
  },
  te: {
    'Questions': 'ప్రశ్నలు',
    'Question': 'ప్రశ్న',
    'Marks': 'మార్కులు',
    'Subject': 'సబ్జెక్ట్',
    'Section': 'విభాగం',
    'Option': 'ఎంపిక',
    'Select the correct answer': 'సరైన జవాబును ఎంచుకోండి',
    'General Knowledge': 'సాధారణ జ్ఞానం',
    'Mathematics': 'గణితం',
    'Computer Science': 'కంప్యూటర్ సైన్స్',
    'Physics': 'భౌతిక శాస్త్రం',
    'Chemistry': 'రసాయన శాస్త్రం',
  },
  ta: {
    'Questions': 'கேள்விகள்',
    'Question': 'கேள்வி',
    'Marks': 'மதிப்பெண்கள்',
    'Subject': 'பாடம்',
    'Section': 'பிரிவு',
    'Option': 'விருப்பம்',
    'Select the correct answer': 'சரியான விடையைத் தேர்ந்தெடுக்கவும்',
    'General Knowledge': 'பொது அறிவு',
    'Mathematics': 'கணிதம்',
    'Computer Science': 'கணினி அறிவியல்',
    'Physics': 'இயற்பியல்',
    'Chemistry': 'வேதியியல்',
  },
  ml: {
    'Questions': 'ചോദ്യങ്ങൾ',
    'Question': 'ചോദ്യം',
    'Marks': 'മാർക്ക്',
    'Subject': 'വിഷയം',
    'Section': 'വിഭാഗം',
    'Option': 'ഓപ്ഷൻ',
    'Select the correct answer': 'ശരിയായ ഉത്തരം തിരഞ്ഞെടുക്കുക',
    'General Knowledge': 'പൊതുവിജ്ഞാനം',
    'Mathematics': 'ഗണിതം',
    'Computer Science': 'കമ്പ്യൂട്ടർ സയൻസ്',
    'Physics': 'ഫിസിക്സ്',
    'Chemistry': 'കെമിസ്ട്രി',
  },
  mr: {
    'Questions': 'प्रश्न',
    'Question': 'प्रश्न',
    'Marks': 'गुण',
    'Subject': 'विषय',
    'Section': 'विभाग',
    'Option': 'पर्याय',
    'Select the correct answer': 'योग्य उत्तर निवडा',
    'General Knowledge': 'सामान्य ज्ञान',
    'Mathematics': 'गणित',
    'Computer Science': 'संगणक शास्त्र',
    'Physics': 'भौतिकशास्त्र',
    'Chemistry': 'रसायनशास्त्र',
  },
  gu: {
    'Questions': 'પ્રશ્નો',
    'Question': 'પ્રશ્ન',
    'Marks': 'ગુણ',
    'Subject': 'વિષય',
    'Section': 'વિભાગ',
    'Option': 'વિકલ્પ',
    'Select the correct answer': 'સાચો જવાબ પસંદ કરો',
    'General Knowledge': 'સામાન્ય જ્ઞાન',
    'Mathematics': 'ગણિત',
    'Computer Science': 'કોમ્પ્યુટર સાયન્સ',
    'Physics': 'ભૌતિકશાસ્ત્ર',
    'Chemistry': 'રસાયણશાસ્ત્ર',
  },
  bn: {
    'Questions': 'প্রশ্নাবলি',
    'Question': 'প্রশ্ন',
    'Marks': 'নম্বর',
    'Subject': 'বিষয়',
    'Section': 'বিভাগ',
    'Option': 'বিকল্প',
    'Select the correct answer': 'সঠিক উত্তর নির্বাচন করুন',
    'General Knowledge': 'সাধারণ জ্ঞান',
    'Mathematics': 'গণিত',
    'Computer Science': 'কম্পিউটার সায়েন্স',
    'Physics': 'পদার্থবিজ্ঞান',
    'Chemistry': 'রসায়ন',
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { t: i18nT } = useTranslation();
  const [language, setLanguageState] = useState<Language>('en');
  const [, setTransVersion] = useState(0);
  const pendingBatchRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem('i18nextLng') as Language;
    if (saved && ['en', 'hi', 'te', 'ta', 'ml', 'mr', 'gu', 'bn'].includes(saved)) {
      setLanguageState(saved);
      i18n.changeLanguage(saved);
    } else if (i18n.language) {
      const code = i18n.language.split('-')[0] as Language;
      if (['en', 'hi', 'te', 'ta', 'ml', 'mr', 'gu', 'bn'].includes(code)) {
        setLanguageState(code);
      }
    }

    const handleLangChange = (lng: string) => {
      const code = lng.split('-')[0] as Language;
      if (['en', 'hi', 'te', 'ta', 'ml', 'mr', 'gu', 'bn'].includes(code)) {
        setLanguageState(code);
      }
      setTransVersion((v) => v + 1);
    };

    i18n.on('languageChanged', handleLangChange);
    return () => {
      i18n.off('languageChanged', handleLangChange);
    };
  }, []);

  // Safe background batch translation processor
  useEffect(() => {
    if (language === 'en') return;
    const interval = setInterval(() => {
      if (pendingBatchRef.current.size > 0) {
        const keys = Array.from(pendingBatchRef.current);
        pendingBatchRef.current.clear();
        translateBatchAsync(keys, language).then((hasUpdates) => {
          if (hasUpdates) {
            setTransVersion((v) => v + 1);
          }
        });
      }
    }, 400);
    return () => clearInterval(interval);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('i18nextLng', lang);
    setTransVersion((v) => v + 1);
  };

  const tQuestion = (text: string): string => {
    if (!text || language === 'en') return text;

    // 1. Try sync dictionary / cache lookup
    const syncRes = getTranslatedSync(text, language);
    if (syncRes !== text) {
      return syncRes;
    }

    // Queue for safe background translation batching
    pendingBatchRef.current.add(text);

    // 2. Perform term replacement with word boundaries as temporary fallback
    let translated = text;
    const map = questionTermMap[language];
    if (map) {
      Object.keys(map).forEach((src) => {
        const regex = new RegExp(`\\b${src}\\b`, 'gi');
        translated = translated.replace(regex, map[src]);
      });
    }

    return translated;
  };

  const t = (key: string, fallback?: string): string => {
    const res = i18nT(key);
    if (res && res !== key) return res;
    return tQuestion(fallback || key);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tQuestion }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
