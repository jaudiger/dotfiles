{
  config,
  lib,
  ...
}:

let
  host = config.modules.host;

  # Rules
  rulesDir = ../../config/agents/rules;
  ruleFiles = builtins.sort (a: b: a < b) (builtins.attrNames (builtins.readDir rulesDir));
in
{
  modules = {
    home-manager = {
      programs.opencode = {
        enable = true;

        context = lib.concatMapStrings (name: builtins.readFile (rulesDir + "/${name}")) ruleFiles;

        settings = {
          autoupdate = false;
          share = "disabled";
          snapshot = false;

          watcher = {
            ignore = map (path: "**/${path}") host.ignores;
          };

          compaction = {
            prune = true;
          };
        };

        skills = ../../config/agents/skills;

        tui = {
          theme = "system";
          scroll_acceleration = {
            enabled = true;
          };
        };
      };
    };
  };
}
