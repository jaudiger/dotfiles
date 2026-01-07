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
  homebrew.casks = lib.mkIf isDarwin [ "zoom" ];

  modules.home-manager.home.packages = lib.optionals isLinux [
    pkgs.zoom-us
  ];
}
