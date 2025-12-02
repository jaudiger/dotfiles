{
  description = "Nix configuration";

  inputs = {
    # Use as the main nixpkgs repository (to get the latest packages)
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";

    nix-index-database = {
      url = "github:nix-community/nix-index-database";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    home-manager = {
      url = "github:nix-community/home-manager/master";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    darwin = {
      url = "github:nix-darwin/nix-darwin/master";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    # To encrypt/decrypt secrets
    sops-nix = {
      url = "github:Mic92/sops-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    # To get Rust toolchains
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    # To get Zig toolchains
    zig-overlay = {
      url = "github:mitchellh/zig-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    { ... }@inputs:
    let
      mkDarwin = import ./lib/mk-darwin.nix;
      mkNixos = import ./lib/mk-nixos.nix;
    in
    {
      # NixOS configuration entrypoint
      # CLI: "nixos-rebuild --flake .#HOST"
      nixosConfigurations = {
        nixos-aarch64 = mkNixos "nixos-aarch64" {
          inherit inputs;
          system = "aarch64-linux";
        };
      };

      # First time CLI: "nix --extra-experimental-features 'flakes nix-command' run nix-darwin -- switch --flake .#HOST"
      # CLI: "darwin-rebuild switch --flake .#HOST"
      darwinConfigurations = {
        darwin-aarch64 = mkDarwin "darwin-aarch64" {
          inherit inputs;
          system = "aarch64-darwin";
        };
      };
    };
}
