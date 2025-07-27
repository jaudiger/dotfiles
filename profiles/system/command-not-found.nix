{ ... }:

{
  modules.home-manager = {
    programs.command-not-found = {
      enable = true;
    };
  };
}
