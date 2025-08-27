{ ... }:

{
  modules = {
    home-manager = {
      programs.claude-code = {
        enable = true;
      };
    };
  };
}
