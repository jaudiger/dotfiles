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
  homebrew.casks = lib.mkIf isDarwin [ "sweet-home3d" ];

  modules.home-manager.home.packages = lib.optionals isLinux [
    pkgs.sweethome3d.application
  ];
}
