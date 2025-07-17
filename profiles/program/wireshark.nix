{
  pkgs,
  lib,
  ...
}:

let
  isLinux = pkgs.stdenv.isLinux;
in
{
  modules.home-manager = lib.mkIf isLinux {
    home = {
      packages = with pkgs; [ wireshark ];
    };
  };
}
