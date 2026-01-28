{ pkgs, ... }:

{
  modules.home-manager = {
    home = {
      packages = [
        pkgs.android-tools
      ];
    };
  };
}
