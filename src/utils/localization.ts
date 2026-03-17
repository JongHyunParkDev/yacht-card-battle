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
    'cancel': '취소',
    'on': '켜짐',
    'off': '꺼짐',
    'pause': '일시정지',
    'help': '도움말',
    'resume': '재개하기',
    'mainMenu': '메인으로',
    'newGameConfirm': '기존 진행 중인 게임 데이터가 있습니다.\n삭제하고 새로운 게임을 시작하시겠습니까?',
    'deck': '내 덱',
    'selectCharacter': '캐릭터 선택',
    'selectCharacterDesc': '함께할 캐릭터를 선택하세요',
    'startGame': '게임 시작',
    'weaponSwordShield': '칼과 방패',
    'weaponBow': '활',
    'weaponGreatsword': '두손검',
    'weaponHammer': '망치',
    'weaponSpear': '창'
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
    'cancel': 'Cancel',
    'on': 'On',
    'off': 'Off',
    'pause': 'Pause',
    'help': 'Help',
    'resume': 'Resume',
    'mainMenu': 'Main Menu',
    'newGameConfirm': 'Existing game data found.\nAre you sure you want to delete it and start a new game?',
    'deck': 'My Deck',
    'selectCharacter': 'Select Character',
    'selectCharacterDesc': 'Choose your companion',
    'startGame': 'Start Game',
    'weaponSwordShield': 'Sword & Shield',
    'weaponBow': 'Bow',
    'weaponGreatsword': 'Greatsword',
    'weaponHammer': 'Hammer',
    'weaponSpear': 'Spear'
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
