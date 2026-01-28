# NOTE: Discord is not available on aarch64-linux (only x86_64-linux)
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
    casks = [ "discord" ];
  };
}
