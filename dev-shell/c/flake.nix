{
  description = "C devshell";

  inputs = {
    # Use as the main nixpkgs repository (to get the latest packages)
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
                curl.dev
                gtest.dev
                json_c.dev
                libmicrohttpd.dev
                rdkafka
                mongoc
              ]
              ++ lib.optionals pkgs.stdenv.isDarwin [
                apple-sdk_26
              ];
          };
        }
      );
    };
}
