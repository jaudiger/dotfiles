# This function creates a NixOS system based on our VM setup for a particular architecture.
name:
{ inputs, system }:

inputs.nixpkgs.lib.nixosSystem {
  inherit system;
  specialArgs = {
    inherit inputs;
  };

  modules = [
    # Nix index database module
    inputs.nix-index-database.nixosModules.nix-index

    # Home Manager module
    inputs.home-manager.nixosModules.home-manager

    # sops-nix module
    inputs.sops-nix.nixosModules.sops

    # Load the modules
    ../modules

    # Default host setup
    ../profiles/default.nix

    # Specific host setup
    ../hosts/${name}/configuration.nix
    ../hosts/${name}/hardware-configuration.nix
  ];
}
