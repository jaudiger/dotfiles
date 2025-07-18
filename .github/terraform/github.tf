resource "github_repository" "dotfiles" {
  name        = "dotfiles"
  description = "Those are designed for my use cases ;)"

  visibility = "public"

  has_downloads = false
  has_issues    = false
  has_projects  = false
  has_wiki      = false

  delete_branch_on_merge = true
}

resource "github_repository_ruleset" "branch_protection" {
  name        = "main-branch-protection"
  repository  = github_repository.dotfiles.name
  target      = "branch"
  enforcement = "active"

  conditions {
    ref_name {
      include = ["refs/heads/main"]
      exclude = []
    }
  }

  rules {
    deletion                = true
    required_linear_history = true
    non_fast_forward        = true
  }
}
