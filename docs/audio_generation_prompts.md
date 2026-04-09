## 🎻 배경 음악 (BGM) - 13종
그래픽 스타일(픽셀/메이플스토리)에 맞춰 **'고퀄리티 16비트 레트로 판타지'** 스타일로 구성했습니다. 
**모든 프롬프트는 가사나 목소리를 포함하지 않도록 세팅되었습니다.**

| 파일명 (Key) | 복사용 프롬프트 (Ready-to-copy Prompt) |
| :--- | :--- |
| **`bgm_intro`** | `Grand medieval fantasy intro, 16-bit RPG style, heroic trumpets, catchy main theme, orchestral chiptune fusion, high fidelity, no vocals, no choir, majestic, 85bpm.` |
| **`bgm_main`** | `Charming medieval village, cozy fantasy RPG music, acoustic guitar and woodwinds, peaceful, melodic, retro game OST style, instrumental, no vocals, 90bpm.` |
| **`bgm_battle_normal`** | `Upbeat 16-bit battle theme, fast-paced medieval RPG combat, driving percussion, catchy synth lead, rhythmic, high energy, instrumental, no lyrics, 135bpm.` |
| **`bgm_battle_boss`** | `Intense 16-bit boss music, dark fantasy RPG, fast strings, dramatic pipe organ (no vocals), powerful drums, menacing but melodic, instrumental, 145bpm.` |
| **`bgm_battle_final`** | `Epic final showdown, 16-bit orchestral metal fusion, majestic synth leads, heavy frantic drums, heroic and desperate, instrumental only, no choir, no humming, 160bpm.` |
| **`bgm_event_enhance`** | `Mystical upgrade room, shimmering bells, magical fantasy ambient, 16-bit synth textures, mysterious, rewarding vibe, instrumental, no vocals, 70bpm.` |
| **`bgm_event_treasure`** | `Glittering treasure room, bright harp glissando, joyful chiptune bells, golden fantasy ambiance, rich and sparkling, instrumental, no vocals, 80bpm.` |
| **`bgm_event_flip`** | `Sneaky card flip puzzle, light staccato woodwinds, playful mystery, 16-bit rhythmic pizzicato strings, quirky fantasy, instrumental, no vocals, 100bpm.` |
| **`bgm_event_swap`** | `Elemental magic forge, pulsing low synth, swirling magical winds, mystical stone friction sounds, 16-bit atmospheric, instrumental, no vocals, 75bpm.` |
| **`bgm_event_heart`** | `Sacred healing altar, soft flute melody, warm synth pad, peaceful divine ambiance, 16-bit holy fantasy, instrumental, no vocals, 65bpm.` |
| **`bgm_event_shield`** | `Sturdy blacksmith forge, rhythmic metal hammering sound, steady protective pulse, 16-bit industrial fantasy, instrumental, no vocals, 95bpm.` |
| **`bgm_event_star`** | `Starlit night magic, high-pitched celestial bells, twinkling synth, vast cosmic fantasy, 16-bit beautiful melody, instrumental, no vocals, 60bpm.` |
| **`bgm_event_poker`** | `Lively medieval tavern, fast acoustic mandolin, rhythmic clapping (percussion), fun gambling vibe, chiptune folk style, instrumental, no vocals, 125bpm.` |

---

## ⚔️ 효과음 (SFX) - 8종
타격감과 피드백을 극대화한 레트로 게임 스타일의 효과음입니다.

| 파일명 (Key) | 복사용 프롬프트 (Ready-to-copy Prompt) |
| :--- | :--- |
| **`sfx_attack`** | `Sharp sword swing, metal whoosh, 16-bit retro action sound, high-pitched air cut, cinematic sfx.` |
| **`sfx_hit`** | `Heavy metal impact on armor, satisfying crunch, 16-bit hit sound, punchy battle feedback, cinematic impact.` |
| **`sfx_heal`** | `Sparkling magical chime, rising holy glissando, 16-bit recovery sound, bright divine glitter sfx.` |
| **`sfx_win`** | `Victorious RPG fanfare, short heroic brass flourish, 16-bit level-up jingle, rewarding finish, no vocals.` |
| **`sfx_lose`** | `Game over jingle, melancholic low synth, fading minor chord, 16-bit fail sound, somber end, instrumental.` |
| **`sfx_click`** | `Tactile medieval UI click, stone plate latch, 16-bit heavy mechanical button press, satisfying feedback.` |
| **`sfx_reward`** | `Jingle for finding gold, shimmering magical reveal, 16-bit treasure pickup, high-pitched rewarding chime.` |
| **`sfx_move`** | `Light gravel step, leather boot on stone, short exploration footstep, 16-bit subtle movement sfx.` |
| **`sfx_card_hover`** | `Soft high-pitched paper rustle, subtle UI swish, 16-bit light mechanical feedback, non-intrusive.` |
| **`sfx_card_select`** | `Clear high-pitched ting, magical selection sound, 16-bit crystal chime, satisfying pick feedback.` |
| **`sfx_card_play`** | `Satisfying card thud, magic energy surge, 16-bit powerful drop sound, battle tactical execution sfx.` |
| **`sfx_upgrade`** | `Mystical power up, shimmering glissando, 16-bit star upgrade sound, heroic enchantment jingle.` |
| **`sfx_error`** | `Short dull buzz, negative feedback, 16-bit low-pitch error sound, discrete invalid action chime.` |

---

## 🛠️ 적용 안내 (Implementation Guide)

1.  **디렉토리 구조**: 생성한 파일을 아래 경로에 배치하세요.
    - `src/assets/sound/bgm/`: 배경음 파일 (.mp3)
    - `src/assets/sound/sfx/`: 효과음 파일 (.mp3)
2.  **파일명 일치**: `PreloadScene.ts`에 정의된 키값과 실제 파일명이 동일해야 합니다.
3.  **루프(Loop)**: BGM의 경우 AI에서 'Seamless Loop' 옵션을 사용하여 생성하는 것이 가장 좋습니다.
