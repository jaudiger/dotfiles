{
  config,
  lib,
  pkgs,
  ...
}:

let
  host = config.modules.host;

  defaultProvider = "openai-codex";
  defaultModel = "gpt-5.6-luna";
  defaultThinkingLevel = "high";

  # Rules
  rulesDir = ../../config/agents/rules;
  ruleFiles = builtins.sort (a: b: a < b) (builtins.attrNames (builtins.readDir rulesDir));
in

{
  modules = {
    home-manager = {
      programs.pi-coding-agent = {
        enable = true;

        package = pkgs.symlinkJoin {
          name = "pi-coding-agent";
          paths = [ pkgs.pi-coding-agent ];
          nativeBuildInputs = [ pkgs.makeWrapper ];
          postBuild = ''
            wrapProgram "$out/bin/pi" --set NODE_PATH "${host.homeDirectory}/.pi/agent/npm/node_modules"
          '';
        };

        context = lib.concatMapStringsSep "\n" (name: builtins.readFile (rulesDir + "/${name}")) ruleFiles;

        settings = {
          collapseChangelog = true;
          inherit defaultModel defaultProvider defaultThinkingLevel;
          enableAnalytics = false;
          enableInstallTelemetry = false;
          externalEditor = "nvim";
          extensions = [
            ../../config/pi/extensions/brioche-packages-bot-review
            ../../config/pi/extensions/brioche-packages-debug-pr-failure
            ../../config/pi/extensions/brioche-packages-discover-package
            ../../config/pi/extensions/brioche-packages-submit-package
            ../../config/pi/extensions/github-dependabot-review
            ../../config/pi/extensions/notifications
            ../../config/pi/extensions/project-trust
            ../../config/pi/extensions/protected-paths
            ../../config/pi/extensions/sandbox-bash
          ];
          packages = [
            "npm:pi-subagents@0.61.0"
            "npm:pi-web-access@0.27.0"
          ];
          quietStartup = true;
          showCacheMissNotices = true;
          subagents = {
            agentOverrides = {
              delegate = {
                model = "openai-codex/gpt-5.6-luna";
                thinking = "medium";
              };
              oracle = {
                model = "openai-codex/gpt-5.6-terra";
                thinking = "xhigh";
              };
              researcher = {
                model = "openai-codex/gpt-5.6-terra";
                thinking = "medium";
              };
              reviewer = {
                model = "openai-codex/gpt-5.6-terra";
                thinking = "high";
              };
              scout = {
                model = "openai-codex/gpt-5.6-luna";
                thinking = "medium";
              };
              worker = {
                model = "openai-codex/gpt-5.6-luna";
                thinking = "high";
              };
            };
            defaultModel = "${defaultProvider}/${defaultModel}";
            defaultThinking = defaultThinkingLevel;
            modelScope = {
              allow = [ "openai-codex/gpt-5.*" ];
              enforce = true;
              agents = {
                delegate.allow = [ "openai-codex/gpt-5.6-luna" ];
                oracle.allow = [ "openai-codex/gpt-5.6-terra" ];
                researcher.allow = [ "openai-codex/gpt-5.6-terra" ];
                reviewer.allow = [ "openai-codex/gpt-5.6-terra" ];
                scout.allow = [ "openai-codex/gpt-5.6-luna" ];
                worker.allow = [ "openai-codex/gpt-5.6-luna" ];
              };
            };
          };
          thinkingBudgets = {
            minimal = 1024;
            low = 4096;
            medium = 10240;
            high = 32768;
            xhigh = 65536;
            max = 131072;
          };
          markdown = {
            mermaid = "streaming";
          };
          tuiMode = "fullscreen";
        };
      };

      home = {
        # Bash sandbox command for Pi
        packages = [
          (pkgs.writeShellApplication {
            name = "pi-bash-sandbox";
            runtimeInputs = [ pkgs.nix ];
            text = ''
              exec nix run ${lib.escapeShellArg "${host.dotfilesDirectory}/dev-shell/sandbox"} -- "$@"
            '';
          })
        ];

        file = {
          "piPromptTemplates" = {
            source = ../../config/pi/prompts;
            target = ".pi/agent/prompts";
          };
          "piSubagentsConfig" = {
            source = ../../config/pi/packages/pi-subagents.json;
            target = ".pi/agent/extensions/subagent/config.json";
          };
          "piWebSearchConfig" = {
            source = ../../config/pi/packages/web-search.json;
            target = ".config/pi/web-search.json";
          };
        };
      };
    };
  };
}
