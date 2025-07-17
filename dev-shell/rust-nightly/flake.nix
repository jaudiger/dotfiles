{
  description = "Rust nightly devshell";

  inputs = {
    # Use as the main nixpks repository (to get the latest stable packages)
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";

    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      nixpkgs,
      rust-overlay,
      ...
    }:
    let
      overlays = [ (import rust-overlay) ];

      # Helper to generate supported systems
      supportedSystems = [
        "aarch64-linux"
        "aarch64-darwin"
      ];
      forAllSystems =
        f:
        nixpkgs.lib.genAttrs supportedSystems (
          system:
          f {
            inherit system;
            pkgs = import nixpkgs { inherit system overlays; };
          }
        );
    in
    {
      devShells = forAllSystems (
        { pkgs, ... }:
        {
          default = pkgs.mkShell {
            nativeBuildInputs = with pkgs; [
              (rust-bin.nightly."2025-07-15".minimal.override {
                extensions = [
                  "rust-src"
                  "clippy"
                  "llvm-tools-preview"
                ];
              })

              pkg-config
            ];

            buildInputs =
              with pkgs;
              [ openssl ]
              ++ lib.optionals pkgs.stdenv.isDarwin [
                apple-sdk_15
              ];
          };
        }
      );
    };
}
