{
  pkgs,
  config,
  lib,
  ...
}:

let
  isLinux = pkgs.stdenv.isLinux;
  host = config.modules.host;
in
{
  # This service comes from nix-darwin or nixos
  services = {
    openssh = {
      enable = true;

      settings = lib.mkIf isLinux {
        PermitRootLogin = "no";
        PasswordAuthentication = false;
      };
    };
  };

  users.users.${host.username}.openssh = lib.mkIf isLinux {
    authorizedKeys.keys = host.security.authorizedKeys;
  };
}
