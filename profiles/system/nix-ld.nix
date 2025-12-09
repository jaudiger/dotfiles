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
  programs.nix-ld = lib.mkIf isLinux {
    enable = true;

    libraries = with pkgs; [
      stdenv.cc.cc
      openssl
      zlib
    ];
  };
}
