export type Language = 'ko' | 'en';

export const translations = {
  ko: {
    'newGame': '새로하기',
    'continue': '이어하기',
    'settings': '설정',
    'exit': '게임 종료',
    'none': '없음',
    'language': '언어',
    'resolution': '해상도',
    'fullscreen': '전체 화면',
    'back': '뒤로 가기',
    'apply': '적용',
    'on': '켜짐',
    'off': '꺼짐'
  },
  en: {
    'newGame': 'New Game',
    'continue': 'Continue',
    'settings': 'Settings',
    'exit': 'Exit',
    'none': 'None',
    'language': 'Language',
    'resolution': 'Resolution',
    'fullscreen': 'Fullscreen',
    'back': 'Back',
    'apply': 'Apply',
    'on': 'On',
    'off': 'Off'
  }
};

class LocalizationManager {
  private static instance: LocalizationManager;
  private currentLang: Language = 'ko';

  private constructor() {}

  static getInstance() {
    if (!LocalizationManager.instance) {
      LocalizationManager.instance = new LocalizationManager();
    }
    return LocalizationManager.instance;
  }

  setLanguage(lang: Language) {
    this.currentLang = lang;
  }

  getLanguage() {
    return this.currentLang;
  }

  t(key: string): string {
    return (translations[this.currentLang] as any)[key] || key;
  }
}

export const i18n = LocalizationManager.getInstance();
