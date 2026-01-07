{
  config,
  lib,
  ...
}:

let
  isDarwin = config.nixpkgs.hostPlatform.isDarwin;
in
{
  homebrew = lib.mkIf isDarwin {
    casks = [ "docker-desktop" ];
  };

  modules.host.shell.aliases = {
    d = "docker";
    dc = "docker compose";
  };
}
