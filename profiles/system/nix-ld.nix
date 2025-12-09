{ pkgs, lib, ... }:

let
  isLinux = pkgs.stdenv.isLinux;
in
{
  programs = lib.optionalAttrs isLinux {
    nix-ld = {
      enable = true;

      libraries = with pkgs; [
        stdenv.cc.cc
        openssl
        zlib
      ];
    };
  };
}
