{ config, pkgs, ... }:

let
  host = config.modules.host;
in
{
  # Documentation
  documentation = {
    enable = false;
  };

  # Fonts
  fonts.packages = with pkgs; [ nerd-fonts.jetbrains-mono ];

  # Common shell aliases
  modules.host.shell.aliases = {
    # Miscellaneous
    devfolder = "cd ${host.homeDirectory}/Development";
    downloadsfolder = "cd ${host.homeDirectory}/Downloads";

    # Dev-Shell
    dev-shell-c = "nix develop ${host.homeDirectory}/Development/git-repositories/jaudiger/dotfiles/dev-shell/c";
    dev-shell-go = "nix develop ${host.homeDirectory}/Development/git-repositories/jaudiger/dotfiles/dev-shell/go";
    dev-shell-rust = "nix develop ${host.homeDirectory}/Development/git-repositories/jaudiger/dotfiles/dev-shell/rust";
    dev-shell-rust-nightly = "nix develop ${host.homeDirectory}/Development/git-repositories/jaudiger/dotfiles/dev-shell/rust-nightly";
    dev-shell-rust-wasm = "nix develop ${host.homeDirectory}/Development/git-repositories/jaudiger/dotfiles/dev-shell/rust-wasm";
  };
}
