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
