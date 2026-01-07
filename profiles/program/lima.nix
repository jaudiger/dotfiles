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
    brews = [
      "lima"
      "lima-additional-guestagents"
    ];
  };

  modules.home-manager.home.packages = lib.optionals isLinux [
    pkgs.lima
    pkgs.lima-additional-guestagents
  ];
}
