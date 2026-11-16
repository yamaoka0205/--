# WebRTC 電話デモ

Connect の通信ウィジェット（音声）を埋め込んだページ。発信すると共通フローに入る。

WebRTC の通話には着信先・かけてきた番号が無いので、店舗特定の Lambda（`BookingAppResolveStore`）がデモ用の固定値で埋める。

| 種類（`callType`） | 判定 | 着信先（店舗特定） | かけてきた番号 |
|---|---|---|---|
| 普通の電話 `phone` | 下記以外 | `SystemEndpoint` | `CustomerEndpoint`（保存してよい） |
| 非通知 `phone_anonymous` | 客の番号が `anonymous`（または空） | `SystemEndpoint` | 空（保存しない） |
| WebRTC `webrtc` | `InitiationMethod=WEBRTC_API` または `connect:Subtype=connect:WebRTC` | あればそれ、無ければ `+810000000001` | `+810000000000`（保存しない） |

- 非通知は番号をでっち上げない。客が番号を出さないことを選んでいるため。予約は番号なしでも受け付ける。
- 普通の電話・非通知で着信先が取れないときは、デモ店に落とさず「店舗不明」（`found=false`）にする。
- 保存してよい番号かはフロー側で `callerNumberAvailable` を見る。

固定値は `+81` の直後が `0` で、日本の番号として存在しえない。環境変数 `DEMO_INBOUND_NUMBER` / `DEMO_CALLER_NUMBER` で変えられる。

## 起動

```bash
cd demo/webrtc
python3 -m http.server 3000 --bind localhost
```

ブラウザで `http://localhost:3000` を開く（`127.0.0.1` は別ホスト扱いでウィジェットが読み込まれない）。

## Connect 側の前提

- 通信ウィジェットの許可ドメインに `http://localhost:3000` を登録する
- ウィジェットに紐づけるフローは **`BookingApp-Inbound`**（作成済み。手順は `infra/connect/README.md`）
- `BookingAppResolveStore` はインスタンスに関連付け済み。フロー先頭で呼ぶ

## 数字キー（1/2）

標準の通信ウィジェットの通話画面から数字を入力できる（実機で確認済み）。フローの「顧客の入力を取得する」ブロック（DTMF）で 1=予約、2=問い合わせ に分岐する。普通の電話・非通知と同じブロックで受けられる。
