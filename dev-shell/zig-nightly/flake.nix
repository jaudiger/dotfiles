{
  description = "Zig nightly devshell";

  inputs = {
    # Use as the main nixpkgs repository (to get the latest stable packages)
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";

    # To get Zig toolchains
    zig-overlay = {
      url = "github:mitchellh/zig-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      nixpkgs,
      zig-overlay,
      ...
    }:
    let
      overlays = [ zig-overlay.overlays.default ];

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
              zigpkgs.master
            ];

            buildInputs =
              with pkgs;
              [ ]
              ++ lib.optionals pkgs.stdenv.isDarwin [
                apple-sdk_15
              ];
          };
        }
      );
    };
}
