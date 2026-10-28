{
  config,
  pkgs,
  ...
}:

let
  host = config.modules.host;
in
{
  modules.home-manager = {
    programs.gpg = {
      enable = true;
    };

    services.gpg-agent = {
      enable = true;

      pinentry.package =
        if pkgs.stdenv.hostPlatform.isDarwin then pkgs.pinentry_mac else pkgs.pinentry-curses;

      defaultCacheTtl = 3600;
      sshKeys = host.security.gpgSshKeys;

      enableExtraSocket = true;
      enableScDaemon = false;
    };
  };
}
