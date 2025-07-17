{ pkgs, lib, ... }:

let
  isLinux = pkgs.stdenv.isLinux;
in
{
  imports = [
    ./bash.nix
    ./gpg.nix
    ./home-manager.nix
    ./nix.nix
    ./nushell.nix
    ./sops.nix
    ./ssh-client.nix
    ./ssh-server.nix
    ./xdg.nix
    ./zsh.nix
  ];
  # TODO: fix nix-ld
  # ] ++ lib.optionals isLinux [
  #   ./nix-ld.nix
  # ];
}
