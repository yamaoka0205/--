# Infrastructure

## BookingApp（DynamoDB）

`DB設計.md` に従った単一テーブル。

| 項目 | 値 |
|---|---|
| テーブル名 | `BookingApp` |
| PK / SK | `PK` (S) / `SK` (S) |
| 課金 | オンデマンド（`PAY_PER_REQUEST`） |
| GSI | `GSI1`（`GSI1PK` / `GSI1SK`、Projection ALL） |
| TTL | `expiresAt` |

GSI2 は完成系（申し込み一覧など）で有効化する。属性名は設計書どおり空けておく。

## ローカルで作る

```bash
# 別ターミナルで DynamoDB Local を起動
./scripts/start_dynamodb_local.sh

# テーブル作成（冪等）
python3 scripts/create_table.py --endpoint-url http://localhost:8000
```

## AWS で作る

前提: 環境に `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_DEFAULT_REGION` が入っていること（値はリポジトリに書かない）。

```bash
# boto3 + 認証情報がある場合
python3 scripts/create_table.py --region ap-northeast-1

# または CloudFormation
aws cloudformation deploy \
  --template-file infra/booking_app_table.yaml \
  --stack-name booking-app-table \
  --region ap-northeast-1
```

東京リージョンに `BookingApp` を作成済み（IAM ユーザー `cursor`）。再実行は冪等で、既存テーブルはそのまま使う。

## デモ店のシード

```bash
python3 scripts/seed_demo_store.py

# 転送先番号を入れる場合（リポジトリには書かない）
TRANSFER_PHONE_NUMBER=+81... python3 scripts/seed_demo_store.py
```

投入内容（`t_demo_001` / `demo-sakura`）：

- `PROFILE` + `INBOUND#`
- `HOURS#`（月〜土 11:00-22:00、日定休、最終開始 20:00）
- `TABLE#`（AI予約: 4人用4卓 + 6人用2卓、当日客用: 4人用2卓）
