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
              "Bash(cargo check:*)"
              "Bash(cargo clippy:*)"
              "Bash(cargo fmt:*)"
              "Bash(cargo update:*)"
              "Bash(cat:*)"
              "Bash(cd:*)"
              "Bash(eslint:*)"
              "Bash(find:*)"
              "Bash(gh pr view:*)"
              "Bash(gh issue view:*)"
              "Bash(gh repo view:*)"
              "Bash(gh run view:*)"
              "Bash(git diff:*)"
              "Bash(git log:*)"
              "Bash(git ls-remote:*)"
              "Bash(git show:*)"
              "Bash(git status:*)"
              "Bash(glab mr view:*)"
              "Bash(glab issue view:*)"
              "Bash(glab repo view:*)"
              "Bash(glab ci view:*)"
              "Bash(grep:*)"
              "Bash(head:*)"
              "Bash(ls:*)"
              "Bash(markdownlint-cli2:*)"
              "Bash(npm outdated:*)"
              "Bash(npm update:*)"
              "Bash(prettier:*)"
              "Bash(pwd:*)"
              "Bash(robocop:*)"
              "Bash(robotidy:*)"
              "Bash(ruff check:*)"
              "Bash(ruff format:*)"
              "Bash(shellcheck:*)"
              "Bash(shfmt:*)"
              "Bash(sort:*)"
              "Bash(tail:*)"
              "Bash(tflint:*)"
              "Bash(tree:*)"
              "Bash(uniq:*)"
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
              "ghcr.io/github/github-mcp-server"
            ];
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
