{
  config,
  lib,
  ...
}:

let
  host = config.modules.host;
  isDarwin = config.nixpkgs.hostPlatform.isDarwin;

  # Rules
  rulesDir = ../../config/agents/rules;
  ruleFiles = builtins.sort (a: b: a < b) (builtins.attrNames (builtins.readDir rulesDir));
in
{
  homebrew = lib.mkIf isDarwin {
    casks = [ "chatgpt" ];
  };

  nixpkgs.config.allowUnfreePackages = [ "codex" ];

  modules = {
    home-manager = {
      programs.codex = {
        enable = true;

        context = lib.concatMapStringsSep "\n" (name: builtins.readFile (rulesDir + "/${name}")) ruleFiles;

        hooks = {
          PreToolUse = [
            {
              matcher = "^Bash$";
              hooks = [
                {
                  type = "command";
                  command = "nu --stdin ${host.homeDirectory}/.codex/hooks/auto-approve-readonly/mod.nu codex";
                  statusMessage = "Checking Bash command";
                }
              ];
            }
          ];
        };

        skills = ../../config/agents/skills;

        settings = {
          analytics = {
            enabled = false;
          };
          approval_policy = "on-request";
          check_for_update_on_startup = false;
          features = {
            hooks = true;
          };
          feedback = {
            enabled = false;
          };
          model = "gpt-5.6-luna";
          model_reasoning_effort = "max";
          projects."${host.homeDirectory}/Development".trust_level = "trusted";
          sandbox_mode = "workspace-write";
          tui = {
            animations = false;
            notification_method = "bel";
            notifications = true;
            show_tooltips = false;
            status_line = [
              "model-with-reasoning"
              "context-remaining"
              "current-dir"
            ];
          };
        };
      };

      home.file."codexHooks" = {
        source = ../../config/agents/hooks;
        target = ".codex/hooks";
      };
    };
  };
}
