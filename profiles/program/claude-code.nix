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
              "Bash(cat:*)"
              "Bash(find:*)"
              "Bash(grep:*)"
              "Bash(head:*)"
              "Bash(ls:*)"
              "Bash(tail:*)"
              "Glob"
              "Grep"
              "Read"
              "WebFetch"
              "WebSearch"
            ];
            deny = [
              "Read(./.env)"
              "Read(./.env.*)"
              "Read(./secrets/**)"
            ];
          };
        };
      };
    };
  };
}
