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
  sharedRulesPrompt = lib.concatMapStringsSep "\n\n" (
    name: builtins.readFile (rulesDir + "/${name}")
  ) ruleFiles;

  # Configurations
  basePatch = builtins.readFile ../../config/deepseek-harness/profiles/shared/base.patch.yml;
  subagentPresetsPatch = builtins.readFile ../../config/deepseek-harness/profiles/shared/subagent-presets.patch.yml;
in
{
  modules.home-manager = {
    home = {
      packages = [ deepseekHarness ];

      file = {
        "dshAgentInstructions" = {
          text = sharedRulesPrompt;
          target = ".dsh/AGENTS.md";
        };

        "dshUpdateDshSkill" = {
          source = ../../config/deepseek-harness/skills/update-dsh;
          target = ".dsh/skills/update-dsh";
        };

        "dshAcpCordisPatch" = {
          source = ../../config/deepseek-harness/profiles/shared/base.patch.yml;
          target = ".dsh/profiles/acp/cordis.patch.yml";
        };

        "dshDefaultCordisPatch" = {
          source = ../../config/deepseek-harness/profiles/default/cordis.patch.yml;
          target = ".dsh/cordis.patch.yml";
        };

        "dshHeadlessCordisPatch" = {
          text = lib.concatStrings [
            basePatch
            "\n"
            (builtins.readFile ../../config/deepseek-harness/profiles/headless/cordis.patch.yml)
            "\n"
            subagentPresetsPatch
          ];
          target = ".dsh/profiles/headless/cordis.patch.yml";
        };

        "dshSdkCordisPatch" = {
          source = ../../config/deepseek-harness/profiles/shared/base.patch.yml;
          target = ".dsh/profiles/sdk/cordis.patch.yml";
        };

        "dshWebCordisPatch" = {
          text = lib.concatStrings [
            basePatch
            "\n"
            (builtins.readFile ../../config/deepseek-harness/profiles/web/cordis.patch.yml)
            "\n"
            subagentPresetsPatch
          ];
          target = ".dsh/profiles/web/cordis.patch.yml";
        };
      };

      sessionVariables = {
        DSH_HOME = "${host.homeDirectory}/.dsh";
        DSH_TELEMETRY_DISABLED = "1";
      };
    };
  };
}
