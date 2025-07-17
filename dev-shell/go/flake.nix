{
  description = "Go devshell";

  inputs = {
    # Use as the main nixpks repository (to get the latest stable packages)
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
  };

  outputs =
    { nixpkgs, ... }:
    let
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
            pkgs = import nixpkgs { inherit system; };
          }
        );
    in
    {
      devShells = forAllSystems (
        { pkgs, ... }:
        {
          default = pkgs.mkShell {
            nativeBuildInputs = [ ];

            buildInputs =
              with pkgs;
              [
                go
                delve
                gopls
              ]
              ++ lib.optionals pkgs.stdenv.isDarwin [
                apple-sdk_15
              ];
          };
        }
      );
    };
}
