# YCB BGM 생성 프롬프트

> **도구**: Suno / Udio / MusicGen 권장  
> **공통 제약**: `instrumental only, no vocals, no choir, no humming, no spoken word`  
> **루프**: 생성 시 `seamless loop` 옵션 사용 (Suno: Style에 "loopable" 명시)  
> **파일 경로**: `src/assets/sound/0N.name.mp3` (bgm 서브폴더 없음, 번호 순서로 관리)  
> **효과음(SFX)**: Web Audio API 합성으로 처리 — 별도 파일 불필요

---

## 🎬 bgm_intro — 타이틀 화면

> 게임을 처음 켰을 때 나오는 메인 메뉴. 웅장하고 기억에 남는 테마.

```
Epic fantasy title theme, grand orchestral chiptune, 16-bit SNES RPG style,
heroic brass fanfare opening, sweeping strings, majestic synth melody,
reminiscent of classic JRPG title screens, adventurous and inviting,
layered instrumentation with retro game soundfont textures,
seamless loop, instrumental only, no vocals, 90 BPM.
```

---

## 🗺️ bgm_main — 메인 맵 탐색

> 노드 맵을 보며 다음 경로를 고민하는 화면. 긴장과 기대감이 공존.

```
Medieval roguelike exploration map theme, pensive yet adventurous,
acoustic guitar picking over soft orchestral strings, oboe melody,
light percussion underlining a sense of journey and strategy,
16-bit orchestral folk fusion, slightly mysterious undertone,
calm but purposeful, hints of tension without being aggressive,
seamless loop, instrumental only, no vocals, 88 BPM.
```

---

## ⚔️ bgm_battle_normal — 일반 전투

> 속성 몹과의 카드 배틀. 빠르고 리드미컬하며 집중력을 높여주는 곡.

```
Fast-paced 16-bit fantasy battle theme, driving chiptune percussion,
catchy sawtooth synth lead melody, rhythmic bass pulse,
energetic retro RPG combat music, SNES-era sound design,
alternating tension and release with aggressive melodic runs,
punchy snare hits, urgent and focused atmosphere,
seamless loop, instrumental only, no vocals, 140 BPM.
```

---

## 💀 bgm_battle_boss — 보스 전투

> 속성 보스와의 결전. 위협적이지만 서사적인 다크 판타지 배틀.

```
Dark and menacing 16-bit boss battle theme, ominous pipe organ riff,
aggressive distorted chiptune bass, frantic string ostinato,
dramatic tension-filled melody with minor key urgency,
gothic fantasy RPG atmosphere, powerful orchestral synth hits,
relentless driving rhythm, powerful yet melodic boss encounter feel,
seamless loop, instrumental only, no vocals, no choir, 148 BPM.
```

---

## 🔥 bgm_battle_final — 최종 보스 전투

> 무속성 최종 보스. 절박함과 영웅심이 뒤섞인 클라이맥스.

```
Ultimate final boss confrontation, epic orchestral chiptune climax,
desperate heroic theme, massive layered synth brass and strings,
relentless heavy percussion, frantic 16-bit lead melody soaring over chaos,
sense of everything-on-the-line urgency, grandiose and overwhelming,
reminiscent of classic JRPG final boss themes, emotionally intense,
seamless loop, instrumental only, no vocals, no choir, 165 BPM.
```

---

## ✨ bgm_event_enhance — 강화 이벤트

> 패시브 스탯을 올리는 강화 노드. 신비롭고 보상받는 느낌.

```
Mystical enhancement chamber theme, shimmering crystal bell arpeggios,
warm magical synth pad underneath, gentle harp glissandos,
16-bit fantasy RPG upgrade room ambiance, enchanting and rewarding,
soft mysterious melody with a sense of growing power,
subtle rhythmic pulse suggesting transformation,
seamless loop, instrumental only, no vocals, 72 BPM.
```

---

## 💎 bgm_event_treasure — 보물 이벤트

> 장비를 얻는 보물 노드. 반짝이고 기쁜 발견의 순간.

```
Glittering treasure discovery theme, bright harp flourish opening,
joyful chiptune glockenspiel melody, golden warm orchestral strings,
celebratory fantasy fanfare feel without being overbearing,
16-bit SNES RPG treasure room music, sparkling and satisfying,
light bouncy rhythm, sense of delight and fortune,
seamless loop, instrumental only, no vocals, 82 BPM.
```

---

## 🃏 bgm_event_flip — 카드 뒤집기 도박

> 골드를 걸고 카드를 뒤집는 긴장감 있는 미니게임.

```
Tense playful gambling card game theme, sneaky pizzicato strings,
mysterious light woodwind melody, staccato rhythmic bassline,
16-bit suspenseful chiptune, cat-and-mouse feel,
alternating between cheeky and tense moods,
medieval tavern card game atmosphere, slightly mischievous,
seamless loop, instrumental only, no vocals, 104 BPM.
```

---

## 🔄 bgm_event_swap — 속성 카드 교환

> 속성 카드를 다른 속성으로 바꾸는 마법적 변환 이벤트.

```
Elemental magic transformation theme, swirling mystical synth textures,
deep resonant low drone with shimmering high overtones,
16-bit arcane atmosphere, magical stone and wind sounds,
slow evolving ambient with subtle melodic motif,
sense of ancient power reshaping reality,
seamless loop, instrumental only, no vocals, 76 BPM.
```

---

## 🩸 bgm_event_heart — 생명력 제단

> HP를 희생해 카드 밸류를 강화하는 제단. 신성하고 조금 섬뜩한 양면성.

```
Sacred but ominous altar theme, haunting solo flute melody,
quiet unsettling string tremolo underneath, holy ambiance with dark undertone,
16-bit spiritual RPG music, sacrifice and devotion atmosphere,
slow tempo with a feeling of solemn ritual and consequence,
divine yet foreboding, bittersweet emotional quality,
seamless loop, instrumental only, no vocals, 62 BPM.
```

---

## 🛡️ bgm_event_shield — 회복의 샘

> 쉴드업 또는 HP 회복을 선택하는 안식처. 잠깐의 휴식과 회복.

```
Peaceful restoration spring theme, gentle flowing water-like harp arpeggios,
soft warm woodwind melody, soothing ambient synth pad,
16-bit healing sanctuary RPG music, calm and restorative feel,
light optimistic undertone suggesting renewed strength,
tranquil with subtle uplifting quality, nature-inspired soundscape,
seamless loop, instrumental only, no vocals, 66 BPM.
```

---

## ⭐ bgm_event_star — 별 등급 업그레이드

> 카드의 별을 올리는 업그레이드. 우주적이고 빛나는 고양감.

```
Celestial star power upgrade theme, high sparkling bell tones,
cosmic fantasy synth pad, dreamy ethereal melody,
16-bit starlit night RPG music, sense of ascending greatness,
magical twinkling arpeggios over soft orchestral strings,
vast and beautiful, feeling of rare achievement and wonder,
seamless loop, instrumental only, no vocals, 63 BPM.
```

---

## 🎰 bgm_event_poker — 인디언 포커 (덱 정제)

> 덱의 카드를 걸고 정제하는 전략적 도박. 활기차고 계략 넘치는 분위기.

```
Lively medieval tavern gambling theme, fast acoustic mandolin melody,
rhythmic tambourine and hand drum percussion, joyful folk energy,
16-bit chiptune tavern music, cunning and festive atmosphere,
quick tempo with a playful risk-taking feel,
reminiscent of card shark and rogue archetype, clever and energetic,
seamless loop, instrumental only, no vocals, 128 BPM.
```

---

## 🛠️ 사용 가이드

### 권장 생성 도구
| 도구 | 특징 | 추천 트랙 |
|---|---|---|
| **Suno v4** | 멜로디 완성도 높음 | bgm_intro, bgm_battle_*, bgm_event_star |
| **Udio** | 분위기/텍스처 강함 | bgm_event_heart, bgm_event_swap, bgm_event_shield |
| **MusicGen** | 오픈소스, 세부 제어 | 모든 트랙 |

### Suno 사용 팁
- **Style** 필드에 프롬프트 입력
- `[loopable]` 또는 `seamless loop` 명시
- 생성 후 파형 끝과 시작이 자연스럽게 연결되는지 확인
- 마음에 드는 버전이 나올 때까지 여러 번 재생성 (보통 3~5회)

### 파일 배치

실제 배치 경로 및 Phaser 로드 키 (`PreloadScene.ts` 기준):

```
src/assets/sound/
  01.intro.mp3          → bgm_intro
  02.main.mp3           → bgm_main
  03.battle.mp3         → bgm_battle_normal
  04.boss.mp3           → bgm_battle_boss
  05.final_boss.mp3     → bgm_battle_final
  06.enhance.mp3        → bgm_event_enhance
  07.treasure.mp3       → bgm_event_treasure
  08.flip.mp3           → bgm_event_flip
  09.swap.mp3           → bgm_event_swap
  10.heart.mp3          → bgm_event_heart
  11.shield.mp3         → bgm_event_shield
  12.star.mp3           → bgm_event_star
  13.poker.mp3          → bgm_event_poker
```

> **SFX**: 코드 합성 (`src/utils/Audio.ts` + `src/data/sfxData.ts`) — 별도 파일 불필요
