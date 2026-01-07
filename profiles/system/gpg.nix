{
  config,
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

      defaultCacheTtl = 3600;
      sshKeys = host.security.gpgSshKeys;

      enableExtraSocket = true;
      enableScDaemon = false;
    };
  };
}
