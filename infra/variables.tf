variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project" {
  type    = string
  default = "itau-messages"
}

variable "environment" {
  type    = string
  default = "production"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "environment must be development, staging or production."
  }
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "eks_cluster_version" {
  type    = string
  default = "1.31"
}

variable "app_port" {
  type    = number
  default = 3000
}

variable "dynamodb_table" {
  type    = string
  default = "Messages"
}

variable "alarm_notification_email" {
  type        = string
  default     = ""
  description = "Email address for CloudWatch alarm notifications. Leave empty to skip SNS subscription."
}

variable "alarm_latency_p99_ms" {
  type        = number
  default     = 2000
  description = "P99 end-to-end latency threshold (ms) before the alarm fires."
}

variable "alarm_integration_latency_p99_ms" {
  type        = number
  default     = 1500
  description = "P99 integration (backend) latency threshold (ms) before the alarm fires."
}
