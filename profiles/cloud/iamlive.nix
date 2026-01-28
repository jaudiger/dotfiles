# NOTE: iamlive is not available in nixpkgs
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
    brews = [ "iamlive" ];
  };
}
