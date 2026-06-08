{
  config,
  ...
}:

let
  host = config.modules.host;
in
{
  modules = {
    home-manager = {
      programs.opencode = {
        enable = true;

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

        tui = {
          theme = "system";
          scroll_acceleration = {
            enabled = true;
          };
        };

        skills = {
          code-audit = ../../config/agents/skills/code-audit;
          code-review = ../../config/agents/skills/code-review;
          code-security = ../../config/agents/skills/code-security;
          code-test = ../../config/agents/skills/code-test;
          deep-resolve = ../../config/agents/skills/deep-resolve;
          deep-review = ../../config/agents/skills/deep-review;
          lang-zig = ../../config/agents/skills/lang-zig;
        };
      };
    };
  };
}
