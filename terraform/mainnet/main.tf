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
  excludes    = ["terraform", ".gitignore", "README.md", "yarn.lock", ".dockerignore", "docker-compose.yml", "Dockerfile"]
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

resource "aws_iam_role" "role" {
  name               = "${var.package_name}-${var.environment}-role-lambda"
  assume_role_policy = data.aws_iam_policy_document.policy.json
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
      DEPLOY_ON        = "lambda"
      ENVIRONMENT      = var.environment
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