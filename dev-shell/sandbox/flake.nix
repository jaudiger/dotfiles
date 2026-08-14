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
      mkSandbox =
        { pkgs }:
        let
          sandboxProfile = pkgs.writeText "restrictive.sb" ''
            (version 1)
            (deny default)

            (allow file-read*)
            (allow file-write*
              (subpath "/dev/null")
              (subpath "/dev/stderr")
              (subpath "/dev/stdout")
              (subpath "/private/tmp")
              (subpath "/private/var/folders")
              (subpath "/tmp")
              (subpath "/Users/jaudiger/.cache")
              (subpath "/Users/jaudiger/.npm")
              (subpath "/var/folders")
              (subpath (param "PWD")))
            (allow process-exec
              (subpath "/bin")
              (subpath "/nix/store")
              (subpath "/opt/homebrew/bin")
              (subpath "/private/tmp")
              (subpath "/private/var/folders")
              (subpath "/tmp")
              (subpath "/usr/bin")
              (subpath "/var/folders")
              (subpath (param "PWD")))
            (allow process-fork)
            (allow sysctl-read)

            (allow network*)
          '';
          sandboxRunner = pkgs.writeShellScriptBin "sandbox-run" ''
            if [ "$#" -eq 0 ]; then
              set -- ${pkgs.runtimeShell}
            fi

            exec /usr/bin/sandbox-exec \
              -D "PWD=$(pwd -P)" \
              -f ${sandboxProfile} \
              "$@"
          '';
        in
        {
          devShell = pkgs.mkShell {
            shellHook = ''
              alias sandbox-bash='sandbox-exec -D PWD="$(pwd -P)" -f ${sandboxProfile} bash -c'
            '';
          };
          app = {
            type = "app";
            program = "${sandboxRunner}/bin/sandbox-run";
            meta.description = "Run a command in the macOS sandbox";
          };
        };
    in
    {
      devShells = forAllSystems (
        { pkgs, ... }:
        let
          sandbox = mkSandbox { inherit pkgs; };
        in
        {
          default = sandbox.devShell;
        }
      );

      apps = forAllSystems (
        { pkgs, ... }:
        let
          sandbox = mkSandbox { inherit pkgs; };
        in
        {
          default = sandbox.app;
        }
      );
    };
}
