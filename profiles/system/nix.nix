{ config, pkgs, ... }:

let
  isDarwin = pkgs.stdenv.isDarwin;
  host = config.modules.host;
in
{
  nixpkgs.config.allowUnfree = true;

  nix = {
    settings = {
      download-buffer-size = 134217728; # 128MB

      substituters = [
        "https://cache.nixos.org"
        "https://nix-community.cachix.org"
      ];

      trusted-public-keys = [
        "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="
      ];

      experimental-features = [
        "nix-command"
        "flakes"
      ];
    };

    extraOptions =
      if isDarwin then
        ''
          extra-platforms = x86_64-darwin aarch64-darwin;
        ''
      else
        "";

    optimise = {
      # Prefer to use this option instead of "nix.settings.auto-optimise-store"
      # More information: https://github.com/nix-darwin/nix-darwin/pull/1152
      automatic = true;
    };

    gc = {
      automatic = true;
      options = "--delete-older-than 7d";
    }
    // (
      if isDarwin then
        {
          # Run on first day of every week
          interval = {
            Weekday = 0;
            Hour = 0;
            Minute = 0;
          };
        }
      else
        { dates = "weekly"; }
    );
  };

  system.activationScripts.postActivation.text = ''
    # diff-viewer to see the updated packages
    echo "--- Output diff packages for system ---"
    readarray -t file_args < <(find /nix/var/nix/profiles -maxdepth 1 -name "system-*-link" -type l | sort -n | tail -2)
    nix store diff-closures "''${file_args[@]}"
    echo "--- **** ---"

    # Apply macOS settings without the need to logout/login
    /System/Library/PrivateFrameworks/SystemAdministration.framework/Resources/activateSettings -u
  '';

  modules.host.shell.nonPortableAliases = {
    nix-fmt = "treefmt";

    nix-full-update = "nix-channel --update darwin; nix flake update --flake ${host.homeDirectory}/Development/git-repositories/jaudiger/dotfiles; nix-update";
    nix-update-dev-shell = "nix flake update --flake ${host.homeDirectory}/Development/git-repositories/jaudiger/dotfiles/dev-shell/c; nix flake update --flake ${host.homeDirectory}/Development/git-repositories/jaudiger/dotfiles/dev-shell/rust-nightly; nix flake update --flake ${host.homeDirectory}/Development/git-repositories/jaudiger/dotfiles/dev-shell/rust-wasm; nix flake update --flake ${host.homeDirectory}/Development/git-repositories/jaudiger/dotfiles/dev-shell/zig-nightly";
    nix-clean = "nix-collect-garbage -d";
  }
  // (
    if isDarwin then
      {
        nix-update = "sudo darwin-rebuild switch --flake ${host.homeDirectory}/Development/git-repositories/jaudiger/dotfiles#darwin-aarch64";
      }
    else
      {
        nix-update = "sudo nixos-rebuild switch --flake ${host.homeDirectory}/Development/git-repositories/jaudiger/dotfiles#nixos-aarch64";
      }
  );
}
