output "lambda" {
  value = aws_lambda_function.function.arn
}

output "event_rule" {
  value = aws_cloudwatch_event_rule.schedule.arn
}