terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.14"
    }
  }
  required_version = ">= 1.0.0"
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}

provider "archive" {}

data "archive_file" "zip" {
  type        = "zip"
  source_dir  = "../../"
  excludes    = ["terraform", ".gitignore", "README.md", "yarn.lock", ".dockerignore", "docker-compose.yml", "Dockerfile", "config.yml.example"]
  output_path = "${var.package_name}.zip"
}

data "aws_iam_policy_document" "policy" {
  statement {
    sid     = ""
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      identifiers = ["lambda.amazonaws.com"]
      type        = "Service"
    }
  }
}

resource "aws_iam_policy" "policy_secret" {
  name   = "secret_manager_policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = ["*"]
      }
    ]
  })
}

resource "aws_iam_role" "role" {
  name                = "${var.package_name}-${var.environment}-role-lambda"
  assume_role_policy  = data.aws_iam_policy_document.policy.json
  managed_policy_arns = [aws_iam_policy.policy_secret.arn]
}

resource "aws_iam_policy_attachment" "attachment" {
  name       = "${var.package_name}-${var.environment}-attachment"
  roles      = [aws_iam_role.role.name]
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "function" {
  function_name    = "${var.package_name}-${var.environment}"
  filename         = data.archive_file.zip.output_path
  source_code_hash = data.archive_file.zip.output_base64sha256
  role             = aws_iam_role.role.arn
  handler          = "index.handler"
  runtime          = "nodejs14.x"
  timeout          = 660
  memory_size      = 512
  environment {
    variables = {
      NODE_NO_WARNINGS = 1
      REGION           = var.aws_region
      PACKAGE_NAME     = var.package_name
      ENVIRONMENT      = var.environment
      DEPLOY_ON        = "lambda"
    }
  }
  kms_key_arn      = ""
}

resource "aws_cloudwatch_event_rule" "schedule" {
  name                = "${var.package_name}-${var.environment}-rule"
  schedule_expression = "cron(*/10 * * * ? *)"
}

resource "aws_cloudwatch_event_target" "target" {
  rule      = aws_cloudwatch_event_rule.schedule.name
  target_id = aws_lambda_function.function.id
  arn       = aws_lambda_function.function.arn
}

resource "aws_secretsmanager_secret" "secret" {
  name = "${var.package_name}-${var.environment}"
}

resource "aws_secretsmanager_secret_version" "sversion" {
  secret_id     = aws_secretsmanager_secret.secret.id
  secret_string = <<EOF
  {
    "ethereum_ozd_api_key": "${var.ethereum_ozd_api_key}",
    "ethereum_ozd_api_secret": "${var.ethereum_ozd_api_secret}",
    "ethereum_wallet_private_key": "${var.ethereum_wallet_private_key}",
    "binance_ozd_api_key": "${var.binance_ozd_api_key}",
    "binance_ozd_api_secret": "${var.binance_ozd_api_secret}",
    "binance_wallet_private_key": "${var.binance_wallet_private_key}",
    "polygon_ozd_api_key": "${var.polygon_ozd_api_key}",
    "polygon_ozd_api_secret": "${var.polygon_ozd_api_secret}",
    "polygon_wallet_private_key": "${var.polygon_wallet_private_key}",
    "avalanche_ozd_api_key": "${var.avalanche_ozd_api_key}",
    "avalanche_ozd_api_secret": "${var.avalanche_ozd_api_secret}",
    "avalanche_wallet_private_key": "${var.avalanche_wallet_private_key}",
    "fantom_ozd_api_key": "${var.fantom_ozd_api_key}",
    "fantom_ozd_api_secret": "${var.fantom_ozd_api_secret}",
    "fantom_wallet_private_key": "${var.fantom_wallet_private_key}",
    "moonbeam_ozd_api_key": "${var.moonbeam_ozd_api_key}",
    "moonbeam_ozd_api_secret": "${var.moonbeam_ozd_api_secret}",
    "moonbeam_wallet_private_key": "${var.moonbeam_wallet_private_key}",
    "aurora_ozd_api_key": "${var.aurora_ozd_api_key}",
    "aurora_ozd_api_secret": "${var.aurora_ozd_api_secret}",
    "aurora_wallet_private_key": "${var.aurora_wallet_private_key}",
    "arbitrum_ozd_api_key": "${var.arbitrum_ozd_api_key}",
    "arbitrum_ozd_api_secret": "${var.arbitrum_ozd_api_secret}",
    "arbitrum_wallet_private_key": "${var.arbitrum_wallet_private_key}",
    "optimism_ozd_api_key": "${var.optimism_ozd_api_key}",
    "optimism_ozd_api_secret": "${var.optimism_ozd_api_secret}",
    "optimism_wallet_private_key": "${var.optimism_wallet_private_key}",
    "celo_ozd_api_key": "${var.celo_ozd_api_key}",
    "celo_ozd_api_secret": "${var.celo_ozd_api_secret}",
    "celo_wallet_private_key": "${var.celo_wallet_private_key}",
    "kava_ozd_api_key": "${var.kava_ozd_api_key}",
    "kava_ozd_api_secret": "${var.kava_ozd_api_secret}",
    "kava_wallet_private_key": "${var.kava_wallet_private_key}"
  }
EOF
}