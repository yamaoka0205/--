# WebRTC 電話デモ

Connect の通信ウィジェット（音声）を埋め込んだページ。発信すると共通フローに入り、`inboundId=demo-sakura` で店舗を特定する。

## 起動

```bash
cd demo/webrtc
python3 -m http.server 5173 --bind localhost
```

ブラウザで `http://localhost:5173` を開く（`127.0.0.1` は別ホスト扱いでウィジェットが読み込まれない）。

## Connect 側の前提

- 通信ウィジェットの許可ドメインに `http://localhost:5173` を登録する
- ウィジェットに紐づけるフローは全店共通フロー
- フローでは `$.Attributes.HostedWidget-inboundId` を店舗特定の Lambda に渡す（ウィジェットが `HostedWidget-` を付ける）

## 数字キー（1/2）

標準ウィジェットの音声通話画面に数字キーがあるかは、公式ドキュメントでは確認できていない。発信して確認する。

- 数字キーがある → そのまま「1/2」で分岐
- 無い → 同じ入力ブロックで発話（「予約」「問い合わせ」）でも分岐できるようにしてあるので、それで進める。数字が必須なら、自前のキーパッドから参加者 API（`CreateParticipantConnection` → `SendMessage`、`audio/dtmf`）で送る
