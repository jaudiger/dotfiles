{
  options,
  pkgs,
  lib,
  ...
}:

let
  hasNixLd = options ? programs.nix-ld;
in
{
  programs = lib.optionalAttrs hasNixLd {
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
