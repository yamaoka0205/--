# DB設計（Amazon DynamoDB）

- 対象：予約管理システム未導入の小規模飲食店向け AI電話受付・予約管理SaaS
- 方針：アクセスパターン先行。最初から `tenantId` で分離し、後から機能を足してもキー設計を壊さない。
- 最終更新：2026年11月14日

---

## 1. 設計方針

1. **テナント分離を最初から入れる**  
   すべての業務データに `tenantId` を含める。後から付けない。
2. **アクセスパターンからキーを決める**  
   「着信先→店舗」「日付の予約一覧」「卓の空席判定」「二重予約防止」を最優先で満たす。
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
| A1 | 着信先（Connect側の番号／WebRTCの店舗識別子）から店舗を特定する | 高（電話） | GetItem：`INBOUND#<inboundId>` / `TENANT` |
| A2 | 店舗設定（営業時間・標準利用時間・FAQ等）を取得する | 高 | `TENANT#id` / `PROFILE`、`HOURS#...`、`FAQ#...` |
| A3 | 店舗の卓一覧・AI予約枠を取得する | 高 | `TENANT#id` / `TABLE#...` |
| A4 | 指定日の予約一覧を取得する | 高（管理画面） | `TENANT#id` / `RES#DATE#yyyy-mm-dd#...` |
| A5 | 指定卓・指定日の占有スロットを取得し空席判定する | 高（予約判定） | `TENANT#id` / `SLOT#TABLE#...#DATE#...#TIME#...` |
| A6 | 予約を確定する（二重予約防止） | 高 | TransactWrite：予約本体＋占有スロット群 |
| A7 | 予約1件を取得・更新する | 中 | `TENANT#id` / `RES#DATE#...#RESID#...` または予約ID用GSI |
| A8 | 通話履歴を店舗単位・新しい順で見る | 中 | `TENANT#id` / `CALL#...` |
| A9 | ユーザーが所属する店舗を解決する | 中（ログイン後） | `USER#id` / `MEMBERSHIP#tenantId` |
| A10 | 運営者が申し込み一覧を見る（完成系） | 低 | GSI2：`APPLICATION#pending` |
| A11 | 月次の利用量を集計する（将来） | 低 | 通話明細を保存し、必要なら集計アイテムを追加 |

---

## 3. テーブル構成

### 3.1 メインテーブル：`BookingApp`

| 項目 | 値 |
|---|---|
| パーティションキー（PK） | `S` |
| ソートキー（SK） | `S` |
| 課金 | オンデマンド（初期） |
| TTL属性 | `expiresAt`（任意。仮押さえや一時データの後片付け用。削除は期限から数日遅れることがある） |

### 3.2 GSI

#### GSI1：`GSI1`（外部キー解決）

| 項目 | 値 |
|---|---|
| GSI1PK | `S` |
| GSI1SK | `S` |
| 用途 | reservationId→予約、callId→通話 など |

着信先→店舗の解決には GSI を使わない。GSI は値の重複を防げないため、専用の対応表アイテム（5.1.1）で一意にする。

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
  PK = INBOUND#<inboundId>      … 着信先→店舗の対応表（1件1店舗。条件付き書き込みで重複を防ぐ）
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
| status | S | `active` / `suspended` |
| inboundId | S | 着信先の識別子（**1店舗1つ・全店で重複不可**）。実電話は Connect 側の番号、WebRTC は店舗識別子（例：`demo-sakura`） |
| address | S | 住所（任意） |
| standardDurationMin | N | 標準利用時間。初期値 120 |
| reservationSlotMin | N | 開始刻み。初期値 15 |
| transferPhoneNumber | S | 人間引き継ぎの外部転送先（**1店舗1つ・重複可**）。デモ店には開発者の電話番号を入れる |
| timezone | S | 例：`Asia/Tokyo` |
| createdAt / updatedAt | S | ISO8601 |

**電話番号の持ち方**

店舗が持つ番号は役割の違う2つで、どちらも1店舗1つ。

| 項目 | 役割 | デモ店の値 | 重複 |
|---|---|---|---|
| `inboundId` | 着信がどの店宛てかを決める | 店ごとの識別子 | 不可 |
| `transferPhoneNumber` | AIが対応できないとき人につなぐ | 開発者の電話番号 | 可（全デモ店で同じでよい） |

- 開発者の電話番号を `inboundId` に入れない。Connect が着信先として渡すのは Connect 側の番号で、個人の携帯番号で着信を受けることはないため、店舗を引けなくなる。
- WebRTC 通話には着信先の電話番号がない。通信ウィジェットの `contactAttributes` で店舗識別子を渡し（フロー上は `HostedWidget-inboundId`）、それを `inboundId` と照合する。この属性はブラウザ側で書き換えられるので、本番で改ざんを防ぐ必要があれば JWT で渡す。
- ブラウザから渡す属性は利用者側で書き換えられる。デモでは許容し、実運用で使う場合は署名付き（JWT）で渡す。
- 外部転送には、発信者番号として使う Connect 側の取得済み番号が1つ必要。取得できない間は `transferPhoneNumber` を使わず、エージェント画面（CCP）へ転送する。
- 実運用で店の代表番号を Connect へ転送している場合、`transferPhoneNumber` に同じ代表番号を入れると着信がループする。人が直接出られる別の番号にする。
- 実際の電話番号はリポジトリに書かない（公開リポジトリのため）。シード投入時に環境変数などで渡す。

**拡張余地**

- `standardDurationMin` を残したまま、後から `durationRules`（ランチ／ディナー別）を追加属性で持てる。
- 完成系の承認待ちは `APPLICATION#`（5.9）で表し、承認時に `PROFILE` を作る。`PROFILE` 側に承認待ちの状態は持たない。
- 将来どうしても複数の着信先が必要なら、対応表アイテム（5.1.1）を店舗あたり複数作れば足りる（今は不要）。

### 5.1.1 着信先→店舗の対応表

| 属性 | 型 | 説明 |
|---|---|---|
| PK | S | `INBOUND#<inboundId>` |
| SK | S | `TENANT` |
| entityType | S | `INBOUND_LOOKUP` |
| inboundId | S | `PROFILE.inboundId` と同じ値 |
| tenantId | S | 対応する店舗 |
| createdAt | S | ISO8601 |

- 店舗作成時に `PROFILE` と同じトランザクションで Put する（`attribute_not_exists(PK)`）。同じ着信先を2店舗に登録しようとすると失敗する。
- 着信先を変えるときは、旧アイテムの Delete・新アイテムの条件付き Put・`PROFILE.inboundId` の Update を1トランザクションで行う。
- 着信時は GetItem 1回で `tenantId` が決まる。

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

初期版は `openTime < closeTime`（同じ日の中で完結する営業時間）だけを扱う。日付をまたぐ営業に対応するときは、占有スロットを実際の暦日・時刻で作れば `SLOT#` のキーは変えずに済む。

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

キャンセル追加時は予約本体を削除せず `status=cancelled` にし、対応する `SLOT#` を削除する。

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
| expiresAt | N | 仮押さえの期限（epoch秒）。`confirmed` には付けない |

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
| SK | S | `CALL#START#<ISO8601（UTC）>#CALLID#<callId>` |
| entityType | S | `CALL` |
| callId | S | |
| channel | S | `webrtc` / `pstn` |
| direction | S | `inbound` / `outbound` |
| callerNumber | S | **かけてきた側の番号**。WebRTC の通話では取得できないため、その場合は属性を付けない |
| calledNumber | S | **着信先**（店舗の `inboundId`。実電話は Connect 側の番号、WebRTC は店舗識別子） |
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

- 通話ごとに `calledNumber`（店舗側着信先）を必ず持つ。`callerNumber`（発信者）は実電話の通話で必ず保存し、WebRTC の通話では付けない。
- 予約に残す顧客電話は別途 `RES.customerPhone`（聞き取った番号）。`callerNumber` と一致しない場合もある。
- 利用量は通話1件に埋め込み、後から `USAGE#DAY#yyyy-mm-dd` 集計アイテムを追加しても壊れない。

### 5.8 ユーザー所属（管理画面ログイン）

| 属性 | 型 | 説明 |
|---|---|---|
| PK | S | `USER#<userId>` |
| SK | S | `MEMBERSHIP#<tenantId>` |
| entityType | S | `MEMBERSHIP` |
| role | S | `tenant_admin` / `tenant_staff` |
| tenantId | S | |
| userId | S | Cognito sub 等 |
| status | S | `active` / `invited` / `disabled` |

運営者（複数テナントの参照や申し込み承認を行う）は特定の店舗に所属しないため、`MEMBERSHIP` では表さない。Cognito のグループ（例：`operators`）で判定する。

### 5.9 店舗セルフ申し込み（完成系）

| 属性 | 型 | 説明 |
|---|---|---|
| PK | S | `APP` |
| SK | S | `APPLICATION#<applicationId>` |
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
| GSI2SK | S | `<ISO8601（UTC）>#<applicationId>` |

状態は SK に入れない。キーは作成後に書き換えられず、承認のたびに削除と再作成が必要になるため。状態別の一覧は GSI2 で引き、承認・却下は `status` と `GSI2PK` の更新だけで済ませる。

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
2. 希望日の `HOURS#<dow>` を取得し、定休日でないこと、開始時刻が刻みに合っていること、営業開始以降かつ最終受付時刻以前であることを確認（満たさなければ受付不可）  
3. 人数から卓種別（capacity）を決定（7人以上は人間対応）  
4. `TABLE#` を取得し `aiBookable=true` かつ `active=true` かつ `capacity` 一致の卓に絞る  
5. 希望開始〜終了を15分スロット列に展開  
6. 各候補卓について、必要スロットの `SLOT#...` が存在しないことを確認  
7. 空いている卓を1つ選ぶ  

### 6.2 確定手順（書き込み）

`TransactWriteItems` で原子的に行う。

1. 予約本体 `RES#...` を Put（`attribute_not_exists(PK)`）  
2. 必要数の `SLOT#...` を Put（各 `attribute_not_exists(PK) AND attribute_not_exists(SK)`）  
3. 任意：通話に `reservationId` を紐づけ Update  

どれか1つでも衝突したらトランザクション全体失敗 → 別卓再試行または満席。

120分・15分刻みなら予約本体1件＋スロット8件の計9件で、1トランザクションの上限（100件）に収まる。

### 6.3 仮押さえ（任意・将来）

会話中に短時間だけ席を押さえる場合：

- `SLOT` を `status=held` + `expiresAt`（例：3分後）で作成  
- 確定時に `held → confirmed` へ条件付き更新し、`expiresAt` を外す  
- 期限の判定を TTL に頼らない。TTL による削除は期限から数日遅れることがあり、その間も期限切れのアイテムは読み書きに現れる  
  - 空席判定では、`expiresAt` が現在時刻より前の `held` を空きとして扱う  
  - 作成時の条件は「アイテムが無い、または期限切れの `held`」にする（`attribute_not_exists(PK) OR (#status = :held AND expiresAt < :now)`）  
  - TTL は残ったアイテムの後片付けとして使う  

MVPでは仮押さえなしの「確認→即確定トランザクション」でもよい。

### 6.4 キャンセル（後回し機能の入れ方）

1. 予約 `status` を `cancelled` に更新  
2. 紐づく `SLOT#` を削除する（`status=free` などで残さない。残すと `attribute_not_exists` の条件に当たり、再予約できなくなる）  
3. 同じ卓・時間帯が再度予約可能になる  

変更は「旧スロット削除＋新スロット作成＋予約更新」を1トランザクションで行う。

---

## 7. サンプルデータ

### 店舗

```
PK: TENANT#t_demo_001
SK: PROFILE
name: デモ食堂さくら
inboundId: demo-sakura              # 着信先の識別子（店ごとに別の値）
standardDurationMin: 120
reservationSlotMin: 15
transferPhoneNumber: +8190xxxxxxxx  # デモ：開発者の番号（全デモ店で同じでよい）
status: active
```

### 着信先→店舗の対応表

```
PK: INBOUND#demo-sakura
SK: TENANT
tenantId: t_demo_001
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
SK: CALL#START#2026-11-14T01:00:00Z#CALLID#contact-xxx
calledNumber: demo-sakura
channel: webrtc                     # WebRTC のため callerNumber は無し（実電話なら +81... が入る）
transferred: false
result: reserved
reservationId: 01JB...
```

---

## 8. 認可ルール（DBとセットで守ること）

- APIは認証ユーザーの `MEMBERSHIP` から許可された `tenantId` だけを使う。  
- リクエストボディの `tenantId` を信じない。  
- 電話経路は着信先 → 対応表（`INBOUND#<inboundId>`）で解決した `tenantId` のみ使う。  
- 運営者グループ以外は他テナントの PK に触れない。

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
| 実電話番号の取得・着信先の差し替え | 対応表（`INBOUND#`）と `PROFILE.inboundId` を1トランザクションで張り替え | 予約・SLOT設計の変更 |
| FAQ増強／カテゴリ | FAQアイテム追加、tags拡張 | 新テーブル必須ではない |

---

## 10. MVPで最初に作る範囲

必須：

1. `PROFILE`（`inboundId` と `transferPhoneNumber`）＋着信先の対応表 `INBOUND#`  
2. `HOURS#`（営業時間・最終受付の判定に必要。シードで投入）  
3. `TABLE#`  
4. `RES#`  
5. `SLOT#`  
6. 予約確定の `TransactWriteItems`  

電話接続時に追加：

7. `FAQ#`（店舗情報の質問に答えるために必要。シードで投入）  
8. `CALL#`（`callerNumber` / `calledNumber` を含む）  

管理画面時に追加：

9. `MEMBERSHIP#`  
10. `HOURS#` / `FAQ#` の編集（設定画面）  

完成系で追加：

11. `APPLICATION#`（申し込み）＋運営者承認フロー  

---

## 11. 命名・ID規則

| 対象 | 規則 |
|---|---|
| tenantId | `t_` + ULID または短いID |
| tableId | `T{capacity}-{連番}` 例：`T4-01` |
| reservationId | ULID |
| callId | Connect の ContactId を優先。なければ ULID |
| 時刻キー | `HHmm`（`1900`）。表示は `19:00` |
| 日付キー | `yyyy-mm-dd`（店舗タイムゾーン） |
| キーに入れる日時 | UTC の ISO8601（例：`2026-11-14T01:00:00Z`）。オフセットが混ざると並び順が崩れる |
| inboundId | 実電話は E.164（Connect 側の番号）。WebRTC は `demo-sakura` のような固定ID |

---

## 12. この設計で説明しやすくなるポイント（発表用）

1. **なぜ単一テーブルか**：店舗単位のクエリが1パーティションで完結し、エンティティ追加がSK接頭辞で済む。  
2. **なぜSLOTを別アイテムにするか**：DynamoDBは範囲の排他をSQLのように書けないため、15分コマの存在有無で競合を条件付き書き込みに落とす。  
3. **なぜtenantIdをキーに含めるか**：誤って他店データを読まない／書かない設計を強制できる。  
4. **なぜ後から機能を足してもキー設計が壊れないか**：利用時間ルール・キャンセル・承認を「新エンティティ／新属性」で足せるようにしてある。

---

## 13. 関連ドキュメント

- 開発順：`道.md`  
- 企画：`作りたいもの.md`  
- 市場調査：`市場調査.md`
