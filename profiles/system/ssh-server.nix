{
  pkgs,
  config,
  lib,
  ...
}:

let
  isDarwin = pkgs.stdenv.isDarwin;
  isLinux = pkgs.stdenv.isLinux;
  host = config.modules.host;
in
{
  # This service comes from nix-darwin
  services = lib.mkIf isDarwin {
    openssh = {
      enable = true;
    };
  };

  modules.home-manager = lib.mkIf isLinux {
    services = {
      openssh = {
        enable = true;
        settings = {
          PermitRootLogin = "no";
          PasswordAuthentication = false;
        };
      };
    };

    users.users.${host.username}.openssh = {
      authorizedKeys.keys = host.security.authorizedKeys;
    };
  };
}
