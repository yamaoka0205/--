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
- ウィジェットに紐づけるフローは全店共通フロー
- Connect の「フロー → AWS Lambda」に `BookingAppResolveStore` を追加し、フロー先頭の「AWS Lambda 関数を呼び出す」ブロックで呼ぶ（応答の検証は STRING_MAP）
- 返り値の `storeName` を `$.External.storeName` として「〇〇店です」の読み上げに使う。`found=false` なら店舗不明の案内へ

## 数字キー（1/2）

標準ウィジェットの音声通話画面に数字キーがあるかは、公式ドキュメントでは確認できていない。発信して確認する。

- 数字キーがある → そのまま「1/2」で分岐
- 無い → 同じ入力ブロックで発話（「予約」「問い合わせ」）でも分岐できるようにしてあるので、それで進める。数字が必須なら、自前のキーパッドから参加者 API（`CreateParticipantConnection` → `SendMessage`、`audio/dtmf`）で送る
