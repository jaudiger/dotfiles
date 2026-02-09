{
  description = "Rust WASM devshell";

  inputs = {
    # Use as the main nixpkgs repository (to get the latest packages)
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";

    # To get Rust toolchains
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
      overlays = [ rust-overlay.overlays.default ];

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
              (rust-bin.stable."1.93.0".minimal.override {
                extensions = [
                  "rust-src"
                  "clippy"
                  "llvm-tools-preview"
                ];

                targets = [
                  "wasm32-unknown-unknown"
                ];
              })

              pkg-config

              binaryen
              trunk
              wasm-bindgen-cli_0_2_106
              wasm-pack
            ];

            buildInputs =
              with pkgs;
              [ openssl ]
              ++ lib.optionals pkgs.stdenv.isDarwin [
                apple-sdk_26
              ];
          };
        }
      );
    };
}
