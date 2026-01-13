{ ... }:

{
  modules.home-manager = {
    programs.direnv = {
      enable = true;

      silent = true;
    };
  };
}
