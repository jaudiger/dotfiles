{
  config,
  pkgs,
  lib,
  ...
}:

let
  isDarwin = config.nixpkgs.hostPlatform.isDarwin;
  isLinux = config.nixpkgs.hostPlatform.isLinux;
in
{
  homebrew = lib.mkIf isDarwin {
    casks = [ "freecad" ];
  };

  modules.home-manager.home.packages = lib.optionals isLinux [
    pkgs.freecad
  ];
}
