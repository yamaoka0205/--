# Amazon Connect（BookingApp）

## フロー名

**`BookingApp-Inbound`**（全店共通・CONTACT_FLOW）

| 項目 | 値 |
|---|---|
| 名前 | `BookingApp-Inbound` |
| ContactFlowId | `e777dddc-a817-425b-b579-6f515a3f07d8` |
| インスタンス | `syusyoku-connect`（`98c809c0-0dd7-414f-979a-bf7816f5bfae`） |
| 定義ファイル | `infra/connect/BookingApp-Inbound.flow.json` |

## 動き

1. 日本語音声（Mizuki）
2. `BookingAppResolveStore` で店舗特定（普通の電話／非通知／WebRTC）
3. 見つかったら「〇〇店です。ご予約は1、それ以外は2」
4. 数字キー 1 → 予約（いまは案内のみ）／2 → 問い合わせ（いまは案内のみ）
5. 入力なし・1/2以外は1回だけやり直し、それでも無ければ終話
6. 店舗不明ならその旨を読んで終話

予約の聞き取り（Lex）と FAQ（Bedrock）はこれからこのフローに足す。

## 通信ウィジェットへの紐づけ（コンソール）

1. Connect 管理画面 → **チャネル** → **通信ウィジェット**
2. 使っている音声ウィジェットを開く
3. 着信時のフロー（またはウィジェットに紐づくコンタクトフロー）を **`BookingApp-Inbound`** に変更して保存
4. 許可ドメインに `http://localhost:3000` が入っていることを確認

紐づけが済んだら `http://localhost:3000` から発信し、「デモ食堂さくらです」と 1/2 の案内が聞こえるか確認する。

## 更新・再デプロイ

```bash
python3 scripts/deploy_connect_flow.py
```

フロー JSON の Lambda ARN はプレースホルダ。スクリプトが実行時に実 ARN へ差し替える。