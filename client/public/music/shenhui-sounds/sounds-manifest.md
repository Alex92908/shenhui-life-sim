# 湾区人生 / Bay Area Life — 音效 + 额外音乐清单

34 个 MP3 文件，全部为游戏免费可用授权，2026-11-10 下载并核查。放进游戏后按下面「建议用途」挂接即可。
第一批 7 首背景音乐（day/night/citypop/piano/rain/club/scenic）不在本包，见 `~/workspace/shenhui-music/music-manifest.md`。

## 文件夹结构

```
shenhui-sounds/
├── sounds-manifest.md          ← 本文件
├── sfx/
│   ├── nature/    8 个（雷、鸟、海鸥、蟋蟀、蝉、海浪、风）
│   ├── city/      6 个（喇叭、交通、地铁、人群、市场、脚步）
│   ├── voices/    4 个（人群低语、笑声、掌声、欢呼）
│   └── ui/        5 个（点击、金币、成功、通知、开门）
└── music/
    ├── bgm-day2 / bgm-night2 / bgm-piano2 / bgm-ambient2 / bgm-morning / bgm-sunset（6 首纯音乐）
    └── karaoke/   karaoke-1 … karaoke-5（5 首带唱 KTV 歌，仅限 K 歌房）
```

共 34 个文件，约 74 MB。全部用 ffprobe 核对（MP3 编码、时长合理）并经 ffmpeg 全文件解码，无报错。

## 授权总览（必读）

本包有三种授权，按文件区分，**不要混用**：

1. **CC0（3 个文件，无需署名）**：`sfx/nature/seagulls.mp3`、`sfx/nature/cicadas.mp3`、`music/bgm-night2.mp3`。公有领域，可自由使用。
2. **CC-BY（10 个文件，必须署名）**：`music/` 下除 night2 外的 5 首 + `music/karaoke/` 5 首。署名文案见下面「归属汇总」，放进游戏致谢/设置页即可。
3. **Mixkit Sound Effects Free License（21 个文件，无需署名）**：`sfx/nature/` 其余 6 个 + `sfx/city/`、`sfx/voices/`、`sfx/ui/` 全部 15 个。Mixkit 授权允许免费商用、**明确允许放进电子游戏**，无需署名；但**禁止把原始文件单独再分发**（不能当素材包卖、不能原样放进公开素材仓库、不能和源文件一起提供）。嵌进游戏里用是合规的；如果以后要卖/开源「音效包」，须先把这 21 个换成 CC0 替代品。

另外：没有用 BBC 音效（不允许商用游戏），没有用 Freesound（下载要登录），Pixabay 在本环境打不开故未采用。没有任何一首是只「能免费听」不能用的。

## 归属汇总（放进游戏致谢/设置页即可）

```
"Happy Whistling Ukulele" by Rafael Krux, CC-BY 4.0
"Still Life (Lofi, Chill, Nostalgic)" — HoliznaCC0, CC0 1.0 (public domain)
"Lovely Piano Song" by Rafael Krux, CC-BY 4.0
"River Meditation" by Jason Shaw (Audionautix), CC-BY 3.0
"Adding the Sun" — Kevin MacLeod (incompetech.com), CC-BY 4.0
"Martini Sunset" — Kevin MacLeod (incompetech.com), CC-BY 4.0
"Explode" by Kellee Maize, CC BY 3.0
"One Cute Leash" by Geoff Peters, CC BY 3.0
"I Wanna Know" by Josh Woodward, CC BY 4.0
"Procrastinating_in_The_Sun" by Stefan Kartenberg, featuring Thespinwires, CC BY 3.0
"Silent Grey" by Amarent, CC BY 4.0
Sound effects: Mixkit (mixkit.co) — optional, no attribution required
"Gulls on the Harbor" — Joseph Sardin, BigSoundBank (CC0) — optional
"Cicadas" — Clarisse, BigSoundBank (CC0) — optional
```

---

## A) 自然 / 环境音 — `sfx/nature/`

| 文件 | 内容 | 授权 | 时长 | 来源页 |
|---|---|---|---|---|
| thunder-close.mp3 | 近处一声巨雷（Mixkit "Strong close thunder explosion"），打雷闪电时触发 | Mixkit 免费授权 | 8.87 s | https://mixkit.co/free-sound-effects/thunder/ |
| thunder-distant.mp3 | 远处闷雷滚动（Mixkit "Distant thunder explosion"），暴风雨逼近时做背景 | Mixkit 免费授权 | 13.38 s | https://mixkit.co/free-sound-effects/thunder/ |
| birds-morning.mp3 | 清晨鸟鸣（Mixkit "Morning birds singing"），白天户外循环 | Mixkit 免费授权 | 120.09 s | https://mixkit.co/free-sound-effects/birds/ |
| seagulls.mp3 | 港口海鸥（Joseph Sardin "Gulls on the Harbor"，BigSoundBank #2573），海边循环 | CC0 1.0 | 114.13 s | https://bigsoundbank.com/gulls-on-the-harbor-s2573.html |
| crickets-night.mp3 | 夏夜蟋蟀循环（Mixkit "Summer night crickets loop"），夜晚户外循环 | Mixkit 免费授权 | 42.00 s | https://mixkit.co/free-sound-effects/night/ |
| cicadas.mp3 | 夏蝉齐鸣（Clarisse "Cicadas"，BigSoundBank #3002），夏天白天循环 | CC0 1.0 | 48.53 s | https://bigsoundbank.com/cicadas-s3002.html |
| ocean-waves.mp3 | 海浪循环（Mixkit "Sea waves loop"），海边循环，可叠加海鸥 | Mixkit 免费授权 | 48.25 s | https://mixkit.co/free-sound-effects/sea/ |
| wind.mp3 | 风声（Mixkit "Wind blowing ambience"），户外风声底乐 | Mixkit 免费授权 | 61.84 s | https://mixkit.co/free-sound-effects/wind/ |

循环提示：「Sea waves loop」「Summer night crickets loop」本身是循环设计的；其余长环境音用短 crossfade 循环即可；两声雷是一次性音效，不是循环。

## B) 城市 — `sfx/city/`

| 文件 | 内容 | 授权 | 时长 | 来源页 |
|---|---|---|---|---|
| car-horn.mp3 | 汽车双声喇叭（Mixkit "Car Double Horn"），街头/打车事件 | Mixkit 免费授权 | 0.92 s | https://mixkit.co/free-sound-effects/car-double-horn-719/ |
| traffic-ambience.mp3 | 街道车流底噪（Mixkit "City Traffic Background Ambience"），城市地图循环 | Mixkit 免费授权 | 67.19 s | https://mixkit.co/free-sound-effects/city-traffic-background-ambience-2930/ |
| metro-ambience.mp3 | 地铁车厢内轰鸣（Mixkit "Subway Interior Ambience"），地铁/港铁场景循环 | Mixkit 免费授权 | 32.95 s | https://mixkit.co/free-sound-effects/subway-interior-ambience-2680/ |
| crowd-street.mp3 | 市中心人群环境音（Mixkit "City Downtown Crowd Ambience"），步行街/广场循环 | Mixkit 免费授权 | 120.09 s | https://mixkit.co/free-sound-effects/city-downtown-crowd-ambience-361/ |
| market-ambience.mp3 | 超市人群环境音（Mixkit "People At The Supermarket Ambience"），市场/商场场景循环 | Mixkit 免费授权 | 31.58 s | https://mixkit.co/free-sound-effects/people-at-the-supermarket-ambience-352/ |
| footsteps.mp3 | 隧道里走路脚步循环（Mixkit "Footsteps In A Tunnel Loop"），走路/地下通道 | Mixkit 免费授权 | 8.14 s | https://mixkit.co/free-sound-effects/footsteps-in-a-tunnel-loop-543/ |

注意：`market-ambience.mp3` 实际是超市/商场人群声，不是真正的露天菜市场/街市录音，是无登录来源里最接近的替代。想换真正的街市录音可考虑 Freesound 上 amoyssiadis 的 "Through a street market in São Paulo - Brazil (Feira)"（https://freesound.org/people/amoyssiadis/sounds/410650/，12:18），需免费注册 Freesound 账号下载，下载前先核对该页授权。

## C) 人声（环境音，无可辨识对话/歌词）— `sfx/voices/`

| 文件 | 内容 | 授权 | 时长 | 来源页 |
|---|---|---|---|---|
| crowd-murmur.mp3 | 大群人 indistinct 闲聊循环（Mixkit "Big Crowd Talking Loop"），广场/车站/餐厅底噪 | Mixkit 免费授权 | 59.74 s | https://mixkit.co/free-sound-effects/big-crowd-talking-loop-364/ |
| laughter.mp3 | 一群人笑声（Mixkit "Big Crowd Laughing"），Livehouse/派对/搞笑事件 | Mixkit 免费授权 | 7.45 s | https://mixkit.co/free-sound-effects/big-crowd-laughing-460/ |
| applause.mp3 | 演出结束掌声（Mixkit "End Of Show Clapping Crowd"），演出结束/领奖时刻 | Mixkit 免费授权 | 8.95 s | https://mixkit.co/free-sound-effects/end-of-show-clapping-crowd-477/ |
| cheering.mp3 | 人群欢呼（Mixkit "Huge Crowd Cheering Victory"），大胜/演唱会高潮 | Mixkit 免费授权 | 10.06 s | https://mixkit.co/free-sound-effects/huge-crowd-cheering-victory-462/ |

## D) UI / 游戏音效 — `sfx/ui/`

| 文件 | 内容 | 授权 | 时长 | 来源页 |
|---|---|---|---|---|
| click.mp3 | 经典点击声（Mixkit "Classic Click"），按钮/切换 | Mixkit 免费授权 | 0.29 s | https://mixkit.co/free-sound-effects/classic-click-1117/ |
| coin.mp3 | 金币拾取（Mixkit "Game Treasure Coin"），发工资/打工收入 | Mixkit 免费授权 | 2.34 s | https://mixkit.co/free-sound-effects/game-treasure-coin-2038/ |
| success.mp3 | 成功提示音（Mixkit "Fantasy Game Success Notification"），成就/升级/任务完成 | Mixkit 免费授权 | 3.00 s | https://mixkit.co/free-sound-effects/fantasy-game-success-notification-270/ |
| notification.mp3 | 消息提示音（Mixkit "Message Pop Alert"），手机消息/系统通知 | Mixkit 免费授权 | 1.06 s | https://mixkit.co/free-sound-effects/message-pop-alert-2354/ |
| door.mp3 | 开门吱呀声（Mixkit "Creaky Door Open"），进家门/进店 | Mixkit 免费授权 | 2.68 s | https://mixkit.co/free-sound-effects/creaky-door-open-195/ |

## E) 额外背景音乐（纯音乐，无歌词）— `music/`

与第一批 7 首不重复，可接入自动切换系统。**本批 6 首结尾全部有淡出**（实测最后 5 秒平均音量比中段低 14–28 dB），循环时请用短 crossfade；第一批只有 day.mp3 能干净循环，同样建议 crossfade。

| 文件 | 艺术家 — 曲名 | 授权 | 时长 | 来源页 |
|---|---|---|---|---|
| bgm-day2.mp3 | Rafael Krux — Happy Whistling Ukulele（明快尤克里里，白天） | CC-BY 4.0 | 123.22 s | https://filmmusic.io/song/5453-happy-whistling-ukulele |
| bgm-night2.mp3 | HoliznaCC0 — Still Life (Lofi, Chill, Nostalgic)（柔和 lo-fi，夜晚） | CC0 1.0 | 134.84 s | https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/still-life-lofi-chill-nostalgic/ |
| bgm-piano2.mp3 | Rafael Krux — Lovely Piano Song（安静钢琴） | CC-BY 4.0 | 95.79 s | https://github.com/SoundSafari/CC0-1.0-Music（FreePD 镜像；freepd.com 已关闭） |
| bgm-ambient2.mp3 | Jason Shaw (Audionautix) — River Meditation（原声吉他冥想，氛围底乐） | CC-BY 3.0 | 167.07 s | http://freemusicarchive.org/music/Jason_Shaw/Audionautix_Acoustic/RIVER_MEDITATION___________2-58 |
| bgm-morning.mp3 | Kevin MacLeod — Adding the Sun（温暖日出，清晨，约 90 BPM） | CC-BY 4.0 | 176.03 s | https://incompetech.filmmusic.io/song/5708-adding-the-sun |
| bgm-sunset.mp3 | Kevin MacLeod — Martini Sunset（轻爵士，温暖傍晚） | CC-BY 4.0 | 174.05 s | https://github.com/SoundSafari/CC0-1.0-Music（FreePD 镜像） |

备注：
- `bgm-day2.mp3` 的 "Whistling" 是旋律口哨（无歌词、无演唱），仍属器乐；如介意口哨音色可换。
- `bgm-ambient2.mp3` 只有 128 kbps、`bgm-morning.mp3` 134 kbps，音质略低于其余曲目（256–320 kbps），但可接受；morning 文件内嵌一张封面图，不影响播放。
- 双重标注处理：除 night2 外其余 5 首在 FreePD 标 CC0、在 incompetech/filmmusic.io 或 FMA 标 CC-BY，一律按较严格的 CC-BY 署名（与第一批 "Horizon Flare" 同样处理），无论按哪一方标注都合规。"River Meditation" 按 FMA 来源页的 CC-BY 3.0 署名（个别第三方引用写 4.0）。

## F) K 歌房（带唱歌曲，仅限 KTV 场景）— `music/karaoke/`

**仅限 K 歌房使用；游戏其他地方的音乐一律是纯音乐。** 5 首全部是英文带唱歌曲，CC-BY 授权（商用需署名，见归属汇总）。

| 文件 | 艺术家 — 曲名 | 语言 | 授权 | 时长 | 来源页 |
|---|---|---|---|---|---|
| karaoke-1.mp3 | Kellee Maize — Explode（ upbeat 说唱） | 英语 | CC BY 3.0 | 167.94 s | https://freemusicarchive.org/music/Kellee_Maize/Owl_Time/05__Kellee_Maize__Explode__Owl_Time__FROSTWIRECOM_FROSTCLICKCOM__CREATIVE_COMMONS_1009/ |
| karaoke-2.mp3 | Geoff Peters — One Cute Leash（轻快流行，130 BPM，男声） | 英语 | CC BY 3.0 | 135.69 s | https://ccmixter.org/files/geoffpeters/58766 |
| karaoke-3.mp3 | Josh Woodward — I Wanna Know（流行/民谣唱作） | 英语 | CC BY 4.0 | 158.03 s | https://freemusicarchive.org/music/Josh_Woodward/The_Simple_Life_Part_2_1667/JoshWoodward-TheSimpleLife-210-IWannaKnow/ |
| karaoke-4.mp3 | Stefan Kartenberg ft. Thespinwires — Procrastinating_in_The_Sun（摇滚/流行，151 BPM，男声） | 英语 | CC BY 3.0 | 178.16 s | https://ccmixter.org/files/JeffSpeed68/46416 |
| karaoke-5.mp3 | Amarent — Silent Grey（柔和流行唱作） | 英语 | CC BY 4.0 | 177.75 s | https://freemusicarchive.org/index.php/music/amarent/free-soft-pop/silent-grey/ |

注意：
- **国语/粤语歌没找到可用的。** 搜了 FMA、Jamendo、ccMixter 和 CC Asia 的 CABACA 项目，能找到的只有受版权保护的流行歌（周杰伦《稻香》、陈慧娴《千千闋歌》等，仅限流媒体播放，不能放进游戏）和 2008 年的老项目（多为器乐/混音素材，没有可验证的国语流行演唱曲）。想要国语/粤语 KTV 歌，需要定制原创或直接找独立音乐人授权。
- **歌词未逐行核对**：「Explode」是说唱，艺人风格一般是干净说唱，但上线前请先听一遍确认；其余 4 首没有已知的不当内容。
- 「One Cute Leash」是一首讲狗的趣味歌，KTV 里唱着好玩，但风格比较俏皮，想换更正统的流行歌可以换。

## 跳过的空位

**无。** 任务列出的 29 个空位（自然 8、城市 6、人声 4、UI 5、额外音乐 6）全部填满；K 歌房 5 首也齐了。唯一的缺口是上面说的国语/粤语 KTV 歌——搜过、没找到干净授权的版本，不是没搜。

## 核查记录

- 全部 34 个文件均用 ffprobe 核对：MP3 编码，时长与上表一致，ffmpeg 全文件解码无报错。
- 许可证均在曲目/音效的来源页上核对过；未使用任何需要登录/付费的来源，未购买任何内容。
- Pixabay 在本环境打不开（策略拦截 / Cloudflare 403），Freesound 因下载需登录未用，BBC 音效因不允许商用游戏未用；freepd.com 原站已关闭，其曲库来自 SoundSafari/CC0-1.0-Music GitHub 镜像。
