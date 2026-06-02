# SS_Mario — Web Mario (Software Studio Assignment 02)

NTHU CS2410 Software Studio｜Assignment 02「Web Mario」

一款以 **Cocos Creator 2.4.x** 製作的 Mario 風格橫向捲軸遊戲，整合 **Firebase** 會員系統、排行榜（Leaderboard）、即時多人「玩家幻影」（Multiplayer Phantom），並具備**無障礙鍵盤導航**的登入介面與關卡選單。

## Tech Stack

| 項目 | 內容 |
|------|------|
| Game Engine | Cocos Creator 2.4.x（Box2D 物理） |
| Backend / BaaS | Firebase Authentication + Realtime Database (RTDB) |
| Hosting | Firebase Hosting（`public = SS_Mario_Frontend/build/web-mobile`） |
| Firebase Project | `ss-mario-250da` |
| 語言 | TypeScript + JavaScript |

- **Firebase 部署網址 / Live URL**：`TODO：請填入 Firebase Hosting 連結`
- **GitHub Repo**：`TODO：請填入 repo 連結`

### 如何開啟與 Build
1. 用 Cocos Creator 2.4.x 開啟 `SS_Mario_Frontend/` 專案。
2. 主場景：`StartScene`（登入）→ `LevelSelectScene`（選單）→ `Level1` / `Level2`。
3. Build：選 **web-mobile** 平台，輸出至 `SS_Mario_Frontend/build/web-mobile`。
4. 部署：於 repo 根目錄執行 `firebase deploy`（hosting 來源已於 `firebase.json` 指向 build 目錄）。

---

## 分工 / Contribution

> 依各人功能職責劃分。**陳可冀**主責後端整合相關（對應後端整合版 rubric）。

| 成員 | 主責範圍 |
|------|----------|
| **陳可冀** | **Leaderboard（排行榜）** 與 **Multiplayer（多人玩家幻影）**；Firebase 整合、後端/部署相關 |
| 另一位組員（前端本體） | 遊戲本體：World Map / 關卡設計 / Player / Enemies / Question Blocks / 動畫 / 音效 / UI / 外觀 |

完成項目與細節對照下方兩段評分標準說明。

---

# 第一段 ── 對照「標準版 rubric」(Web Mario PDF)

對應 `Ref/2026(Spring)_SS-Assignment_02_Web Mario.pdf`，總分上限 110%。逐項對照如下（皆已完成 ✅）。

| 評分項目 | 配分 | 狀態 | 實作位置 |
|----------|------|------|----------|
| Complete Game Process | 5% | ✅ | `StartSceneManager.ts` / `LevelSelectManager.ts` / `GameManager.ts` |
| Basic Rules | 50% | ✅ | 見下方細項 |
| Animations | 10% | ✅ | `assets/Animation/`（完整清單見後） |
| Sound Effects | 10% | ✅ | `assets/AS2_source/audio/`（完整清單見後） |
| UI | 10% | ✅ | `GameManager.ts` HUD |
| Appearance | 10% | ✅ | 美術素材整合 |
| Bonus | 10% | ✅ | Firebase / Login / Leaderboard / Multiplayer（見第二段） |
| Git | 5% | ✅ | 規律 commit（見 Git history） |

### Complete Game Process (5%)
完整 4 場景流程：
`StartScene`（登入/註冊）→ `LevelSelectScene`（關卡選擇 + 排行榜）→ `Level1` / `Level2`（遊戲畫面，含 Game Start panel 與 Game Over panel）→ 結束後自動回選單。
流程由 `StartSceneManager.ts`、`LevelSelectManager.ts`、`GameManager.ts` 依玩家與遊戲狀態控制（start panel 顯示 1 秒、win/gameover panel、回選單）。

### Basic Rules (50%)
- **World Map (10%)**：Box2D 物理，重力 `cc.v2(0, -960)`（`GameManager.ts:96`）；物件受重力下墜、正確碰撞；相機與背景隨玩家移動 —— 相機 `CameraFollow.ts`、視差背景 `BgFollow.ts`（X 方向 0.5 半速視差）；Tiled 地圖碰撞由 `TiledMapCollider.ts` 自動產生。**共 2 個關卡**（Level1、Level2，超過「至少 1 個」要求）。
- **Level Design (5%)**：場景含 **Static 靜態牆**（Tiled 碰撞層轉成 Static RigidBody）；含可與玩家互動的**問號磚** `QuestionBlock.ts`。
- **Player (15%)**：`PlayerController.ts` 正確物理屬性，鍵盤控制移動與跳躍；碰到敵人/被攻擊會受傷、出界會扣命、死亡後於起點重生（詳見〔專節 C〕）。
- **Enemies (15%)**：**2 種敵人** —— Goomba（`GoombaController.ts`，左右巡邏，**只有踩頭可擊殺**）、Piranha Plant（`PiranhaPlantController.ts`，上下巡邏，**不可踩、碰到必受傷**）。皆具正確物理屬性。
- **Question Blocks (5%)**：問號磚被下方撞擊後彈出 **Super Mushroom**（`QuestionBlock.ts` + `SuperMushroom.ts`），玩家吃到變大（Big Mario）。

### Animations (10%) — 完整清單
動畫定義於 `assets/Animation/`，播放邏輯見各 Controller：

| 對象 | 動畫 | 觸發 |
|------|------|------|
| Player | `idle` / `run`(loop, 6 frames) / `jump` / `grow` / `die` | `PlayerController.updateAnimation()` 依 grounded 狀態與水平速度自動切換；`grow` 於變大、`die` 於死亡時播放 |
| Goomba | `walk`(loop) / `dead` | `walk` 於 `onLoad`；`dead` 於被踩扁，0.4 秒後銷毀 |
| Piranha Plant | `idle`(loop) | `onLoad`，搭配垂直 tween 上下巡邏 |
| Coin | `spin`(loop) | `CoinController` `onLoad` |
| 程序動畫 | 問號磚撞擊上下彈跳（tween）、玩家受傷後無敵閃爍（opacity 閃爍） | `QuestionBlock.ts` / `PlayerController.ts` |

### Sound Effects (10%) — 完整清單
音檔位於 `assets/AS2_source/audio/`：

- **BGM**：`bgm_1.mp3`、`bgm_2.mp3`、`bgm_3.mp3`、`levelClear.mp3`、`PowerUp.mp3`
- **SFX**：`jump.wav`(跳躍)、`coin.wav`(吃金幣)、`stomp.wav`(踩怪)、`loseOneLife.wav`(死亡/失去一命)、`powerDown.wav`(縮小)、`powerUpAppear.wav`(蘑菇出現)
- **結束音樂**：`Game Over.mp3` / `Game Over2.mp3`

觸發點：

| 事件 | 檔案 / 函式 | 種類 |
|------|------------|------|
| 關卡 BGM（loop） | `GameManager.onLoad()` `playMusic(bgm, true)` | BGM |
| 玩家死亡 | `GameManager.triggerPlayerDeath()` / `PlayerController.die()` | SFX |
| 跳躍 / 踩怪 / 變大 / 受傷 | `PlayerController`（jump / stomp / grow / hurt） | SFX |
| 吃金幣 | `CoinController` | SFX |
| 吃蘑菇 | `SuperMushroom.collect()` | SFX |
| 過關 | `GoalPole` / `GameManager.showWin()` | SFX |

> ✅ **所有 SFX 皆以 `playEffect(clip, false)` 疊放於 BGM 之上，不會中斷 BGM**；BGM 僅於 Game Over 與 Win 時以 `stopMusic()` 停止（`GameManager.ts:198, 215`）。符合「All sound effects can't stop BGM」要求。

### UI (10%)
HUD 由 `GameManager.ts` 維護：
- **Player life (3%)**：`Lives: x{n}`（`updateLivesLabel`）
- **Player score (5%)**：六位補零 `SCORE: 000000`（`updateScoreLabel`）
- **Timer (2%)**：由 0 上數 `TIME: mm:ss`（`updateTimerLabel`）

### Appearance (10%) / Git (5%)
美術素材整合美化；使用 Git 版本控制並規律 commit（非最後一天才上傳）。

---

# 第二段 ── 對照「後端整合版 rubric」(Backend PDF)

對應 `Ref/SS HW2 Backend.pdf`。此份評分偏重 backend / deployment / integration / accessibility / documentation。標【陳可冀】者為其主責項目。

| 評分項目 | 配分 | 狀態 |
|----------|------|------|
| Game Process Understanding & Core Gameplay Integration | 25% | ✅ |
| Firebase / Deployment | 15% | ✅ |
| Authentication & Save/Restore | 15% | ✅（Save/Restore 現狀見說明） |
| Leaderboard / Score Persistence【陳可冀】 | 10% | ✅ |
| Multiplayer / Backend Feature【陳可冀】 | 10% | ✅ |
| Accessibility Contribution | 10% | ✅ |
| Git / Version Control | 5% | ✅ |
| README / Technical Documentation | 10% | ✅（本文件） |

### Game Process Understanding & Core Gameplay Integration (25%)
完整理解並整合遊戲流程（start menu → level select → gameplay → game over）與玩家狀態。核心系統（player life / score / timer、敵人行為、問號磚、遊戲狀態轉換）詳見〔專節 C〕。多人同步元件於 `GameManager.onLoad()` **自動掛載**（`GameManager.ts:136-138`），無需編輯器手動連線即整合進每個關卡。

### Firebase / Deployment (15%)
- `firebase.json`：hosting `public = SS_Mario_Frontend/build/web-mobile`，database rules 指向 `SS_Mario_Backend/database.rules.json`。
- Firebase 專案 `ss-mario-250da`，主頁為 `index.html`，已部署且可正常運作。
- RTDB 規則：`leaderboard`（公開讀寫、`.indexOn: score`）、`users/<uid>/gameProgress`（限本人）、`rooms/<roomId>/players/<uid>`（需登入，僅可寫自己節點）。

### Authentication & Save/Restore (15%)
- **Firebase 設定**：`Firebase.js`（Firebase SDK 10.14.1，採 **SESSION persistence**，讓**同一台機器的不同分頁可登入為不同玩家** —— 方便本機測試多人）。
- **註冊 / 登入 / 登出**：`Auth.js` 提供 `register / login / logout`；註冊時建立 Firebase Auth 使用者、設定 `displayName`，並寫入 `users/<uid>`（username、email、createdAt）。
- **登入介面**：`StartSceneManager.ts` 自動登入檢查（已登入直接進選單）、輸入驗證（email 格式、username 2–20 字、password ≥ 6 字）、紅/綠色彩訊息回饋。登出於 `LevelSelectManager.ts`。
- **Save / Restore（誠實說明現狀）**：
  - **Save ✅**：過關時 `GameManager.saveProgress()` 將 `{ lives, level, score, savedAt }` 寫入 `users/<uid>/gameProgress`。
  - **跨場景狀態保存 ✅**：因 `cc.director.loadScene()` 會重建所有節點，生命與計時改用**模組層變數** `_persistedLives` / `_persistedTimer` 保存，死亡重生時不會被重置。
  - **Restore（限制）⚠️**：`GameManager.loadProgress()` 目前為**「讀取但刻意不套用」(no-op)**。原因：若用存檔的 `level`/`lives` 覆蓋當前關卡，會造成「在 Level2 死亡卻重載到 Level1」等錯誤關卡進度問題；保留為 no-op 讀取以維持 onLoad 的 promise 時序（start panel 延遲）一致。**未來改進**：可加入「繼續遊戲」入口，明確讓玩家選擇是否還原存檔，避免污染當前關卡流程。

### Leaderboard / Score Persistence (10%)【陳可冀】
- `Leaderboard.js` **直連 Firebase RTDB**（`leaderboard` 路徑，無需自架後端伺服器）。
- 每筆資料：`{ username, level, score(完成秒數，越低越好，作為排名依據), coins(收集金幣分數，顯示用), timestamp(server-stamped) }`。
- 讀取以 `orderByChild("score")` 排序（時間越短排越前）；RTDB rule 設 `.indexOn: ["score"]` 加速排序。
- 排行榜採 **append 模式**：每次過關 `Leaderboard.submitEntry()` 以 `push()` 新增一筆（保留所有場次），並非只存最佳；「最佳」於顯示時即時計算。
- `LevelSelectManager.ts` 顯示排行榜（名次、使用者名、完成時間、金幣分數、日期）並依關卡篩選。
- **每個關卡按鈕下方顯示「該關卡的個人最佳」**（`RecordText1` / `RecordText2`）：
  - **時間**取登入者在該關卡的最短完成時間、**分數**取最高金幣分數（兩者各自取最佳，可能來自不同場次）—— `findBestEntry()` / `findBestScore()`（`LevelSelectManager.ts`）。
  - **還沒玩過 / 未登入 / 讀取中**一律顯示 `Time: --:--` 與 `Score: 0`（共用 `EMPTY_RECORD` 佔位字串，避免殘留舊值）。
- 過關時由 `GameManager.submitToLeaderboard()` 提交（含使用者名、關卡、完成秒數、金幣數）。

### Multiplayer / Backend Feature (10%)【陳可冀】 — 玩家幻影運作原理
> 即時多人「玩家幻影」採 **Firebase Realtime Database** 同步。其他線上玩家會以**半透明幻影**即時出現在你的關卡中。

**架構與運作流程**：
1. **資料節點**：每位玩家在 RTDB 擁有一個節點 `rooms/<roomId>/players/<uid>`（`RoomSync.js:46-47`）。**輸入相同 `roomId` 的玩家即可彼此看見**（無自動配對，需雙方約定房號）。
2. **加入房間**：`RoomSync.join()` 寫入初始狀態，並設定 `onDisconnect().remove()` —— 分頁關閉或斷線時**自動清除**自己的節點（`RoomSync.js:53`）。
3. **事件監聽**：監聽 `child_added` / `child_changed` / `child_removed`，分別對應他人**加入 / 移動 / 離開**（`RoomSync.js:57-70`）。
4. **狀態廣播**：預設 **15 Hz**（`MultiplayerSync.ts:35`），每個 tick 透過 `sendState` 送出 `{ x, y, facingRight, anim, state }`（`RoomSync.js:82-90`）。
5. **幻影渲染**：`MultiplayerSync.ts` 為每位遠端玩家生成一個半透明 puppet（`ghostOpacity` 預設 120/255）。puppet 由本地 Player 節點複製，並經 **`stripToVisual()` 移除 input / RigidBody / Collider**（`:318-335`），確保它**純視覺、不可被操控、不參與物理碰撞**。
6. **平滑移動**：以 `lerpSpeed`（預設 12）對目標座標插值，避免網路更新造成跳動；首次更新直接 snap 到位（`:153-168, :222-227`）。
7. **動作 / 方向 / 體型鏡像**：依收到的 `anim` 播放對應動畫；`scaleX` 帶 facing 翻轉、`scaleY` 帶體型大小，完整鏡像對方的 growBig / shrink 視覺（`:229-242`）。
8. **名牌**：每個幻影上方有獨立 Label 兄弟節點顯示其使用者名（不受翻轉與透明度影響）（`:301-312`）。
9. **自動掛載**：`GameManager.onLoad()` 自動為關卡加上 `MultiplayerSync`；若未登入則自動成為 no-op（`GameManager.ts:136-138`、`MultiplayerSync.start():99-103`）。

**What works / Limitations（rubric 要求說明）**：
- ✅ 可運作：即時位置 / 動畫 / 方向 / 體型同步、加入/離開自動處理、斷線自動清除、同房多人。
- ⚠️ 限制：屬**展示型同步**，無權威伺服器仲裁，幻影間**不做碰撞互動**；房號需雙方手動約定（無 matchmaking / lobby）。
- 📌 備註：repo 另含一套以 **Socket.io** 為基礎的後端伺服器 `SS_Mario_Backend/server.js`（room session、低延遲同步）作為替代實作，但**正式部署版以 Firebase RTDB 路徑為準**。

### Accessibility Contribution (10%) — 無障礙登入介面與關卡選單
> 核心為 `FocusManager.ts`（鍵盤導航）與 `AccessibilitySettings.js`（以 localStorage 記住 `a11yModeActive`，跨頁保留）。

**通用無障礙導航機制**：
- **啟用**：按 `/` 切換無障礙鍵盤導航模式（`FocusManager.ts:159-169`）；設定存 localStorage。
- **操作**：`↑` / `↓` 在可聚焦元件間移動，`Enter` / `Space` 啟用（點擊按鈕，或進入 EditBox 編輯）（`:174-224`）。
- **焦點順序**：自動掃描場景中所有 `cc.Button` / `cc.EditBox`，依**由上到下（Y 遞減）、由左到右（X 遞增）** 排序，符合直覺 tab 順序（`:118-145`）。
- **視覺焦點指示**：當前焦點以**雙層外框**標示（外層黃色 4px + 內層白色 2px）（`:255-294`）。
- **螢幕提示**：場景中 `A11yHint` Label 顯示中文操作提示，OFF / ON 兩段文字（`:49-50`）。
- **瀏覽器整合**：於 document 層攔截方向鍵 / 空白鍵的預設行為（防頁面捲動）、攔截 `/`（防 Firefox Quick Find），並在焦點漂移時把 focus 拉回 game canvas，確保鍵盤事件持續送達（`:75-101`）。

**① 無障礙登入介面（StartScene）** —— `StartSceneManager.ts`
- 初始化 `FocusManager.ensure()`，自動發現 Email / UserName / Password 輸入框與 Login / SignUp 按鈕。
- 可**純鍵盤**完成整個登入/註冊：方向鍵切換欄位、Enter 進入輸入、輸入框 Enter（`editing-return`）直接觸發登入或註冊。
- 錯誤 / 成功訊息以**紅 / 綠色彩**回饋，UI 狀態清楚可讀。

**② 無障礙關卡選單（LevelSelectScene）** —— `LevelSelectManager.ts`
- 同樣掛載 FocusManager；Level1 / Level2 / Logout 按鈕皆可**純鍵盤操作**。
- 排行榜載入有清楚可讀的狀態文字：「Loading…」/「No records yet」/「Failed to load」。

**Limitations / 未來改進**：目前焦點提示為**視覺 + 文字**，尚無語音 audio cue 或完整 screen-reader ARIA label（屬 rubric 的 possible examples，非必需）；可作為後續加強。

### Git / Version Control (5%) & README / Technical Documentation (10%)
使用 Git 進行版本控制、規律且具意義的 commit；本 README 即為技術文件，清楚記錄各人分工與完成 / 協助完成的功能。

---

# 專節 C ── 受傷 / 死亡 / 分數計算

### 受傷（Hurt）
- 玩家碰到敵人或被攻擊時：
  - 若為 **BIG** 狀態 → 觸發 `shrink()` 縮小回 SMALL，並進入 **2 秒無敵**（精靈閃爍，opacity 切換），無敵期間不再受傷。
  - 若為 **SMALL** 狀態 → 直接死亡（見下）。
- **Piranha Plant 永遠造成傷害、不可踩**。
- **踩頭擊殺敵人**需同時滿足：垂直接觸（`|normal.y| > 0.5`）、玩家在敵人上方、且非快速上升（vy ≤ 50）；成功踩擊會給玩家一個小彈跳並播放 `stomp` 音效。

### 死亡（Death）
- 觸發條件：SMALL 狀態再受傷，或碰到 `DeathZone`（出界）。
- 流程：`PlayerController.die()` → 標記 `isDead`、播放 `die` 動畫、將 RigidBody 轉為 Static，0.8 秒後呼叫 `GameManager.triggerPlayerDeath()`。

### 生命與重生（Lives & Respawn）
- 預設 **3 命**（`DEFAULT_LIVES`）。
- `triggerPlayerDeath()` 具**重入防護**（`dying` flag），避免敵人 + DeathZone + 計時器同時觸發造成重複扣命。
- 扣命：`lives--`（最低 0），寫入模組變數 `_persistedLives` 以跨場景保留。
  - 若 **還有命** → 保留當前計時 `_persistedTimer`，1.5 秒後重載**同一關卡**；玩家於起點重生，金幣與敵人一併重生。
  - 若 **`lives <= 0`** → `showGameOver()`：停止 BGM、顯示 Game Over panel，3 秒後回選單，並重置生命與計時。

### 分數計算（Score）
- 採 **coin-based 金幣分數**：金幣 `CoinController.ts` 預設每枚 **100 分**，玩家碰到時呼叫 `GameManager.addScore()`，HUD 以六位補零顯示。
- **score 為純 runtime 數值，每次場景載入歸零** —— 因死亡重生會重新生成所有金幣，歸零可**防止靠反覆死亡刷金幣分數**。
- 過關時 `submitToLeaderboard()` 以「**完成秒數**（越低越好，主排名）＋**金幣分數**（顯示用）」送上排行榜。

### 計時器（Timer）
由 0 上數；死亡重生時**不歸零**（以 `_persistedTimer` 保留），僅在 Game Over 與 Win 時重置。

---

## 附註 / Notes
- 若開發過程使用 AI 工具，依作業規定需另附 `AI_reference.pdf` 於專案根目錄（本 README 不含該報告）。
- 主要程式碼位於 `SS_Mario_Frontend/assets/Script/`；後端替代伺服器位於 `SS_Mario_Backend/`。
