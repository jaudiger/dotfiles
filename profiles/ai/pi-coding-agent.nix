{
  lib,
  ...
}:

let
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
          "piWebSearch" = {
            source = ../../config/pi/packages/web-search.json;
            target = ".pi/web-search.json";
          };
        };
      };
    };
  };
}
