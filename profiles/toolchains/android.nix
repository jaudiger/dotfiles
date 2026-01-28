{
  config,
  pkgs,
  lib,
  ...
}:

let
  isLinux = config.nixpkgs.hostPlatform.isLinux;
in
{
  modules.home-manager = {
    home = {
      packages =
        with pkgs;
        [
          android-tools
        ]
        ++ lib.optionals isLinux [
          pmbootstrap
        ];
    };
  };
}
