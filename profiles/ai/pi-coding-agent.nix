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

  # Web tools
  webToolsPython = pkgs.python3.withPackages (
    pythonPackages: with pythonPackages; [
      playwright
      trafilatura
    ]
  );
  webToolsBrowsers = pkgs.playwright-driver.browsers;
in

{
  modules = {
    home-manager = {
      programs.pi-coding-agent = {
        enable = true;

        extraPackages = [ webToolsPython ];

        package = pkgs.symlinkJoin {
          name = "pi-coding-agent";
          paths = [ pkgs.pi-coding-agent ];
          nativeBuildInputs = [ pkgs.makeWrapper ];
          postBuild = ''
            wrapProgram "$out/bin/pi" \
              --set NODE_PATH "${host.homeDirectory}/.pi/agent/npm/node_modules" \
              --set PI_WEB_TOOLS_PYTHON "${webToolsPython}/bin/python3" \
              --set PLAYWRIGHT_BROWSERS_PATH "${webToolsBrowsers}"
          '';
        };

        context = lib.concatMapStringsSep "\n" (name: builtins.readFile (rulesDir + "/${name}")) ruleFiles;

        settings = {
          collapseChangelog = true;
          inherit defaultModel defaultProvider defaultThinkingLevel;
          defaultTools = [
            "bash"
            "read"
            "edit"
            "write"
          ];
          enableAnalytics = false;
          enableInstallTelemetry = false;
          externalEditor = "nvim";
          extensions = [
            ../../config/pi/extensions
          ];
          packages = [
            "npm:pi-subagents@0.65.1"
          ];
          quietStartup = true;
          showCacheMissNotices = true;
          subagents = {
            agentOverrides = {
              delegate = {
                model = "openai-codex/gpt-5.6-luna";
                thinking = "medium";
                tools = [
                  "read"
                  "bash"
                  "edit"
                  "write"
                  "contact_supervisor"
                ];
              };
              oracle = {
                model = "openai-codex/gpt-5.6-terra";
                thinking = "xhigh";
                tools = [
                  "read"
                  "bash"
                ];
              };
              researcher = {
                model = "openai-codex/gpt-5.6-terra";
                thinking = "medium";
                tools = [
                  "bash"
                  "read"
                  "write"
                  "web_search"
                  "fetch_url"
                ];
                subagentOnlyExtensions = [
                  ../../config/pi/extensions/web-tools
                ];
              };
              reviewer = {
                model = "openai-codex/gpt-5.6-terra";
                thinking = "high";
                tools = [
                  "read"
                  "bash"
                  "contact_supervisor"
                ];
              };
              scout = {
                model = "openai-codex/gpt-5.6-luna";
                thinking = "medium";
                tools = [
                  "read"
                  "bash"
                  "write"
                  "contact_supervisor"
                ];
              };
              worker = {
                model = "openai-codex/gpt-5.6-luna";
                thinking = "high";
                tools = [
                  "read"
                  "bash"
                  "edit"
                  "write"
                  "contact_supervisor"
                ];
              };
            };
            defaultModel = "${defaultProvider}/${defaultModel}";
            defaultThinking = defaultThinkingLevel;
            modelScope = {
              allow = [ "openai-codex/gpt-5.6-*" ];
              agents = {
                delegate.allow = [ "openai-codex/gpt-5.6-luna" ];
                oracle.allow = [ "openai-codex/gpt-5.6-terra" ];
                researcher.allow = [ "openai-codex/gpt-5.6-terra" ];
                reviewer.allow = [ "openai-codex/gpt-5.6-terra" ];
                scout.allow = [ "openai-codex/gpt-5.6-luna" ];
                worker.allow = [ "openai-codex/gpt-5.6-luna" ];
              };
              enforce = true;
              strict = true;
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
        };
      };
    };
  };
}
