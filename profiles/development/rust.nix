{
  inputs,
  pkgs,
  lib,
  ...
}:

let
  isDarwin = pkgs.stdenv.isDarwin;
in
{
  nixpkgs.overlays = [ inputs.rust-overlay.overlays.default ];

  modules.home-manager.home = {
    packages = with pkgs; [
      (rust-bin.stable.latest.minimal.override {
        extensions = [
          "clippy"
          "rustfmt"
          "rust-src"
          "llvm-tools-preview"
        ];
      })

      libllvm
      rust-analyzer
      pkg-config
      grcov

      cargo-audit
      cargo-binutils
      cargo-bloat
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
}
