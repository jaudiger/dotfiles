{ ... }:

{
  modules = {
    home-manager = {
      programs.claude-code = {
        enable = true;

        settings = {
          defaultMode = "acceptEdits";
          includeCoAuthoredBy = false;

          permissions = {
            allow = [
              "Bash(ls:*)"
              "Read"
              "WebFetch"
              "WebSearch"
            ];
            deny = [
              "Read(./.env)"
              "Read(./secrets/**)"
            ];
          };
        };
      };
    };
  };
}
