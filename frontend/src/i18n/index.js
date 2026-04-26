// src/i18n/index.js — настройка i18n
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import uz from './uz';
import ru from './ru';
import en from './en';

i18n
  .use(initReactI18next)
  .init({
    resources: { uz, ru, en },
    lng: 'uz', // язык по умолчанию
    fallbackLng: 'uz',
    interpolation: { escapeValue: false }
  });

export default i18n;