import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

void i18n.use(initReactI18next).init({
  lng: 'ru',
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
  resources: {
    ru: { translation: { home:'Главная', games:'Тренировки', career:'Карьера', progress:'Прогресс', rating:'Рейтинг', shop:'Магазин', profile:'Профиль', settings:'Настройки', admin:'Управление', demo:'Демо-режим' } },
    en: { translation: { home:'Home', games:'Training', career:'Career', progress:'Progress', rating:'Leaderboard', shop:'Shop', profile:'Profile', settings:'Settings', admin:'Manage', demo:'Demo mode' } },
  },
});
export default i18n;
