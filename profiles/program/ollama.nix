{ ... }:

{
  modules.home-manager = {
    services.ollama = {
      # TODO: to re-enable once upstream is fixed, see: https://github.com/NixOS/nixpkgs/issues/431464
      enable = false;
    };
  };
}
