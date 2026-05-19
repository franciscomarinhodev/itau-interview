# ─── SNS Topic ────────────────────────────────────────────────────────────────

resource "aws_sns_topic" "alarms" {
  name = "${local.name_prefix}-alarms"
}

resource "aws_sns_topic_subscription" "alarms_email" {
  count     = var.alarm_notification_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_notification_email
}

# ─── Pod Log Group ────────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "pods" {
  name              = "/aws/eks/${aws_eks_cluster.main.name}/pods"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.main.arn
}

# ─── IAM: Fargate pod execution → CloudWatch Logs write ──────────────────────

resource "aws_iam_role_policy" "fargate_pod_logs" {
  name = "${local.name_prefix}-fargate-logs-policy"
  role = aws_iam_role.fargate_pod_execution.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogStream",
        "logs:CreateLogGroup",
        "logs:DescribeLogStreams",
        "logs:PutLogEvents",
      ]
      Resource = [
        aws_cloudwatch_log_group.pods.arn,
        "${aws_cloudwatch_log_group.pods.arn}:*",
      ]
    }]
  })
}

# ─── Locals ───────────────────────────────────────────────────────────────────

locals {
  apigw_dimensions = {
    ApiId = aws_apigatewayv2_api.main.id
    Stage = "$default"
  }
}

# ─── CloudWatch Alarms: API Gateway ──────────────────────────────────────────

# 5xx Error Rate > 1% over two 5-minute windows
resource "aws_cloudwatch_metric_alarm" "apigw_5xx_rate" {
  alarm_name          = "${local.name_prefix}-apigw-5xx-rate"
  alarm_description   = "5xx error rate > 1% — investigate pod health and DynamoDB connectivity"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 1
  evaluation_periods  = 2
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  metric_query {
    id          = "error_rate"
    expression  = "m2 / IF(m1 > 0, m1, 1) * 100"
    label       = "5xx Error Rate (%)"
    return_data = true
  }

  metric_query {
    id = "m1"
    metric {
      namespace   = "AWS/ApiGateway"
      metric_name = "Count"
      period      = 300
      stat        = "Sum"
      dimensions  = local.apigw_dimensions
    }
  }

  metric_query {
    id = "m2"
    metric {
      namespace   = "AWS/ApiGateway"
      metric_name = "5XXError"
      period      = 300
      stat        = "Sum"
      dimensions  = local.apigw_dimensions
    }
  }
}

# 4xx Error Rate > 10% over two 5-minute windows
resource "aws_cloudwatch_metric_alarm" "apigw_4xx_rate" {
  alarm_name          = "${local.name_prefix}-apigw-4xx-rate"
  alarm_description   = "4xx error rate > 10% — check auth failures, validation errors, or rate limiting"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 10
  evaluation_periods  = 2
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  metric_query {
    id          = "error_rate"
    expression  = "m2 / IF(m1 > 0, m1, 1) * 100"
    label       = "4xx Error Rate (%)"
    return_data = true
  }

  metric_query {
    id = "m1"
    metric {
      namespace   = "AWS/ApiGateway"
      metric_name = "Count"
      period      = 300
      stat        = "Sum"
      dimensions  = local.apigw_dimensions
    }
  }

  metric_query {
    id = "m2"
    metric {
      namespace   = "AWS/ApiGateway"
      metric_name = "4XXError"
      period      = 300
      stat        = "Sum"
      dimensions  = local.apigw_dimensions
    }
  }
}

# End-to-end P99 latency > threshold over three consecutive minutes
resource "aws_cloudwatch_metric_alarm" "apigw_latency_p99" {
  alarm_name          = "${local.name_prefix}-apigw-latency-p99"
  alarm_description   = "End-to-end P99 latency > ${var.alarm_latency_p99_ms}ms — investigate backend or cold starts"
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.alarm_latency_p99_ms
  evaluation_periods  = 3
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  namespace          = "AWS/ApiGateway"
  metric_name        = "Latency"
  period             = 60
  extended_statistic = "p99"
  dimensions         = local.apigw_dimensions
}

# Backend (NLB → pod) P99 latency > threshold over three consecutive minutes
resource "aws_cloudwatch_metric_alarm" "apigw_integration_latency_p99" {
  alarm_name          = "${local.name_prefix}-apigw-integration-latency-p99"
  alarm_description   = "Integration P99 latency > ${var.alarm_integration_latency_p99_ms}ms — pods or DynamoDB are slow"
  comparison_operator = "GreaterThanThreshold"
  threshold           = var.alarm_integration_latency_p99_ms
  evaluation_periods  = 3
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  namespace          = "AWS/ApiGateway"
  metric_name        = "IntegrationLatency"
  period             = 60
  extended_statistic = "p99"
  dimensions         = local.apigw_dimensions
}
