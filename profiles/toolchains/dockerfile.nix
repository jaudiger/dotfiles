{ pkgs, ... }:

{
  modules.home-manager.home = {
    packages = with pkgs; [
      # Dockerfile linter
      hadolint
    ];
  };
}
