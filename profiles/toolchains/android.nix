{ pkgs, ... }:

{
  modules.home-manager = {
    home = {
      packages = with pkgs; [
        android-tools
      ];
    };
  };
}
