output "api_gateway_url" {
  description = "Base URL for the API Gateway (use as the public entry point)"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "ecr_repository_url" {
  description = "ECR repository URL — use in docker push and Kubernetes image spec"
  value       = aws_ecr_repository.app.repository_url
}

output "eks_cluster_name" {
  description = "EKS cluster name — use in aws eks update-kubeconfig"
  value       = aws_eks_cluster.main.name
}

output "eks_cluster_endpoint" {
  value = aws_eks_cluster.main.endpoint
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  description = "Cognito app client ID — include in the Authorization header JWT audience"
  value       = aws_cognito_user_pool_client.app.id
}

output "cognito_domain" {
  description = "Cognito hosted UI domain for token issuance"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "nlb_dns_name" {
  description = "Internal NLB DNS — used by API Gateway VPC Link (not exposed publicly)"
  value       = aws_lb.internal.dns_name
}

output "kms_key_arn" {
  description = "KMS key ARN — used for Secrets Manager and EKS etcd encryption"
  value       = aws_kms_key.main.arn
}

output "app_secret_arn" {
  description = "Secrets Manager secret ARN — reference for IAM policies and ESO"
  value       = aws_secretsmanager_secret.app.arn
}

output "app_iam_role_arn" {
  description = "IAM role ARN for the app pods (IRSA) — use in serviceaccount.yaml annotation"
  value       = aws_iam_role.app.arn
}

output "pod_log_group_name" {
  description = "CloudWatch log group for EKS Fargate pod logs — configure in fluent-bit-logging.yaml"
  value       = aws_cloudwatch_log_group.pods.name
}

output "alarms_sns_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarm notifications"
  value       = aws_sns_topic.alarms.arn
}
