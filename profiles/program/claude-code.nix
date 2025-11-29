{ ... }:

{
  modules = {
    home-manager = {
      programs.claude-code = {
        enable = true;

        settings = {
          defaultMode = "acceptEdits";
          includeCoAuthoredBy = false;
        };
      };
    };
  };
}
