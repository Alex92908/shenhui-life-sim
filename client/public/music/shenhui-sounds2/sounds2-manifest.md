# 湾区人生 / Bay Area Life — 补缺音效包 2 (sounds2)

13 个 MP3 文件，2026-11-10 下载并核查。补的是第一批（`~/workspace/shenhui-music/` 7 首 BGM）和音效库（`~/workspace/shenhui-sounds/` 34 个文件）之后仍缺的槽位：国语 K 歌、真菜市场、地铁到站叮、失败提示、真实雨声，以及做饭、健身房、办公室键盘、咖啡馆、医院、轮渡汽笛、机场、睡觉 8 个场景音。麻将 1 个槽位未填（见末尾）。

全部文件均用 ffprobe 核对（MP3 编码、时长合理）并经 ffmpeg 全文件解码，无报错。

## 文件夹结构

```
shenhui-sounds2/
├── sounds2-manifest.md         ← 本文件
├── music/
│   └── karaoke-cn/   karaoke-cn-1, karaoke-cn-2（国语 K 歌，带唱）
└── sfx/
    ├── market/       market-wet.mp3（真菜市场）
    ├── transit/      metro-ding.mp3（地铁到站叮）
    ├── ui/           fail.mp3（失败提示）
    ├── nature/       rain-real.mp3（真实雨声）
    └── scenes/       cooking, gym, keyboard-office, cafe, hospital,
                      ferry-horn, airport, sleep（8 个场景音）
```

## 授权总览（必读）

本包三种授权，按文件区分，**不要混用**：

1. **CC0（2 个文件，无需署名）**：`sfx/market/market-wet.mp3`、`sfx/scenes/hospital.mp3`。公有领域，可自由使用。
2. **CC-BY（4 个文件，必须署名）**：`music/karaoke-cn/` 2 首（CC-BY 4.0）、`sfx/transit/metro-ding.mp3`（CC-BY 3.0）、`sfx/scenes/ferry-horn.mp3`（CC-BY 3.0）。署名文案见下面「归属汇总」。
3. **Mixkit Sound Effects Free License（8 个文件，无需署名）**：`sfx/ui/fail.mp3`、`sfx/nature/rain-real.mp3`、`sfx/scenes/cooking.mp3`、`gym.mp3`、`keyboard-office.mp3`、`cafe.mp3`、`airport.mp3`、`sleep.mp3`。Mixkit 授权允许免费商用、**明确允许放进电子游戏**，无需署名；但**禁止把原始文件单独再分发**（不能当素材包卖、不能原样放进公开素材仓库）。嵌进游戏里用是合规的。

## 归属汇总（放进游戏致谢/设置页即可）

```
"寂静的夜空 (JiJingDeYeKong)" by Adeline Yeo (HP), licensed under CC BY 4.0
"梦中的你 (Meng Zhong De Ni)" by Adeline Yeo (HP), licensed under CC BY 4.0
"Store Door Chime" by Mike Koenig, CC BY 3.0, via SoundBible.com
FogHorn Barge by Daniel Simon, CC-BY 3.0, via SoundBible.com
Sound effects: Mixkit (mixkit.co) — optional, no attribution required
"Outdoor Market #1" — Joseph Sardin, BigSoundBank (CC0) — optional
Heart Monitor Beep by samfk360, CC0, via Wikimedia Commons — optional
```

---

## 1. 国语 K 歌 — `music/karaoke-cn/`（仅限 K 歌房，带唱）

### karaoke-cn-1.mp3
- 艺术家：Adeline Yeo (HP)｜曲名：寂静的夜空 (JiJingDeYeKong) — "The Silent Night Sky"
- 语言：国语流行抒情（歌词印在来源页）
- 许可证：**CC BY 4.0**（来源页徽章 + 文件 ID3 版权标签均已核对）
- 来源页：https://freemusicarchive.org/music/adeline-yeo-hp/single/jijingdeyekong/
- 时长：2:31（150.9 s），MP3 192 kbps，48 kHz，立体声
- 归属文案：`"寂静的夜空 (JiJingDeYeKong)" by Adeline Yeo (HP), licensed under CC BY 4.0`
- 注意：FMA 标注此曲为人声在内的 **AI 生成**曲目；授权干净，但 KTV 房里会是 AI 歌声而非真人演唱。

### karaoke-cn-2.mp3
- 艺术家：Adeline Yeo (HP)｜曲名：梦中的你 (Meng Zhong De Ni) — "You in My Dreams"
- 语言：国语（歌词印在来源页）
- 许可证：**CC BY 4.0**
- 来源页：https://freemusicarchive.org/music/adeline-yeo-hp/single/meng-zhong-de-ni/
- 时长：2:18（138.0 s），MP3 192 kbps，48 kHz，立体声
- 归属文案：`"梦中的你 (Meng Zhong De Ni)" by Adeline Yeo (HP), licensed under CC BY 4.0`
- 注意：同样为 AI 生成人声。

### 没找到的
- **粤语歌：一首符合 CC0/CC-BY 的都没找到。**最接近的是 ccMixter 的《The King (之王)》（传统粤语歌，Li Yao Ming 演唱），但授权是 CC BY-NC 3.0，不可用；Kou Chou Ching / MoShang / CABACA 均为 CC BY-NC-ND。国语方面，茉莉花、康定情歌都没有免费人声录音（茉莉花 Commons 只有 MIDI 和合成演示；康定情歌 1930–40 年代作品，未进入公有领域）。该艺术家的其余 4 首国语单曲均为 CC BY 4.0 但时长 3:52–4:55，超 3 分钟上限（心跳的声音、岁月的痕迹、你是我的星辰、风中的呢喃），如接受剪辑可再补。

---

## 2. 真菜市场 — `sfx/market/market-wet.mp3`
- 内容：BigSoundBank "Outdoor Market #1"（Joseph Sardin，法国 Nogent-le-Rotrou 露天市场实录：人群、摊位、脚步），**不是超市**。
- 用途：菜市场/街市场景的环境循环。
- 许可证：**CC0**，无需署名。
- 来源页：https://bigsoundbank.com/marche-exterieur-1-s2728.html
- 时长：90.0 s（原录音 3:19，截取至 90 s），48 kHz 立体声，192 kbps
- 注意：人群说的是法语，不是粤语——听感是通用的热闹露天市场，不是 specifically 广东/香港街市。没找到干净授权的粤语街市实录（ZapSplat 的新加坡街市录音需登录）。要地道的粤语街市声，得实地录音或约录。

## 3. 地铁到站叮 — `sfx/transit/metro-ding.mp3`
- 内容：SoundBible "Store Door Chime"（Mike Koenig），干净的双音 "ding-dong"，音色接近深圳地铁到站提示音。
- 用途：地铁到站/上车时播放一次。
- 许可证：**CC BY 3.0**，需署名。
- 来源页：https://soundbible.com/1599-Store-Door-Chime.html
- 时长：1.85 s，44.1 kHz 立体声
- 归属文案：`"Store Door Chime" by Mike Koenig, CC BY 3.0, via SoundBible.com`
- 注意：本身是商店门铃，不是真实地铁录音，选的是音色。更理想的 SFXMint "Door Chime Subway Train 02"（CC0）因共享网络当日下载限额用完没下到，**明天可重试**；Freesound 的布拉格地铁 C 线提示音（CC0）因 CDN 返回 403 没拿到。

## 4. 失败提示 — `sfx/ui/fail.mp3`
- 内容：Mixkit "Trombone disappoint"，短促的弱音长号 "wah" 失败音（喜剧感的答错提示）。
- 用途：失败反馈——考试/面试失败、选错、求职被拒、小游戏输了。
- 许可证：**Mixkit 免费授权**（可商用进游戏，无需署名；禁单独再分发）。
- 来源页：https://mixkit.co/free-sound-effects/discover/trombone/（ID 744）
- 时长：2.65 s，44.1 kHz 立体声
- 注意：是喜剧感的 "womp"，不是严厉的错误蜂鸣；要更严厉的可用同分类的 "Wrong answer fail notification" 或 "System beep buzzer fail"。

## 5. 真实雨声 — `sfx/nature/rain-real.mp3`
- 内容：Mixkit "Rain long loop"，真实稳定的降雨声，无雷声、无人声。
- 用途：雨天天气/户外场景的雨声循环（与游戏雨天 BGM 分开，BGM 本身不带雨声）。
- 许可证：**Mixkit 免费授权**（可商用进游戏，无需署名；禁单独再分发）。
- 来源页：https://mixkit.co/free-sound-effects/（雨声分类，ID 2394）
- 时长：111.1 s（源循环 57.1 s，用 3 s crossfade 拼接两遍以满足 60–120 s 要求；雨声是平稳噪声，接点听不出来）
- 注意：中等强度稳定雨声；要暴雨可换同分类的 "Heavy storm rain loop"。

---

## 6. 场景音 — `sfx/scenes/`

### cooking.mp3 — 做饭
- Mixkit "Frying eggs on hot pan"，煎蛋滋滋声，32.5 s；用途：厨房煎炒循环。**Mixkit 免费授权**。来源：https://mixkit.co/free-sound-effects/discover/frying/
- 注意：只有煎炒声，不含切菜声（Mixkit 的切菜片段只有 5–11 秒，不适合做场景主循环）。

### gym.mp3 — 健身房
- Mixkit "Pull and drop gym machine"，器械拉放 + 金属撞击，2.0 s；用途：健身动作触发音，**不适合做环境循环**。**Mixkit 免费授权**。来源：https://mixkit.co/free-sound-effects/discover/gym/
- 注意：仅 2 秒；Mixkit 健身房分类只有 4 条 1–2 秒短音，没有健身房环境长循环。如需环境底噪，要另找长循环或按动作触发 + 低音量人群底噪。

### keyboard-office.mp3 — 办公室键盘
- Mixkit "Keyboard random typing"，连续打字声，36.0 s；用途：办公室/写代码场景循环底音。**Mixkit 免费授权**。来源：https://mixkit.co/free-sound-effects/discover/keyboard-typing/

### cafe.mp3 — 咖啡馆
- Mixkit "Restaurant crowd talking ambience"，人群低语 + 餐具声，120.0 s；用途：咖啡馆环境循环。**Mixkit 免费授权**。来源：https://mixkit.co/free-sound-effects/discover/restaurant/
- 注意：原录音是餐厅人群声，没有突出的咖啡机蒸汽声；作咖啡馆底噪合适，可后续叠加蒸汽声。

### hospital.mp3 — 医院
- "Heart Monitor Beep"（samfk360，Freesound #148897，经 Wikimedia Commons 转存），监护仪滴滴声，27.9 s。**CC0**，无需署名。来源：https://commons.wikimedia.org/wiki/File:Heart_Monitor_Beep--freesound.org.mp3
- 注意：滴声先匀速、随后加速、最后停止，**不是匀速循环**；适合按看病事件触发播放，或只截取前面匀速的一段做循环。

### ferry-horn.mp3 — 轮渡汽笛
- SoundBible "FogHorn Barge"（Daniel Simon），一次低沉响亮的汽笛长鸣，5.0 s；用途：轮渡出发/靠岸触发一次。**CC BY 3.0**，需署名。来源：https://soundbible.com/2142-FogHorn-Barge.html
- 归属文案：`FogHorn Barge by Daniel Simon, CC-BY 3.0, via SoundBible.com`
- 注意：SoundBible 上 "Boat Horn" 标注为 Personal Use Only，已避开；下载时核对 id 2142（错用 1498 会拿到 48 秒火箭声）。

### airport.mp3 — 机场
- Mixkit "Busy crowd at airport terminal"，航站楼人群环境音，66.1 s；用途：机场场景循环底音。**Mixkit 免费授权**。来源：https://mixkit.co/free-sound-effects/airport/（ID 1573）
- 注意：只有人群环境音，不含登机广播人声；如需广播感，可叠加一枚提示叮声。

### sleep.mp3 — 睡觉
- Mixkit "Sleep soft snore"，轻柔鼾声，18.1 s；用途：睡觉/过夜场景。**Mixkit 免费授权**。来源：https://mixkit.co/free-sound-effects/sleep/（ID 1911）
- 注意：是真实的轻鼾声，不是安静夜晚氛围；要更安静的可用同分类 "Sleep breathing"（ID 1914，均匀呼吸声）。

---

## 跳过的槽位

### mahjong.mp3 — 麻将洗牌/摸牌声（未填）
- 最接近的候选：SFXMint "Mahjong 02"——麻将桌洗牌/碰牌声，7.3 秒，**CC0**，来源页 https://sfxmint.com/sounds/mahjong ，直链 https://sfxmint.com/dl/mahjong-02.mp3 。这是全网唯一找到的授权干净且内容对口的麻将洗牌声。
- 为什么没拿到：SFXMint 无账号下载每网络每天限 5 个，本机所在共享网络的当日限额已用完（两次实测返回 download_limit 错误）。提高限额需注册免费账号拿 API key（即登录，任务要求不允许）。
- **建议：明天限额重置后直接从直链重试下载即可，无需重新找源**；或用 SFXMint 免费账号的 API key 下载。注意该站说明其音效为 AI 生成/程序合成（非实地录音）。
- 其他已排除：Orange Free Sounds 两条麻将音效均为 CC BY-NC 4.0（非商业，不可用）；Wikimedia Commons 无麻将音频；OpenGameArt 只有牌面图片；Pixabay 搜不到且本站被屏蔽；Bandcamp 香港麻将馆氛围音为付费专辑（$5+），授权不明；Freesound 需登录。

## 授权不确定性
- metro-ding.mp3：SoundBible 标注 "Attribution 3.0"，按来源页标注署名即可；未另行核对授权契约。
- Mixkit 文件：Mixkit 授权全文在 https://mixkit.co/license/ 的弹窗中，条款摘要以各音效页标注为准；禁单独再分发，嵌进游戏用没问题。
- mahjong.mp3：SFXMint 的 CC0 声明仅基于来源页元数据，文件未下载到，实际下载后请再做一次 ffprobe/解码验证。
- 未使用 BBC 音效（不允许商用游戏）、未使用 Freesound（需登录）、Pixabay 在本环境打不开故未采用、未购买任何内容、未使用任何登录。
