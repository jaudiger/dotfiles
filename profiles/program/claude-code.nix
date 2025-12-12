{ config, ... }:

let
  host = config.modules.host;
in
{
  modules = {
    home-manager = {
      programs.claude-code = {
        enable = true;

        settings = {
          defaultMode = "acceptEdits";
          env = {
            DISABLE_AUTOUPDATER = 1;
          };
          includeCoAuthoredBy = false;
          permissions = {
            allow = [
              "Bash(cargo build:*)"
              "Bash(cargo check:*)"
              "Bash(cargo clippy:*)"
              "Bash(cargo doc:*)"
              "Bash(cargo fmt:*)"
              "Bash(cargo init:*)"
              "Bash(cargo test:*)"
              "Bash(cargo update:*)"
              "Bash(cargo upgrade:*)"
              "Bash(cat:*)"
              "Bash(cd:*)"
              "Bash(diff:*)"
              "Bash(eslint:*)"
              "Bash(find:*)"
              "Bash(gh pr list:*)"
              "Bash(gh pr view:*)"
              "Bash(gh issue list:*)"
              "Bash(gh issue view:*)"
              "Bash(gh repo view:*)"
              "Bash(gh run view:*)"
              "Bash(git branch:*)"
              "Bash(git diff:*)"
              "Bash(git fetch:*)"
              "Bash(git log:*)"
              "Bash(git ls-files:*)"
              "Bash(git ls-remote:*)"
              "Bash(git show:*)"
              "Bash(git status:*)"
              "Bash(glab mr list:*)"
              "Bash(glab mr view:*)"
              "Bash(glab issue list:*)"
              "Bash(glab issue view:*)"
              "Bash(glab repo view:*)"
              "Bash(glab ci view:*)"
              "Bash(grep:*)"
              "Bash(head:*)"
              "Bash(helm show:*)"
              "Bash(helm template:*)"
              "Bash(ls:*)"
              "Bash(markdownlint-cli2:*)"
              "Bash(npm outdated:*)"
              "Bash(npm update:*)"
              "Bash(npm view:*)"
              "Bash(pnpm build:*)"
              "Bash(pnpm info:*)"
              "Bash(pnpm outdated:*)"
              "Bash(pnpm update:*)"
              "Bash(prettier:*)"
              "Bash(pwd:*)"
              "Bash(robocop check:*)"
              "Bash(robocop docs:*)"
              "Bash(robocop format:*)"
              "Bash(ruff check:*)"
              "Bash(ruff format:*)"
              "Bash(shellcheck:*)"
              "Bash(shfmt:*)"
              "Bash(sort:*)"
              "Bash(tail:*)"
              "Bash(terraform init:*)"
              "Bash(terraform fmt:*)"
              "Bash(terraform plan:*)"
              "Bash(terraform test:*)"
              "Bash(terraform validate:*)"
              "Bash(tflint:*)"
              "Bash(tree:*)"
              "Bash(uniq:*)"
              "Bash(wc:*)"
              "Glob"
              "Grep"
              "Read"
              "WebFetch"
              "WebSearch"
            ];
            deny = [
              "Bash(git push --force:*)"
              "Bash(git reset --hard:*)"
              "Bash(rm -rf /*:*)"
              "Edit(.env*)"
              "Read(.env*)"
              "Write(.env*)"
            ];
          };
          statusLine = {
            type = "command";
            command = "${host.homeDirectory}/.claude/scripts/status-line";
            padding = 0;
          };
        };

        mcpServers = {
          github = {
            type = "stdio";
            command = "docker";
            args = [
              "run"
              "-i"
              "--rm"
              "-e"
              "GITHUB_PERSONAL_ACCESS_TOKEN"
              "ghcr.io/github/github-mcp-server:v0.24.1"
            ];
            toolFilter = {
              allow = [
                "get_commit"
                "get_file_contents"
                "get_latest_release"
                "get_tag"
                "issue_read"
                "list_commits"
                "list_issues"
                "list_releases"
                "list_tags"
                "search_code"
                "search_issues"
                "search_repositories"
              ];
            };
          };
        };
      };

      home = {
        file."claudeCodeStatusLine" = {
          source = ../../config/claude-code/status-line;
          target = ".claude/scripts/status-line";
        };
      };
    };
  };
}
