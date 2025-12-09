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
  modules.home-manager = lib.mkIf isLinux {
    home = {
      packages = with pkgs; [ wireshark ];
    };
  };
}
