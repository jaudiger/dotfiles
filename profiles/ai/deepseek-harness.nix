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
        "dshAgentInstructions" = {
          text = lib.concatMapStringsSep "\n\n" (name: builtins.readFile (rulesDir + "/${name}")) ruleFiles;
          target = ".dsh/AGENTS.md";
        };

        "dshAgentPresets" = {
          source = ../../config/deepseek-harness/agent-presets;
          target = ".dsh/.agent-presets";
        };

        "dshCordisPatch" = {
          source = ../../config/deepseek-harness/cordis.patch.yml;
          target = ".dsh/cordis.patch.yml";
        };
      };

      sessionVariables = {
        DSH_HOME = "${host.homeDirectory}/.dsh";
        DSH_TELEMETRY_MODE = "DISABLED";
      };
    };
  };
}
