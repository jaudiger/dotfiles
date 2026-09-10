{
  config,
  lib,
  pkgs,
  ...
}:

let
  host = config.modules.host;
  deepseekHarness = pkgs.callPackage ../../pkgs/deepseek-harness.nix { };

  # Rules
  rulesDir = ../../config/agents/rules;
  ruleFiles = builtins.sort (a: b: a < b) (builtins.attrNames (builtins.readDir rulesDir));
in
{
  modules.home-manager = {
    home = {
      packages = [ deepseekHarness ];

      file = {
        "dshCordisPatch" = {
          text = ''
            - id: agent-default-model
              config:
                provider: openai-codex
                model: gpt-5.6-luna

            - id: llm-pi-ai
              config:
                providers:
                  openai-codex:
                    reasoning: high

            - id: plugin-package-inventory-deepseek
              config:
                enabled: false

            - id: session-telemetry-otel
              config:
                mode: DISABLED
          '';
          target = ".dsh/cordis.patch.yml";
        };

        "dshAgentInstructions" = {
          text = lib.concatMapStringsSep "\n\n" (name: builtins.readFile (rulesDir + "/${name}")) ruleFiles;
          target = ".dsh/AGENTS.md";
        };
      };

      sessionVariables = {
        DSH_HOME = "${host.homeDirectory}/.dsh";
        DSH_TELEMETRY_MODE = "DISABLED";
      };
    };
  };
}
