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
    dev-shell-c = "nix develop ${host.dotfilesDirectory}/dev-shell/c";
    dev-shell-rust-nightly = "nix develop ${host.dotfilesDirectory}/dev-shell/rust-nightly";
    dev-shell-rust-wasm = "nix develop ${host.dotfilesDirectory}/dev-shell/rust-wasm";
    dev-shell-zig-nightly = "nix develop ${host.dotfilesDirectory}/dev-shell/zig-nightly";
  };

  # Additional paths for shell sessions
  modules.home-manager.home.sessionPath = [
    "${host.homeDirectory}/Development/git-repositories/jaudiger/personal-scripts"
    "${host.homeDirectory}/Development/git-repositories/jaudiger/vscode-dev-containers"
    "${host.homeDirectory}/Development/work-scripts"
    "${host.homeDirectory}/Development/work-scripts/alaska"
  ];
}
