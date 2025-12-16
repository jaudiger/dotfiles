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
          alwaysThinkingEnabled = true;
          attribution = {
            commit = "";
            pr = "";
          };
          defaultMode = "acceptEdits";
          env = {
            DISABLE_AUTOUPDATER = 1;
          };
          permissions = {
            allow = [
              "Bash(cargo build:*)"
              "Bash(cargo check:*)"
              "Bash(cargo clippy:*)"
              "Bash(cargo doc:*)"
              "Bash(cargo fmt:*)"
              "Bash(cargo init:*)"
              "Bash(cargo metadata:*)"
              "Bash(cargo test:*)"
              "Bash(cargo tree:*)"
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
              "Bash(git grep:*)"
              "Bash(git log:*)"
              "Bash(git ls-files:*)"
              "Bash(git ls-remote:*)"
              "Bash(git ls-tree:*)"
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
              "Bash(npm info:*)"
              "Bash(npm ls:*)"
              "Bash(npm outdated:*)"
              "Bash(npm update:*)"
              "Bash(npm view:*)"
              "Bash(pnpm build:*)"
              "Bash(pnpm info:*)"
              "Bash(pnpm lint:*)"
              "Bash(pnpm list:*)"
              "Bash(pnpm test:*)"
              "Bash(pnpm view:*)"
              "Bash(pnpm outdated:*)"
              "Bash(pnpm update:*)"
              "Bash(pnpm why:*)"
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
