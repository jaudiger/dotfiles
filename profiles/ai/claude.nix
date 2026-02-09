# NOTE: Claude desktop app is only available on macOS
{
  config,
  lib,
  ...
}:

let
  host = config.modules.host;
  isDarwin = config.nixpkgs.hostPlatform.isDarwin;
in
{
  homebrew = lib.mkIf isDarwin {
    casks = [ "claude" ];
  };

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
            CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY = 1;
            CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = 1;
            CLAUDE_CODE_HIDE_ACCOUNT_INFO = 1;
            FORCE_AUTOUPDATE_PLUGINS = 1;
          };
          permissions = {
            allow = [
              "Bash(cargo bench:*)"
              "Bash(cargo build:*)"
              "Bash(cargo check:*)"
              "Bash(cargo clean:*)"
              "Bash(cargo clippy:*)"
              "Bash(cargo doc:*)"
              "Bash(cargo fmt:*)"
              "Bash(cargo init:*)"
              "Bash(cargo metadata:*)"
              "Bash(cargo rustc:*)"
              "Bash(cargo test:*)"
              "Bash(cargo tree:*)"
              "Bash(cargo update:*)"
              "Bash(cargo upgrade:*)"
              "Bash(cat:*)"
              "Bash(cd:*)"
              "Bash(diff:*)"
              "Bash(echo:*)"
              "Bash(eslint:*)"
              "Bash(file:*)"
              "Bash(find:*)"
              "Bash(gh * list:*)"
              "Bash(gh * view:*)"
              "Bash(gh search:*)"
              "Bash(git branch:*)"
              "Bash(git diff:*)"
              "Bash(git fetch:*)"
              "Bash(git grep:*)"
              "Bash(git log:*)"
              "Bash(git ls-files:*)"
              "Bash(git ls-remote:*)"
              "Bash(git ls-tree:*)"
              "Bash(git rev-parse:*)"
              "Bash(git show:*)"
              "Bash(git stash:*)"
              "Bash(git status:*)"
              "Bash(glab * list:*)"
              "Bash(glab * view:*)"
              "Bash(grep:*)"
              "Bash(head:*)"
              "Bash(helm show:*)"
              "Bash(helm template:*)"
              "Bash(jq:*)"
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
              "Bash(rustc check:*)"
              "Bash(shellcheck:*)"
              "Bash(shfmt:*)"
              "Bash(sort:*)"
              "Bash(tail:*)"
              "Bash(tar:*)"
              "Bash(tee:*)"
              "Bash(terraform init:*)"
              "Bash(terraform fmt:*)"
              "Bash(terraform plan:*)"
              "Bash(terraform test:*)"
              "Bash(terraform validate:*)"
              "Bash(tflint:*)"
              "Bash(tr:*)"
              "Bash(tree:*)"
              "Bash(uname:*)"
              "Bash(uniq:*)"
              "Bash(wc:*)"
              "Bash(which:*)"
              "Bash(xxd:*)"
              "Bash(zig build:*)"
              "Bash(zig build-exe:*)"
              "Bash(zig build-lib:*)"
              "Bash(zig env:*)"
              "Bash(zig fmt:*)"
              "Bash(zig test:*)"
              "Glob"
              "Grep"
              "Read"
              "WebFetch"
              "WebSearch"
            ];
            deny = [
              "Bash(git push --force:*)"
              "Bash(git reset:*)"
              "Bash(git stash clear:*)"
              "Bash(git stash drop:*)"
              "Bash(rm -rf /:*)"
              "Edit(.env*)"
              "Read(.env*)"
              "Write(.env*)"
            ];
          };
          showTurnDuration = false;
          spinnerTipsEnabled = false;
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
