{
  lib,
  ...
}:

let
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

        context = lib.concatMapStringsSep "\n" (name: builtins.readFile (rulesDir + "/${name}")) ruleFiles;

        settings = {
          collapseChangelog = true;
          inherit defaultModel defaultProvider defaultThinkingLevel;
          enableAnalytics = false;
          enableInstallTelemetry = false;
          externalEditor = "nvim";
          extensions = [
            ../../config/pi/extensions/auto-approve-safe-commands
            ../../config/pi/extensions/notifications
            ../../config/pi/extensions/project-trust
            ../../config/pi/extensions/protected-paths
          ];
          packages = [
            "npm:pi-lens"
            "npm:pi-subagents"
            "npm:pi-web-access"
          ];
          quietStartup = true;
          showCacheMissNotices = true;
          skills = [ ../../config/agents/skills ];
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
        file = {
          "piAutoApproveSafeCommandsScript" = {
            source = ../../config/agents/hooks/auto-approve-safe-commands;
            target = ".pi/extensions/pi-auto-approve-safe-commands-scripts";
          };
          "piLensConfig" = {
            source = ../../config/pi/packages/pi-lens-config.json;
            target = ".pi-lens/config.json";
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
