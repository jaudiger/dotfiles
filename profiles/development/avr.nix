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
    brews = [ "avr-gcc" ];
  };

  modules.home-manager.home.packages = lib.optionals isLinux (
    with pkgs.pkgsCross.avr.buildPackages;
    [
      gcc
      binutils
    ]
  );
}
