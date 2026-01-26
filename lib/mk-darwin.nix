# This function creates a nix-darwin system based for a particular architecture.
name:
{ inputs, system }:

inputs.darwin.lib.darwinSystem {
  specialArgs = {
    inherit inputs;
  };

  modules = [
    # Set the host platform for platform-specific configuration
    { nixpkgs.hostPlatform = system; }

    # Nix index database module
    inputs.nix-index-database.darwinModules.nix-index

    # Home Manager module
    inputs.home-manager.darwinModules.home-manager

    # nixvim home-manager module
    {
      home-manager.sharedModules = [
        inputs.nixvim.homeModules.nixvim
      ];
    }

    # sops-nix module
    inputs.sops-nix.darwinModules.sops

    # Load the modules
    ../modules

    # Default host setup
    ../profiles/default.nix

    # Specific host setup
    ../hosts/${name}/configuration.nix
  ];
}
