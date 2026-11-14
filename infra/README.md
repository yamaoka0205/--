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

```bash
# boto3 + 認証情報がある場合
python3 scripts/create_table.py --region ap-northeast-1

# または CloudFormation
aws cloudformation deploy \
  --template-file infra/booking_app_table.yaml \
  --stack-name booking-app-table \
  --region ap-northeast-1
```
