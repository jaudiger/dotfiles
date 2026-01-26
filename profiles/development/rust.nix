{
  inputs,
  config,
  pkgs,
  lib,
  ...
}:

let
  isDarwin = config.nixpkgs.hostPlatform.isDarwin;
in
{
  nixpkgs.overlays = [ inputs.rust-overlay.overlays.default ];

  modules.home-manager = {
    programs.cargo = {
      enable = true;

      settings = {
        cache = {
          auto-clean-frequency = "7 days";
        };
      };
    };

    home = {
      packages = with pkgs; [
        (rust-bin.stable.latest.minimal.override {
          extensions = [
            "clippy"
            "rustfmt"
            "rust-src"
            "llvm-tools-preview"
          ];
        })

        (pkgs.lib.setPrio 10 rustup) # Lower priority to prevent collision with the rust-based packages.

        libllvm
        rust-analyzer
        pkg-config
        grcov

        cargo-audit
        cargo-binutils
        cargo-bloat
        cargo-edit
        cargo-mutants
        cargo-msrv
        cargo-udeps

        tokio-console
      ];

      sessionVariables =
        with pkgs;
        lib.mkMerge [
          (lib.mkIf isDarwin {
            LIBRARY_PATH = "$LIBRARY_PATH\${LIBRARY_PATH:+:}" + "${darwin.libiconv}/lib";
          })
        ];
    };

    # Neovim configuration
    programs.nixvim = {
      plugins.lsp.servers = {
        rust_analyzer = {
          enable = true;
          installCargo = false;
          installRustc = false;
        };
      };
    };
  };
}
