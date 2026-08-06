# NOTE: Claude desktop app is only available on macOS
{
  config,
  lib,
  ...
}:

let
  host = config.modules.host;
  isDarwin = config.nixpkgs.hostPlatform.isDarwin;

  # Hooks
  autoApproveReadonlyHooks = ../../config/agents/hooks/auto-approve-readonly;
in
{
  homebrew = lib.mkIf isDarwin {
    casks = [ "claude" ];
  };

  nixpkgs.config.allowUnfreePackages = [ "claude-code" ];

  modules = {
    home-manager = {
      programs.claude-code = {
        enable = true;

        skills = {
          code-audit = ../../config/agents/skills/code-audit;
          code-review = ../../config/agents/skills/code-review;
          code-security = ../../config/agents/skills/code-security;
          code-test = ../../config/agents/skills/code-test;
          deep-resolve = ../../config/agents/skills/deep-resolve;
          deep-review = ../../config/agents/skills/deep-review;
          lang-zig = ../../config/agents/skills/lang-zig;
          meta-learn = ../../config/agents/skills/meta-learn;
        };

        rulesDir = ../../config/agents/rules;

        hooks = lib.mapAttrs' (
          name: _: lib.nameValuePair "auto-approve-readonly/${name}" (autoApproveReadonlyHooks + "/${name}")
        ) (builtins.readDir autoApproveReadonlyHooks);

        settings = {
          alwaysThinkingEnabled = true;
          attribution = {
            commit = "";
            pr = "";
            sessionUrl = false;
          };
          autoDreamEnabled = true;
          env = {
            CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY = 1;
            CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = 1;
            CLAUDE_CODE_ENABLE_AWAY_SUMMARY = 0;
            CLAUDE_CODE_HIDE_ACCOUNT_INFO = 1;
            FORCE_AUTOUPDATE_PLUGINS = 1;
          };
          hooks = {
            PreToolUse = [
              {
                matcher = "Bash";
                hooks = [
                  {
                    type = "command";
                    command = "nu --stdin ${host.homeDirectory}/.claude/hooks/auto-approve-readonly/mod.nu claude";
                  }
                ];
              }
            ];
          };
          permissions = {
            defaultMode = "acceptEdits";
            deny = [
              "Read(.env*)"
              "Edit(.env*)"
            ];
          };
          preferredNotifChannel = "terminal_bell";
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
