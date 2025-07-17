# This function creates a devenv for a particular architecture.
name:
{ inputs, pkgs }:

inputs.devenv.lib.mkShell {
  inherit inputs pkgs;
  modules = [ ../dev-shell/${name}.nix ];
}
