# DB設計（Amazon DynamoDB）

- 対象：予約管理システム未導入の小規模飲食店向け AI電話受付・予約管理SaaS
- 方針：アクセスパターン先行。最初から `tenantId` で分離し、後から機能を足してもキー設計を壊さない。
- 最終更新：2026年11月14日

---

## 1. 設計方針

1. **テナント分離を最初から入れる**  
   すべての業務データに `tenantId` を含める。後から付けない。
2. **アクセスパターンからキーを決める**  
   「着信番号→店舗」「日付の予約一覧」「卓の空席判定」「二重予約防止」を最優先で満たす。
3. **単一テーブル＋エンティティ種別**  
   テーブルを増やしすぎず、`PK` / `SK` の接頭辞でエンティティを分ける。FAQ・利用量・申し込み承認などを同じ規則で追加できる。
4. **時間は15分スロットで表現する**  
   予約開始の刻みが15分なので、空席占有も15分単位のアイテムにする。利用時間が120分→150分に変わってもスロット数を増やすだけ。
5. **確定時に条件付き書き込みで二重予約を防ぐ**  
   検索だけでは確定しない。占有スロットの作成に `attribute_not_exists` 等を使い、競合したら失敗させる。
6. **論理削除・状態遷移を残す**  
   キャンセルや申し込み却下を後から足しても、履歴を消さずに `status` で表現できるようにする。

---

## 2. アクセスパターン（先に固定）

| ID | 操作 | 頻度 | キーの使い方 |
|---|---|---|---|
| A1 | 着信先番号／デモ識別子から店舗を特定する | 高（電話） | GSI1：`PHONE#...` → tenant |
| A2 | 店舗設定（営業時間・標準利用時間・FAQ等）を取得する | 高 | `TENANT#id` / `PROFILE` |
| A3 | 店舗の卓一覧・AI予約枠を取得する | 高 | `TENANT#id` / `TABLE#...` |
| A4 | 指定日の予約一覧を取得する | 高（管理画面） | `TENANT#id` / `RES#DATE#yyyy-mm-dd#...` |
| A5 | 指定卓・指定日の占有スロットを取得し空席判定する | 高（予約判定） | `TENANT#id` / `SLOT#TABLE#...#DATE#...#TIME#...` |
| A6 | 予約を確定する（二重予約防止） | 高 | TransactWrite：予約本体＋占有スロット群 |
| A7 | 予約1件を取得・更新する | 中 | `TENANT#id` / `RES#DATE#...#RESID#...` または予約ID用GSI |
| A8 | 通話履歴を店舗単位・新しい順で見る | 中 | `TENANT#id` / `CALL#...` |
| A9 | ユーザーが所属する店舗を解決する | 中（ログイン後） | `USER#id` / `MEMBERSHIP#tenantId` |
| A10 | 運営者が申し込み一覧を見る（完成系） | 低 | `TENANT#pending` または運営者向けSK |
| A11 | 月次の利用量を集計する（将来） | 低 | 通話明細を保存し、必要なら集計アイテムを追加 |

---

## 3. テーブル構成

### 3.1 メインテーブル：`BookingApp`

| 項目 | 値 |
|---|---|
| パーティションキー（PK） | `S` |
| ソートキー（SK） | `S` |
| 課金 | オンデマンド（初期） |
| TTL属性 | `expiresAt`（任意。仮押さえや一時データ用） |

### 3.2 GSI

#### GSI1：`GSI1`（着信・外部キー解決）

| 項目 | 値 |
|---|---|
| GSI1PK | `S` |
| GSI1SK | `S` |
| 用途 | 電話番号→店舗、reservationId→予約、callId→通話 など |

#### GSI2：`GSI2`（状態・一覧の補助・完成系）

| 項目 | 値 |
|---|---|
| GSI2PK | `S` |
| GSI2SK | `S` |
| 用途 | 申し込み承認待ち一覧、キャンセル済み抽出など |

初期は GSI1 だけで MVP を通し、GSI2 は申し込み承認・高度な一覧が必要になったら有効化する想定でもよい。ただし属性名は最初から空けておく。

---

## 4. キー設計の共通規則

```
PK = TENANT#<tenantId>          … 店舗スコープのデータの基本
SK = <ENTITY>#<自然な並びキー>

例外：
  PK = USER#<userId>            … ユーザーと店舗の所属
  PK = PHONE#<E.164またはデモID> … 着信解決用（実体はGSIでも可）
  PK = APP                      … 運営者横断のメタ（申し込みキュー等）
```

エンティティ接頭辞：

| 接頭辞 | 意味 |
|---|---|
| `PROFILE` | 店舗プロフィール・設定 |
| `HOURS` | 営業時間（曜日別などに分割可能） |
| `FAQ#` | FAQ項目 |
| `TABLE#` | 卓マスタ |
| `RES#` | 予約本体 |
| `SLOT#` | 卓の時間占有（二重予約防止の核） |
| `CALL#` | 通話履歴 |
| `USAGE#` | 利用量明細／日次集計 |
| `MEMBERSHIP#` | ユーザーの店舗所属 |
| `APPLICATION#` | 店舗セルフ申し込み |
| `IDEMPOTENCY#` | API再送防止（任意） |

---

## 5. エンティティ定義

### 5.1 店舗プロフィール

| 属性 | 型 | 説明 |
|---|---|---|
| PK | S | `TENANT#<tenantId>` |
| SK | S | `PROFILE` |
| entityType | S | `TENANT_PROFILE` |
| tenantId | S | 店舗ID |
| name | S | 店舗名 |
| status | S | `active` / `suspended` / `pending_approval` |
| phoneNumber | S | 店舗の着信番号（**1店舗1つ**）。デモ店には開発者の番号またはデモIDを入れる |
| address | S | 住所（任意） |
| standardDurationMin | N | 標準利用時間。初期値 120 |
| reservationSlotMin | N | 開始刻み。初期値 15 |
| transferPhoneNumber | S | 人間引き継ぎの外部転送先。デモでは開発者の電話番号でよい（`phoneNumber` と同じでも可） |
| timezone | S | 例：`Asia/Tokyo` |
| createdAt / updatedAt | S | ISO8601 |
| GSI1PK | S | `PHONE#<phoneNumber>` |
| GSI1SK | S | `TENANT` |

**電話番号の持ち方**

- 店舗の着信番号は **1つだけ**（`phoneNumber`）。複数回線は初期版で持たない。
- デモ用店舗には、ここに開発者の番号（またはデモ用識別子）を入れる。
- 着信解決は GSI1（`PHONE#...` → 店舗）で行う。
- 転送先は `transferPhoneNumber`。デモでは自分の番号を入れて外部転送する。

**拡張余地**

- `standardDurationMin` を残したまま、後から `durationRules`（ランチ／ディナー別）を追加属性で持てる。
- `status=pending_approval` で完成系の承認フローに接続できる。
- 将来どうしても複数着信番号が必要なら、そのとき別エンティティを足す（今は不要）。

### 5.2 営業時間

| 属性 | 型 | 説明 |
|---|---|---|
| PK | S | `TENANT#<tenantId>` |
| SK | S | `HOURS#<dow>`（`mon`…`sun` または `holiday`） |
| entityType | S | `BUSINESS_HOURS` |
| openTime | S | `11:00` |
| closeTime | S | `22:00` |
| isClosed | BOOL | 定休日なら true |
| lastStartTime | S | 任意。未設定なら close − standardDuration で算出 |

曜日追加や祝日例外は `HOURS#...` を増やすだけでよい。

### 5.3 FAQ

| 属性 | 型 | 説明 |
|---|---|---|
| PK | S | `TENANT#<tenantId>` |
| SK | S | `FAQ#<faqId>` |
| entityType | S | `FAQ` |
| question | S | 質問 |
| answer | S | 回答 |
| tags | L | 任意 |
| enabled | BOOL | 有効フラグ |
| sortOrder | N | 表示順 |

AI回答用の知識を後から増やしても、店舗PK配下に足すだけ。

### 5.4 卓マスタ

| 属性 | 型 | 説明 |
|---|---|---|
| PK | S | `TENANT#<tenantId>` |
| SK | S | `TABLE#<tableId>` |
| entityType | S | `TABLE` |
| tableId | S | 卓ID（例：`T4-01`） |
| capacity | N | 定員（4 / 6） |
| label | S | 表示名（例：4人用A） |
| aiBookable | BOOL | AI予約対象か |
| active | BOOL | 利用可能か |
| sortOrder | N | 一覧順 |

**人数割り当てはDBにハードコードせず、アプリ設定または店舗設定で持つ。**  
初期ルール（1〜4→4人卓、5〜6→6人卓、7+→転送）はコード／設定に置き、卓マスタは「実在する卓」だけを表す。将来「5人用卓」を足してもマスタ追加で足りる。

### 5.5 予約本体

| 属性 | 型 | 説明 |
|---|---|---|
| PK | S | `TENANT#<tenantId>` |
| SK | S | `RES#DATE#<yyyy-mm-dd>#START#<HHmm>#RESID#<reservationId>` |
| entityType | S | `RESERVATION` |
| tenantId | S | |
| reservationId | S | ULID/UUID |
| date | S | `yyyy-mm-dd` |
| startTime | S | `19:00` |
| endTime | S | `21:00` |
| startAt | S | ISO8601（ソート・計算用） |
| endAt | S | ISO8601 |
| partySize | N | 人数 |
| customerName | S | |
| customerPhone | S | 任意 |
| tableId | S | 割り当て卓 |
| status | S | `confirmed` / `cancelled` / `completed` / `no_show`（将来） |
| source | S | `ai_phone` / `manual` |
| callId | S | 電話経由なら通話ID |
| note | S | 任意 |
| createdAt / updatedAt | S | |
| GSI1PK | S | `RESID#<reservationId>` |
| GSI1SK | S | `TENANT#<tenantId>` |

日付一覧は  
`PK = TENANT#...` かつ `SK begins_with RES#DATE#2026-11-14`  
で取得する。

キャンセル追加時はレコード削除ではなく `status=cancelled` にし、対応する `SLOT#` を削除（または解放）する。

### 5.6 占有スロット（二重予約防止の核）

15分単位で「その卓がその時刻に埋まっているか」を表す。

| 属性 | 型 | 説明 |
|---|---|---|
| PK | S | `TENANT#<tenantId>` |
| SK | S | `SLOT#TABLE#<tableId>#DATE#<yyyy-mm-dd>#TIME#<HHmm>` |
| entityType | S | `SLOT` |
| tenantId | S | |
| tableId | S | |
| date | S | |
| slotStart | S | `19:00` |
| reservationId | S | 紐づく予約 |
| status | S | `held`（仮押さえ） / `confirmed` |
| expiresAt | N | 仮押さえTTL（epoch秒）。本確定後は削除または無期限 |

**例：19:00開始・120分・刻み15分**

作成する SK：

- `SLOT#TABLE#T4-01#DATE#2026-11-14#TIME#1900`
- `...#TIME#1915`
- …
- `...#TIME#2045`（終了21:00直前まで。終了時刻そのものは次予約開始可）

終了境界の扱いはアプリで統一する（開始含む・終了含まない）。

### 5.7 通話履歴

| 属性 | 型 | 説明 |
|---|---|---|
| PK | S | `TENANT#<tenantId>` |
| SK | S | `CALL#START#<ISO8601>#CALLID#<callId>` |
| entityType | S | `CALL` |
| callId | S | |
| channel | S | `webrtc` / `pstn` |
| direction | S | `inbound` / `outbound` |
| callerNumber | S | **かけてきた側の番号**（取得できない WebRTC デモ等は空または `unknown`） |
| calledNumber | S | **着信先**（店舗の `phoneNumber`） |
| startedAt / endedAt | S | |
| durationSec | N | |
| transferred | BOOL | 外部転送したか |
| transferTarget | S | 転送先番号（デモでは開発者の電話など） |
| result | S | `reserved` / `full` / `transferred` / `faq_only` / `abandoned` 等 |
| transcriptRef | S | S3キー等（任意） |
| summary | S | 要約（任意） |
| reservationId | S | 予約できた場合 |
| usage | M | トークン数・ASR秒数など取得できたもの |
| GSI1PK | S | `CALLID#<callId>` |
| GSI1SK | S | `TENANT#<tenantId>` |

**番号の保存方針**

- 通話ごとに `callerNumber`（発信者）と `calledNumber`（店舗側着信先）を必ずフィールドとして持つ。
- 予約に残す顧客電話は別途 `RES.customerPhone`（聞き取った番号）。`callerNumber` と一致しない場合もある。
- 利用量は通話1件に埋め込み、後から `USAGE#DAY#yyyy-mm-dd` 集計アイテムを追加しても壊れない。

### 5.8 ユーザー所属（管理画面ログイン）

| 属性 | 型 | 説明 |
|---|---|---|
| PK | S | `USER#<userId>` |
| SK | S | `MEMBERSHIP#<tenantId>` |
| entityType | S | `MEMBERSHIP` |
| role | S | `tenant_admin` / `tenant_staff` / `operator` |
| tenantId | S | |
| userId | S | Cognito sub 等 |
| status | S | `active` / `invited` / `disabled` |

運営者（operator）は複数テナント参照や申し込み承認に使う。

### 5.9 店舗セルフ申し込み（完成系）

| 属性 | 型 | 説明 |
|---|---|---|
| PK | S | `APP` |
| SK | S | `APPLICATION#STATUS#pending#AT#<ISO8601>#ID#<applicationId>` |
| entityType | S | `TENANT_APPLICATION` |
| applicationId | S | |
| status | S | `pending` / `approved` / `rejected` |
| storeName | S | |
| contactName | S | |
| contactEmail | S | |
| contactPhone | S | |
| requestedByUserId | S | |
| reviewedByUserId | S | 承認後 |
| reviewedAt | S | |
| tenantId | S | 承認後に発行した店舗ID |
| GSI2PK | S | `APPLICATION#<status>` |
| GSI2SK | S | `<ISO8601>#<applicationId>` |

**流れ**

1. 店舗が申し込みアイテムを `pending` で作成  
2. 運営者が承認  
3. `TENANT#.../PROFILE` 等を作成し、申し込みを `approved` に更新  
4. 申し込み者に `MEMBERSHIP` を付与  

初期MVPではこのエンティティを使わず、運営者が直接 `PROFILE` を作る。

---

## 6. 空席判定と二重予約防止

### 6.1 判定手順（読み取り）

1. `PROFILE` から `standardDurationMin` / `reservationSlotMin` を取得  
2. 人数から卓種別（capacity）を決定  
3. `TABLE#` を取得し `aiBookable=true` かつ `capacity` 一致の卓に絞る  
4. 希望開始〜終了を15分スロット列に展開  
5. 各候補卓について、必要スロットの `SLOT#...` が存在しないことを確認  
6. 空いている卓を1つ選ぶ  

### 6.2 確定手順（書き込み）

`TransactWriteItems` で原子的に行う。

1. 予約本体 `RES#...` を Put（`attribute_not_exists(PK)`）  
2. 必要数の `SLOT#...` を Put（各 `attribute_not_exists(PK) AND attribute_not_exists(SK)`）  
3. 任意：通話に `reservationId` を紐づけ Update  

どれか1つでも衝突したらトランザクション全体失敗 → 別卓再試行または満席。

### 6.3 仮押さえ（任意・将来）

会話中に短時間だけ席を押さえる場合：

- `SLOT` を `status=held` + `expiresAt`（例：3分）で作成  
- 確定時に `held → confirmed` へ条件付き更新  
- TTLで期限切れ自動削除  

MVPでは仮押さえなしの「確認→即確定トランザクション」でもよい。

### 6.4 キャンセル（後回し機能の入れ方）

1. 予約 `status` を `cancelled` に更新  
2. 紐づく `SLOT#` を削除（または `status=free` ではなく削除推奨）  
3. 同じ卓・時間帯が再度予約可能になる  

変更は「旧スロット削除＋新スロット作成＋予約更新」を1トランザクションで行う。

---

## 7. サンプルデータ

### 店舗

```
PK: TENANT#t_demo_001
SK: PROFILE
name: デモ食堂さくら
phoneNumber: +8190xxxxxxxx          # デモ店：開発者の番号（1店1つ）
standardDurationMin: 120
reservationSlotMin: 15
transferPhoneNumber: +8190xxxxxxxx  # デモ：同じ番号へ外部転送でよい
status: active
GSI1PK: PHONE#+8190xxxxxxxx
GSI1SK: TENANT
```

### 卓

```
PK: TENANT#t_demo_001
SK: TABLE#T4-01
capacity: 4
aiBookable: true
active: true
```

### 予約（19:00-21:00・4名）

```
PK: TENANT#t_demo_001
SK: RES#DATE#2026-11-14#START#1900#RESID#01JB...
partySize: 4
tableId: T4-01
customerPhone: +8190yyyyyyyy
status: confirmed
source: ai_phone
```

### 占有スロット（先頭のみ）

```
PK: TENANT#t_demo_001
SK: SLOT#TABLE#T4-01#DATE#2026-11-14#TIME#1900
reservationId: 01JB...
status: confirmed
```

### 通話

```
PK: TENANT#t_demo_001
SK: CALL#START#2026-11-14T10:00:00+09:00#CALLID#contact-xxx
callerNumber: +8190yyyyyyyy
calledNumber: +8190xxxxxxxx
channel: webrtc
transferred: false
result: reserved
reservationId: 01JB...
```

---

## 8. 認可ルール（DBとセットで守ること）

- APIは認証ユーザーの `MEMBERSHIP` から許可された `tenantId` だけを使う。  
- リクエストボディの `tenantId` を信じない。  
- 電話経路は着信先 `calledNumber` → GSI1（`PROFILE.phoneNumber`）で解決した `tenantId` のみ使う。  
- `operator` 以外は他テナントの PK に触れない。

---

## 9. 拡張マップ（後から足すとき）

| 追加機能 | やること | やらなくてよいこと |
|---|---|---|
| ランチ／ディナー別利用時間 | `PROFILE.durationRules` を追加。判定ロジックだけ分岐 | テーブル分割 |
| 予約変更・キャンセル | `status` 更新＋SLOT張り替え | 予約キー体系の変更 |
| 準備時間（片付け15分等） | 終了後に追加SLOTを確保 | 刻み自体の変更必須ではない |
| 複数卓結合 | 予約に `tableIds[]`、SLOTを複数卓分作成 | 単一卓MVPの破壊 |
| 通話要約・文字起こし | CALLに参照追加、実体はS3 | DBテーブル追加必須ではない |
| 利用量の月次請求 | CALL明細→日次/月次 `USAGE#` 集計アイテム | 初期明細設計のやり直し |
| 店舗セルフ申し込み＋承認 | `APPLICATION#` と承認時の PROFILE 作成 | 初期デモ登録の廃止は不要（併用可） |
| 実電話番号／デモ番号の差し替え | `PROFILE.phoneNumber` と GSI1 を更新 | 予約・SLOT設計の変更 |
| FAQ増強／カテゴリ | FAQアイテム追加、tags拡張 | 新テーブル必須ではない |

---

## 10. MVPで最初に作る範囲

必須：

1. `PROFILE`（`phoneNumber` 1つ＋GSI1）  
2. `TABLE#`  
3. `RES#`  
4. `SLOT#`  
5. 予約確定の `TransactWriteItems`  

電話接続時に追加：

6. `CALL#`（`callerNumber` / `calledNumber` を含む）  

管理画面時に追加：

7. `MEMBERSHIP#`  
8. `HOURS#` / `FAQ#`（設定画面用）  

完成系で追加：

9. `APPLICATION#`（申し込み）＋運営者承認フロー  

---

## 11. 命名・ID規則

| 対象 | 規則 |
|---|---|
| tenantId | `t_` + ULID/短号 |
| tableId | `T{capacity}-{連番}` 例：`T4-01` |
| reservationId | ULID |
| callId | Connect の ContactId を優先。なければ ULID |
| 時刻キー | `HHmm`（`1900`）。表示は `19:00` |
| 日付キー | `yyyy-mm-dd`（店舗タイムゾーン） |
| 電話キー | 可能なら E.164。デモは `demo-sakura` のような安定ID |

---

## 12. この設計で説明しやすくなるポイント（発表用）

1. **なぜ単一テーブルか**：店舗単位のクエリが1パーティションで完結し、エンティティ追加がSK接頭辞で済む。  
2. **なぜSLOTを別アイテムにするか**：DynamoDBは範囲の排他をSQLのように書けないため、15分コマの存在有無で競合を条件付き書き込みに落とす。  
3. **なぜtenantIdをキーに含めるか**：誤って他店データを読まない／書かない設計を強制できる。  
4. **なぜ最初から拡張属性を壊さないか**：利用時間ルール・キャンセル・承認を「新エンティティ／新属性」で足せるようにしてある。

---

## 13. 関連ドキュメント

- 開発順：`道.md`  
- 企画：`作りたいもの.md`  
- 市場調査：`市場調査.md`
