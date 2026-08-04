{
  lib,
  ...
}:

let
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
          defaultModel = "gpt-5.6-luna";
          defaultProvider = "openai-codex";
          defaultThinkingLevel = "medium";
          enableAnalytics = false;
          enableInstallTelemetry = false;
          externalEditor = "nvim";
          extensions = [
            ../../config/pi/extensions/auto-approve-readonly.ts
            ../../config/pi/extensions/notifications.ts
            ../../config/pi/extensions/project-trust.ts
            ../../config/pi/extensions/protected-paths.ts
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
                thinking = "low";
              };
              oracle = {
                model = "openai-codex/gpt-5.6-sol";
                thinking = "high";
              };
              planner = {
                model = "openai-codex/gpt-5.6-sol";
                thinking = "high";
              };
              researcher = {
                model = "openai-codex/gpt-5.6-luna";
                thinking = "low";
              };
              reviewer = {
                model = "openai-codex/gpt-5.6-terra";
                thinking = "medium";
              };
              scout = {
                model = "openai-codex/gpt-5.6-luna";
                thinking = "low";
              };
              worker = {
                model = "openai-codex/gpt-5.6-terra";
                thinking = "medium";
              };
            };
            defaultModel = "openai-codex/gpt-5.6-luna";
            defaultThinking = "medium";
            modelScope = {
              allow = [ "openai-codex/gpt-5-*" ];
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
          uiMode = "fullscreen";
        };
      };

      home = {
        file = {
          "piAutoApproveReadonlyScripts" = {
            source = ../../config/agents/hooks/auto-approve-readonly;
            target = ".pi/extensions/pi-auto-approve-readonly-scripts";
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
            target = ".pi/web-search.json";
          };
        };
      };
    };
  };
}
