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
    taps = [
      "iann0036/iamlive"
    ];

    brews = [ "iann0036/iamlive/iamlive" ];
  };
}
