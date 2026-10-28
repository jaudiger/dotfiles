{
  config,
  lib,
  pkgs,
  ...
}:

let
  isDarwin = config.nixpkgs.hostPlatform.isDarwin;
in
{
  imports = [
    ./c.nix
    ./dockerfile.nix
    ./go.nix
    ./java.nix
    ./nix.nix
    ./nodejs.nix
    ./openapi.nix
    ./python.nix
    ./rust.nix
    ./shell.nix
    ./texlive.nix
    ./yaml.nix
    ./zig.nix
  ];

  config = lib.mkIf isDarwin {
    # Add additional libraries to Darwin linker search paths.
    modules.home-manager = {
      home.sessionVariables = with pkgs; {
        LIBRARY_PATH =
          "$LIBRARY_PATH\${LIBRARY_PATH:+:}" + "${darwin.libiconv}/lib:${darwin.libresolv}/lib";
      };
    };
  };
}
