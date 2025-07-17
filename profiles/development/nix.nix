{ pkgs, ... }:

{
  modules.home-manager.home = {
    packages = with pkgs; [
      # Tools
      nix-init

      # Formatter
      # TODO: to replace with 'nixpkgs-fmt' once is finished: https://github.com/NixOS/nixfmt/issues/153
      nixfmt-rfc-style

      # Language server
      nixd
    ];
  };
}
