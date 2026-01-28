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
    brews = [ "qemu" ];
  };

  modules.home-manager.home.packages = lib.optionals isLinux [
    pkgs.qemu
  ];
}
