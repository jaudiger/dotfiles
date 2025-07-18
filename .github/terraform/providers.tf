terraform {
  required_version = "~> 1.12"

  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }
}

// Use 'gh auth login' to obtain a token
provider "github" {}
