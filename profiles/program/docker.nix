{
  config,
  lib,
  ...
}:

let
  isDarwin = config.nixpkgs.hostPlatform.isDarwin;
in
{
  homebrew.casks = lib.mkIf isDarwin [ "docker-desktop" ];

  modules.host.shell.aliases = {
    d = "docker";
    dc = "docker compose";
  };
}
