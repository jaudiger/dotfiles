{ ... }:

{
  modules.home-manager = {
    programs.nix-index = {
      enable = true;
    };
  };
}
