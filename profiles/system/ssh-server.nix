{
  config,
  lib,
  ...
}:

let
  isLinux = config.nixpkgs.hostPlatform.isLinux;
  host = config.modules.host;
in
{
  # This service comes from nix-darwin or nixos
  services = {
    openssh = {
      enable = true;
    }
    // lib.optionalAttrs isLinux {
      settings = {
        PermitRootLogin = "no";
        PasswordAuthentication = false;
      };
    };
  };

  users.users.${host.username}.openssh = lib.mkIf isLinux {
    authorizedKeys.keys = host.security.authorizedKeys;
  };
}
